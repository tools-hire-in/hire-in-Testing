import { db } from "./db";
import { eq, desc, and, ilike, or, sql, gte, lte, asc, inArray, isNull } from "drizzle-orm";
import {
  jobs,
  applications,
  contacts,
  adminUsers,
  departments,
  holidays,
  attendance,
  leaveTypes,
  leaveBalances,
  leaveRequests,
  leaveAccruals,
  tickets,
  auditLogs,
  regionalHolidaySelections,
  salarySlips,
  leaveAdjustments,
  employeeDocuments,
  employeeBankDetails,
  employeeEmergencyContacts,
  offerLetters,
  offerLetterAddendums,
  hrLetters,
  systemSettings,
  letterTemplateSentences,
  roleSummaryTemplates,
  type Job,
  type InsertJob,
  type Application,
  type InsertApplication,
  type Contact,
  type InsertContact,
  type AdminUser,
  type InsertAdminUser,
  type Department,
  type InsertDepartment,
  type Holiday,
  type InsertHoliday,
  type Attendance,
  type InsertAttendance,
  type LeaveType,
  type InsertLeaveType,
  type LeaveBalance,
  type InsertLeaveBalance,
  type LeaveRequest,
  type InsertLeaveRequest,
  type LeaveAccrual,
  type InsertLeaveAccrual,
  type Ticket,
  type InsertTicket,
  type AuditLog,
  type InsertAuditLog,
  type RegionalHolidaySelection,
  type InsertRegionalHolidaySelection,
  type SalarySlip,
  type InsertSalarySlip,
  type LeaveAdjustment,
  type InsertLeaveAdjustment,
  type EmployeeDocument,
  type InsertEmployeeDocument,
  type EmployeeBankDetails,
  type InsertEmployeeBankDetails,
  type EmployeeEmergencyContact,
  type InsertEmployeeEmergencyContact,
  type OfferLetter,
  type InsertOfferLetter,
  type OfferLetterAddendum,
  type InsertOfferLetterAddendum,
  type HrLetter,
  type InsertHrLetter,
  type SystemSetting,
  type LetterTemplateSentence,
  type RoleSummaryTemplate,
  notifications,
  type Notification,
  type InsertNotification,
} from "@shared/schema";

export interface IStorage {
  // Jobs
  getJobs(filters?: { search?: string; specialty?: string; state?: string; jobType?: string; industrySpecialties?: string[] }): Promise<Job[]>;
  getActiveJobs(filters?: { search?: string; specialty?: string; state?: string; jobType?: string; industrySpecialties?: string[]; page?: number; pageSize?: number; limit?: number }): Promise<{ jobs: Job[]; total: number }>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  createJobs(jobList: InsertJob[]): Promise<Job[]>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;
  deleteJobs(ids: string[]): Promise<number>;
  updateJobsBulk(ids: string[], updates: Partial<InsertJob>): Promise<number>;
  getJobFilters(industrySpecialties?: string[]): Promise<{ specialties: string[]; states: string[]; jobTypes: string[] }>;

  // Applications
  getApplications(jobId?: string): Promise<(Application & { jobTitle?: string; jobRequirementId?: string; ceipalJobId?: string; ceipalJobCode?: string; jobDescription?: string; jobCity?: string; jobState?: string; jobType?: string })[]>;
  getApplication(id: string): Promise<Application | undefined>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: string, app: Partial<Application>): Promise<Application | undefined>;
  getApplicationCountsByJob(): Promise<Record<string, number>>;

  // Contacts
  getContacts(): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<Contact>): Promise<Contact | undefined>;

  // Admin Users
  getAdminUsers(): Promise<AdminUser[]>;
  getAllActiveEmployees(): Promise<AdminUser[]>;
  getAllAdminUsersIncludingDeleted(): Promise<AdminUser[]>;
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  createAdminUser(user: InsertAdminUser): Promise<AdminUser>;
  updateAdminUser(id: string, user: Partial<AdminUser>): Promise<AdminUser | undefined>;
  deleteAdminUser(id: string): Promise<boolean>;
  softDeleteAdminUser(id: string): Promise<boolean>;
  restoreAdminUser(id: string): Promise<AdminUser | undefined>;

  // Departments
  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(dept: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, dept: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: string): Promise<boolean>;

  // Hierarchy
  getOrgTree(): Promise<{ users: AdminUser[]; departments: Department[] }>;
  getTeamMembers(managerId: string): Promise<AdminUser[]>;

  // Holidays
  getHolidays(year?: number): Promise<Holiday[]>;
  getHoliday(id: string): Promise<Holiday | undefined>;
  createHoliday(holiday: InsertHoliday): Promise<Holiday>;
  updateHoliday(id: string, holiday: Partial<InsertHoliday>): Promise<Holiday | undefined>;
  deleteHoliday(id: string): Promise<boolean>;

  // Regional Holiday Selections
  getRegionalHolidaySelections(userId: string, year: number): Promise<RegionalHolidaySelection[]>;
  getAllRegionalHolidaySelectionsForYear(year: number): Promise<RegionalHolidaySelection[]>;
  createRegionalHolidaySelection(data: InsertRegionalHolidaySelection): Promise<RegionalHolidaySelection>;
  deleteRegionalHolidaySelection(id: string, userId?: string): Promise<boolean>;

  // Holiday Attendance Stamping
  stampHolidayAttendance(userId: string, date: string, holidayType?: "public" | "regional"): Promise<void>;
  stampHolidayForAllActiveEmployees(date: string): Promise<number>;
  removeHolidayAttendanceStamps(date: string): Promise<number>;
  removeUserHolidayAttendanceStamp(userId: string, date: string, holidayType?: "public" | "regional"): Promise<boolean>;

  // Attendance
  getAttendanceByUser(userId: string, startDate?: string, endDate?: string): Promise<Attendance[]>;
  getAttendanceByDate(date: string): Promise<Attendance[]>;
  getTodayAttendance(userId: string): Promise<Attendance | undefined>;
  createAttendance(record: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, record: Partial<InsertAttendance>): Promise<Attendance | undefined>;
  getAttendanceByTeam(userIds: string[], date: string): Promise<Attendance[]>;
  getAttendanceByTeamRange(userIds: string[], startDate: string, endDate: string): Promise<Attendance[]>;

  // Leave Types
  getLeaveTypes(): Promise<LeaveType[]>;
  getLeaveType(id: string): Promise<LeaveType | undefined>;
  createLeaveType(lt: InsertLeaveType): Promise<LeaveType>;
  updateLeaveType(id: string, lt: Partial<InsertLeaveType>): Promise<LeaveType | undefined>;
  deleteLeaveType(id: string): Promise<boolean>;

  // Leave Balances
  getLeaveBalances(userId: string, year: number): Promise<LeaveBalance[]>;
  getLeaveBalance(id: string): Promise<LeaveBalance | undefined>;
  createLeaveBalance(lb: InsertLeaveBalance): Promise<LeaveBalance>;
  updateLeaveBalance(id: string, lb: Partial<InsertLeaveBalance>): Promise<LeaveBalance | undefined>;
  initLeaveBalances(userId: string, year: number): Promise<LeaveBalance[]>;
  accrueMonthlyLeaves(year: number, month: number): Promise<{
    usersProcessed: number;
    accrualsMade: number;
    skippedUsers: Array<{ name: string; reason: string; leaveTypeName: string }>;
    processedDetails: Array<{ name: string; leaveTypeName: string; accruedDays: number; accrualType: string; newBalance: number }>;
    runAt: string;
    year: number;
    month: number;
  }>;
  runYearEndBatch(year: number): Promise<{
    processed: number;
    elCarried: number;
    slLapsed: number;
    coCleared: number;
    capEvents: Array<{ userId: string; name: string; leaveTypeName: string; remaining: number; cap: number; forfeited: number }>;
    details: Array<{ userId: string; email: string; name: string; leaveTypeName: string; action: string; days: number }>;
  }>;
  countLeaveDays(startDate: string, endDate: string): Promise<number>;
  getLeaveAccrualsByUser(userId: string, year?: number): Promise<LeaveAccrual[]>;

  // Leave Requests
  getLeaveRequests(filters?: { userId?: string; status?: string }): Promise<LeaveRequest[]>;
  getLeaveRequest(id: string): Promise<LeaveRequest | undefined>;
  createLeaveRequest(lr: InsertLeaveRequest): Promise<LeaveRequest>;
  updateLeaveRequest(id: string, lr: Partial<LeaveRequest>): Promise<LeaveRequest | undefined>;
  getLeaveRequestsByTeam(userIds: string[]): Promise<LeaveRequest[]>;
  isUserOnLeaveToday(userId: string): Promise<boolean>;

  // Tickets
  getTickets(filters?: { userId?: string; status?: string }): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: string, ticket: Partial<Ticket>): Promise<Ticket | undefined>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { actorId?: string; targetId?: string; action?: string; limit?: number; offset?: number }): Promise<AuditLog[]>;
  getAuditLogCount(filters?: { actorId?: string; targetId?: string; action?: string }): Promise<number>;

  // Salary Slips
  getSalarySlipsByUser(userId: string, year?: number): Promise<SalarySlip[]>;
  getSalarySlip(id: string): Promise<SalarySlip | undefined>;
  createSalarySlip(slip: InsertSalarySlip): Promise<SalarySlip>;
  getSalarySlipsByMonth(year: number, month: number): Promise<SalarySlip[]>;

  // Leave Accruals (per user)
  getLeaveAccrualsByUser(userId: string, year: number): Promise<LeaveAccrual[]>;

  // Leave Adjustments
  createLeaveAdjustment(adj: InsertLeaveAdjustment): Promise<LeaveAdjustment>;
  getLeaveAdjustments(filters?: { userId?: string; year?: number }): Promise<LeaveAdjustment[]>;

  // Employee Documents
  getEmployeeDocuments(userId: string): Promise<EmployeeDocument[]>;
  getEmployeeDocument(id: string): Promise<EmployeeDocument | undefined>;
  createEmployeeDocument(doc: InsertEmployeeDocument): Promise<EmployeeDocument>;
  updateEmployeeDocument(id: string, updates: Partial<EmployeeDocument>): Promise<EmployeeDocument | undefined>;
  deleteEmployeeDocument(id: string): Promise<boolean>;
  initializeEmployeeDocuments(userId: string): Promise<EmployeeDocument[]>;
  getAllEmployeeDocuments(): Promise<EmployeeDocument[]>;

  // Employee Bank Details
  getBankDetails(userId: string): Promise<EmployeeBankDetails | undefined>;
  upsertBankDetails(data: InsertEmployeeBankDetails): Promise<EmployeeBankDetails>;

  // Employee Emergency Contacts
  getEmergencyContacts(userId: string): Promise<EmployeeEmergencyContact[]>;
  createEmergencyContact(contact: InsertEmployeeEmergencyContact): Promise<EmployeeEmergencyContact>;
  updateEmergencyContact(id: string, updates: Partial<EmployeeEmergencyContact>): Promise<EmployeeEmergencyContact | undefined>;
  deleteEmergencyContact(id: string): Promise<boolean>;

  // System Settings
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  upsertSystemSetting(key: string, value: any, updatedBy?: string): Promise<SystemSetting>;

  createNotification(data: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // Offer Letters
  createOfferLetter(data: InsertOfferLetter): Promise<OfferLetter>;
  getOfferLetterByToken(token: string): Promise<OfferLetter | undefined>;
  getOfferLetter(id: string): Promise<OfferLetter | undefined>;
  updateOfferLetter(id: string, updates: Partial<OfferLetter>): Promise<OfferLetter | undefined>;
  getOfferLetters(): Promise<OfferLetter[]>;

  // Offer Letter Addendums
  createAddendum(data: InsertOfferLetterAddendum): Promise<OfferLetterAddendum>;
  getAddendumsForOffer(offerLetterId: string): Promise<OfferLetterAddendum[]>;
  getAddendumByToken(token: string): Promise<OfferLetterAddendum | undefined>;
  getAddendum(id: string): Promise<OfferLetterAddendum | undefined>;
  updateAddendumStatus(id: string, updates: Partial<OfferLetterAddendum>): Promise<OfferLetterAddendum | undefined>;

  // HR Letters
  createHrLetter(data: InsertHrLetter): Promise<HrLetter>;
  getHrLetter(id: string): Promise<HrLetter | undefined>;
  updateHrLetter(id: string, updates: Partial<HrLetter>): Promise<HrLetter | undefined>;
  getHrLetters(filters?: { templateType?: string; status?: string; search?: string }): Promise<HrLetter[]>;
  getHrLetterByRef(referenceNumber: string): Promise<HrLetter | undefined>;
  getHrLetterByRefAndAuth(referenceNumber: string, authCode: string): Promise<HrLetter | undefined>;
  getHrLetterCountByPrefix(prefix: string): Promise<number>;

  // Letter Template Sentences
  getLetterTemplateSentences(category?: string): Promise<LetterTemplateSentence[]>;
  updateLetterTemplateSentence(id: string, updates: { sentence: string }): Promise<LetterTemplateSentence | undefined>;

  // Role Summary Templates
  getRoleSummaryTemplates(filters?: { vertical?: string; designation?: string }): Promise<RoleSummaryTemplate[]>;

  // Stats
  getStats(): Promise<{
    totalJobs: number;
    activeJobs: number;
    totalApplications: number;
    newApplications: number;
    totalContacts: number;
    newContacts: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Jobs
  async getJobs(filters?: { search?: string; specialty?: string; state?: string; jobType?: string; industrySpecialties?: string[] }): Promise<Job[]> {
    const conditions: any[] = [];

    if (filters?.specialty) {
      conditions.push(eq(jobs.specialty, filters.specialty));
    } else if (filters?.industrySpecialties && filters.industrySpecialties.length > 0) {
      conditions.push(inArray(jobs.specialty, filters.industrySpecialties));
    }
    if (filters?.state) {
      conditions.push(eq(jobs.state, filters.state));
    }
    if (filters?.jobType) {
      conditions.push(eq(jobs.jobType, filters.jobType));
    }
    if (filters?.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(jobs.title, term),
          ilike(jobs.specialty, term),
          ilike(jobs.description, term)
        )
      );
    }

    const query = conditions.length > 0
      ? db.select().from(jobs).where(and(...conditions)).orderBy(desc(jobs.createdAt))
      : db.select().from(jobs).orderBy(desc(jobs.createdAt));

    return query;
  }

  async getActiveJobs(filters?: {
    search?: string;
    specialty?: string;
    state?: string;
    jobType?: string;
    industrySpecialties?: string[];
    page?: number;
    pageSize?: number;
    limit?: number;
  }): Promise<{ jobs: Job[]; total: number }> {
    const conditions: any[] = [eq(jobs.isActive, true)];

    if (filters?.specialty) {
      conditions.push(eq(jobs.specialty, filters.specialty));
    } else if (filters?.industrySpecialties && filters.industrySpecialties.length > 0) {
      conditions.push(inArray(jobs.specialty, filters.industrySpecialties));
    }
    if (filters?.state) {
      conditions.push(eq(jobs.state, filters.state));
    }
    if (filters?.jobType) {
      conditions.push(eq(jobs.jobType, filters.jobType));
    }
    if (filters?.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(jobs.title, term),
          ilike(jobs.specialty, term),
          ilike(jobs.description, term)
        )
      );
    }

    const whereClause = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(whereClause);

    const total = count ?? 0;

    if (filters?.limit) {
      const results = await db.select().from(jobs)
        .where(whereClause)
        .orderBy(desc(jobs.createdAt))
        .limit(filters.limit);
      return { jobs: results, total };
    }

    const pageSize = filters?.pageSize ?? 12;
    const page = filters?.page ?? 1;
    const offset = (page - 1) * pageSize;

    const results = await db.select().from(jobs)
      .where(whereClause)
      .orderBy(desc(jobs.createdAt))
      .limit(pageSize)
      .offset(offset);

    return { jobs: results, total };
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [created] = await db.insert(jobs).values(job).returning();
    return created;
  }

  async createJobs(jobList: InsertJob[]): Promise<Job[]> {
    if (jobList.length === 0) return [];
    const created = await db.insert(jobs).values(jobList).returning();
    return created;
  }

  async updateJob(id: string, job: Partial<InsertJob>): Promise<Job | undefined> {
    const [updated] = await db.update(jobs)
      .set({ ...job, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    return updated;
  }

  async deleteJob(id: string): Promise<boolean> {
    await db.delete(jobs).where(eq(jobs.id, id));
    return true;
  }

  async deleteJobs(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    await db.delete(jobs).where(sql`${jobs.id} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[])`);
    return ids.length;
  }

  async updateJobsBulk(ids: string[], updates: Partial<InsertJob>): Promise<number> {
    if (ids.length === 0) return 0;
    await db.update(jobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(sql`${jobs.id} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[])`);
    return ids.length;
  }

  async getJobFilters(industrySpecialties?: string[]): Promise<{ specialties: string[]; states: string[]; jobTypes: string[] }> {
    const conditions: any[] = [eq(jobs.isActive, true)];
    if (industrySpecialties && industrySpecialties.length > 0) {
      conditions.push(inArray(jobs.specialty, industrySpecialties));
    }

    const allJobs = await db.select({
      specialty: jobs.specialty,
      state: jobs.state,
      jobType: jobs.jobType,
    }).from(jobs).where(and(...conditions));

    const specialties = Array.from(new Set(allJobs.map(j => j.specialty).filter((v): v is string => !!v)));
    const states = Array.from(new Set(allJobs.map(j => j.state).filter((v): v is string => !!v)));
    const jobTypeList = Array.from(new Set(allJobs.map(j => j.jobType).filter((v): v is string => !!v)));

    return { specialties: specialties.sort(), states: states.sort(), jobTypes: jobTypeList.sort() };
  }

  // Applications
  async getApplications(jobId?: string): Promise<(Application & { jobTitle?: string; jobRequirementId?: string; ceipalJobId?: string; ceipalJobCode?: string; jobDescription?: string; jobCity?: string; jobState?: string; jobType?: string })[]> {
    let query = db
      .select({
        application: applications,
        jobTitle: jobs.title,
        jobRequirementId: jobs.jobId,
        ceipalJobId: jobs.ceipalJobId,
        ceipalJobCode: jobs.ceipalJobCode,
        jobDescription: jobs.description,
        jobCity: jobs.city,
        jobState: jobs.state,
        jobType: jobs.jobType,
      })
      .from(applications)
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .orderBy(desc(applications.createdAt));

    if (jobId === "unlinked") {
      query = query.where(sql`${applications.jobId} IS NULL`) as any;
    } else if (jobId) {
      query = query.where(eq(applications.jobId, jobId)) as any;
    }

    const rows = await query;
    return rows.map((r) => ({
      ...r.application,
      jobTitle: r.jobTitle ?? undefined,
      jobRequirementId: r.jobRequirementId ?? undefined,
      ceipalJobId: r.ceipalJobId ?? undefined,
      ceipalJobCode: r.ceipalJobCode ?? undefined,
      jobDescription: r.jobDescription ?? undefined,
      jobCity: r.jobCity ?? undefined,
      jobState: r.jobState ?? undefined,
      jobType: r.jobType ?? undefined,
    }));
  }

  async getApplication(id: string): Promise<Application | undefined> {
    const [app] = await db.select().from(applications).where(eq(applications.id, id));
    return app;
  }

  async createApplication(app: InsertApplication): Promise<Application> {
    const [created] = await db.insert(applications).values(app).returning();
    return created;
  }

  async updateApplication(id: string, app: Partial<Application>): Promise<Application | undefined> {
    const [updated] = await db.update(applications)
      .set({ ...app, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();
    return updated;
  }

  async getApplicationCountsByJob(): Promise<Record<string, number>> {
    const rows = await db
      .select({
        jobId: applications.jobId,
        count: sql<number>`count(*)::int`,
      })
      .from(applications)
      .groupBy(applications.jobId);
    const result: Record<string, number> = {};
    for (const row of rows) {
      if (row.jobId) {
        result[row.jobId] = row.count;
      }
    }
    return result;
  }

  // Contacts
  async getContacts(): Promise<Contact[]> {
    return db.select().from(contacts).orderBy(desc(contacts.createdAt));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [created] = await db.insert(contacts).values(contact).returning();
    return created;
  }

  async updateContact(id: string, contact: Partial<Contact>): Promise<Contact | undefined> {
    const [updated] = await db.update(contacts)
      .set(contact)
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  // Admin Users
  async getAdminUsers(): Promise<AdminUser[]> {
    return db.select().from(adminUsers).where(isNull(adminUsers.deletedAt)).orderBy(adminUsers.email);
  }

  async getAllActiveEmployees(): Promise<AdminUser[]> {
    return db.select().from(adminUsers)
      .where(and(
        isNull(adminUsers.deletedAt),
        eq(adminUsers.isActive, true),
        eq(adminUsers.employmentStatus, "active"),
      ))
      .orderBy(adminUsers.firstName);
  }

  async getAllAdminUsersIncludingDeleted(): Promise<AdminUser[]> {
    return db.select().from(adminUsers).orderBy(adminUsers.email);
  }

  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return user;
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return user;
  }

  async createAdminUser(user: InsertAdminUser): Promise<AdminUser> {
    const [created] = await db.insert(adminUsers).values(user).returning();
    return created;
  }

  async updateAdminUser(id: string, user: Partial<AdminUser>): Promise<AdminUser | undefined> {
    const [updated] = await db.update(adminUsers)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(adminUsers.id, id))
      .returning();
    return updated;
  }

  async deleteAdminUser(id: string): Promise<boolean> {
    await db.delete(adminUsers).where(eq(adminUsers.id, id));
    return true;
  }

  async softDeleteAdminUser(id: string): Promise<boolean> {
    await db.update(adminUsers)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(adminUsers.id, id));
    return true;
  }

  async restoreAdminUser(id: string): Promise<AdminUser | undefined> {
    const [restored] = await db.update(adminUsers)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(adminUsers.id, id))
      .returning();
    return restored;
  }

  // ==========================================
  // DEPARTMENTS
  // ==========================================

  async getDepartments(): Promise<Department[]> {
    return db.select().from(departments).orderBy(departments.name);
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return dept;
  }

  async createDepartment(dept: InsertDepartment): Promise<Department> {
    const [created] = await db.insert(departments).values(dept).returning();
    return created;
  }

  async updateDepartment(id: string, dept: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [updated] = await db.update(departments)
      .set({ ...dept, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    return updated;
  }

  async deleteDepartment(id: string): Promise<boolean> {
    await db.delete(departments).where(eq(departments.id, id));
    return true;
  }

  // ==========================================
  // HIERARCHY
  // ==========================================

  async getOrgTree(): Promise<{ users: AdminUser[]; departments: Department[] }> {
    const allUsers = await db.select().from(adminUsers).where(and(eq(adminUsers.isActive, true), isNull(adminUsers.deletedAt))).orderBy(adminUsers.firstName);
    const allDepts = await db.select().from(departments).where(eq(departments.isActive, true)).orderBy(departments.name);
    return { users: allUsers, departments: allDepts };
  }

  async getTeamMembers(managerId: string): Promise<AdminUser[]> {
    return db.select().from(adminUsers).where(and(eq(adminUsers.managerId, managerId), isNull(adminUsers.deletedAt))).orderBy(adminUsers.firstName);
  }

  // ==========================================
  // HR PORTAL: Holidays
  // ==========================================

  async getHolidays(year?: number): Promise<Holiday[]> {
    if (year) {
      return db.select().from(holidays)
        .where(sql`${holidays.date} LIKE ${`${year}-%`}`)
        .orderBy(asc(holidays.date));
    }
    return db.select().from(holidays).orderBy(asc(holidays.date));
  }

  async getHoliday(id: string): Promise<Holiday | undefined> {
    const [h] = await db.select().from(holidays).where(eq(holidays.id, id));
    return h;
  }

  async createHoliday(holiday: InsertHoliday): Promise<Holiday> {
    const [created] = await db.insert(holidays).values(holiday).returning();
    return created;
  }

  async updateHoliday(id: string, holiday: Partial<InsertHoliday>): Promise<Holiday | undefined> {
    const [updated] = await db.update(holidays)
      .set(holiday)
      .where(eq(holidays.id, id))
      .returning();
    return updated;
  }

  async deleteHoliday(id: string): Promise<boolean> {
    await db.delete(holidays).where(eq(holidays.id, id));
    return true;
  }

  async getRegionalHolidaySelections(userId: string, year: number): Promise<RegionalHolidaySelection[]> {
    return await db.select().from(regionalHolidaySelections)
      .where(and(
        eq(regionalHolidaySelections.userId, userId),
        eq(regionalHolidaySelections.year, year),
      ))
      .orderBy(asc(regionalHolidaySelections.createdAt));
  }

  async createRegionalHolidaySelection(data: InsertRegionalHolidaySelection): Promise<RegionalHolidaySelection> {
    const [sel] = await db.insert(regionalHolidaySelections).values(data).returning();
    return sel;
  }

  async deleteRegionalHolidaySelection(id: string, userId?: string): Promise<boolean> {
    const conditions = [eq(regionalHolidaySelections.id, id)];
    if (userId) {
      conditions.push(eq(regionalHolidaySelections.userId, userId));
    }
    await db.delete(regionalHolidaySelections).where(and(...conditions));
    return true;
  }

  async getAllRegionalHolidaySelectionsForYear(year: number): Promise<RegionalHolidaySelection[]> {
    return await db.select().from(regionalHolidaySelections)
      .where(eq(regionalHolidaySelections.year, year));
  }

  async stampHolidayAttendance(userId: string, date: string, holidayType: "public" | "regional" = "public"): Promise<void> {
    const existing = await db.select().from(attendance)
      .where(and(eq(attendance.userId, userId), eq(attendance.date, date)));
    if (existing.length > 0) return;
    const noteText = holidayType === "regional" ? "Auto-stamped regional holiday" : "Auto-stamped public holiday";
    await db.insert(attendance).values({
      userId,
      date,
      status: "holiday",
      punchIn: null,
      punchOut: null,
      totalHours: "0",
      notes: noteText,
    });
  }

  async stampHolidayForAllActiveEmployees(date: string): Promise<number> {
    const activeUsers = await db.select({ id: adminUsers.id }).from(adminUsers)
      .where(eq(adminUsers.isActive, true));
    let stamped = 0;
    for (const user of activeUsers) {
      const existing = await db.select({ id: attendance.id }).from(attendance)
        .where(and(eq(attendance.userId, user.id), eq(attendance.date, date)));
      if (existing.length === 0) {
        await db.insert(attendance).values({
          userId: user.id,
          date,
          status: "holiday",
          punchIn: null,
          punchOut: null,
          totalHours: "0",
          notes: "Auto-stamped public holiday",
        });
        stamped++;
      }
    }
    return stamped;
  }

  async removeHolidayAttendanceStamps(date: string): Promise<number> {
    const result = await db.delete(attendance)
      .where(and(
        eq(attendance.date, date),
        eq(attendance.status, "holiday"),
        sql`${attendance.notes} LIKE '%public holiday%'`,
      ))
      .returning();
    return result.length;
  }

  async removeUserHolidayAttendanceStamp(userId: string, date: string, holidayType: "public" | "regional" = "regional"): Promise<boolean> {
    const notePattern = holidayType === "regional" ? "%regional holiday%" : "%public holiday%";
    const result = await db.delete(attendance)
      .where(and(
        eq(attendance.userId, userId),
        eq(attendance.date, date),
        eq(attendance.status, "holiday"),
        sql`${attendance.notes} LIKE ${notePattern}`,
      ))
      .returning();
    return result.length > 0;
  }

  // ==========================================
  // HR PORTAL: Attendance
  // ==========================================

  async getAttendanceByUser(userId: string, startDate?: string, endDate?: string): Promise<Attendance[]> {
    const conditions = [eq(attendance.userId, userId)];
    if (startDate) {
      conditions.push(gte(attendance.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(attendance.date, endDate));
    }
    return db.select().from(attendance)
      .where(and(...conditions))
      .orderBy(desc(attendance.date));
  }

  async getAttendanceByDate(date: string): Promise<Attendance[]> {
    return db.select().from(attendance)
      .where(eq(attendance.date, date))
      .orderBy(attendance.userId);
  }

  async getTodayAttendance(userId: string): Promise<Attendance | undefined> {
    const today = new Date().toISOString().split("T")[0];
    const [record] = await db.select().from(attendance)
      .where(and(eq(attendance.userId, userId), eq(attendance.date, today)));
    return record;
  }

  async createAttendance(record: InsertAttendance): Promise<Attendance> {
    const [created] = await db.insert(attendance).values(record).returning();
    return created;
  }

  async updateAttendance(id: string, record: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const [updated] = await db.update(attendance)
      .set({ ...record, updatedAt: new Date() })
      .where(eq(attendance.id, id))
      .returning();
    return updated;
  }

  async getAttendanceByTeam(userIds: string[], date: string): Promise<Attendance[]> {
    if (userIds.length === 0) return [];
    const normalizedDate = date.slice(0, 10);
    return db.select().from(attendance)
      .where(and(
        inArray(attendance.userId, userIds),
        sql`LEFT(${attendance.date}, 10) = ${normalizedDate}`,
      ))
      .orderBy(attendance.userId);
  }

  async getAttendanceByTeamRange(userIds: string[], startDate: string, endDate: string): Promise<Attendance[]> {
    if (userIds.length === 0) return [];
    return db.select().from(attendance)
      .where(and(
        inArray(attendance.userId, userIds),
        gte(attendance.date, startDate),
        lte(attendance.date, endDate)
      ))
      .orderBy(desc(attendance.date));
  }

  // ==========================================
  // HR PORTAL: Leave Types
  // ==========================================

  async getLeaveTypes(): Promise<LeaveType[]> {
    return db.select().from(leaveTypes).orderBy(leaveTypes.name);
  }

  async getLeaveType(id: string): Promise<LeaveType | undefined> {
    const [lt] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, id));
    return lt;
  }

  async createLeaveType(lt: InsertLeaveType): Promise<LeaveType> {
    const [created] = await db.insert(leaveTypes).values(lt).returning();
    return created;
  }

  async updateLeaveType(id: string, lt: Partial<InsertLeaveType>): Promise<LeaveType | undefined> {
    const [updated] = await db.update(leaveTypes)
      .set(lt)
      .where(eq(leaveTypes.id, id))
      .returning();
    return updated;
  }

  async deleteLeaveType(id: string): Promise<boolean> {
    await db.delete(leaveTypes).where(eq(leaveTypes.id, id));
    return true;
  }

  // ==========================================
  // HR PORTAL: Leave Balances
  // ==========================================

  async getLeaveBalances(userId: string, year: number): Promise<LeaveBalance[]> {
    return db.select().from(leaveBalances)
      .where(and(eq(leaveBalances.userId, userId), eq(leaveBalances.year, year)))
      .orderBy(leaveBalances.leaveTypeId);
  }

  async getLeaveBalance(id: string): Promise<LeaveBalance | undefined> {
    const [lb] = await db.select().from(leaveBalances).where(eq(leaveBalances.id, id));
    return lb;
  }

  async createLeaveBalance(lb: InsertLeaveBalance): Promise<LeaveBalance> {
    const [created] = await db.insert(leaveBalances).values(lb).returning();
    return created;
  }

  async updateLeaveBalance(id: string, lb: Partial<InsertLeaveBalance>): Promise<LeaveBalance | undefined> {
    const [updated] = await db.update(leaveBalances)
      .set({ ...lb, updatedAt: new Date() })
      .where(eq(leaveBalances.id, id))
      .returning();
    return updated;
  }

  async initLeaveBalances(userId: string, year: number): Promise<LeaveBalance[]> {
    const existingBalances = await this.getLeaveBalances(userId, year);

    const activeLeaveTypes = await db.select().from(leaveTypes).where(eq(leaveTypes.isActive, true));

    // Ensure every active leave type has a balance record (add missing ones even if some exist)
    const existingTypeIds = new Set(existingBalances.map(b => b.leaveTypeId));
    const missingTypes = activeLeaveTypes.filter(lt => !existingTypeIds.has(lt.id));

    if (missingTypes.length > 0) {
      const balancesToCreate = missingTypes.map(lt => ({
        userId,
        leaveTypeId: lt.id,
        // EML: occurrence-based, cap at 3 per year
        totalDays: lt.occurrenceBased ? "3" : "0",
        usedDays: "0",
        year,
      }));
      const created = await db.insert(leaveBalances).values(balancesToCreate).returning();
      return [...existingBalances, ...created];
    }

    if (existingBalances.length > 0) return existingBalances;
    return [];
  }

  async getUserMonthlyHours(userId: string, year: number, month: number): Promise<number> {
    const monthStr = String(month).padStart(2, "0");
    const prefix = `${year}-${monthStr}`;
    const records = await db.select().from(attendance).where(
      and(
        eq(attendance.userId, userId),
        sql`${attendance.date} LIKE ${prefix + '%'}`
      )
    );
    let totalHours = 0;
    for (const rec of records) {
      if (rec.totalHours) {
        totalHours += parseFloat(rec.totalHours);
      } else if (rec.punchIn && rec.punchOut) {
        const diff = new Date(rec.punchOut).getTime() - new Date(rec.punchIn).getTime();
        totalHours += diff / (1000 * 60 * 60);
      }
    }
    return Math.round(totalHours * 100) / 100;
  }

  async accrueMonthlyLeaves(year: number, month: number): Promise<{
    usersProcessed: number;
    accrualsMade: number;
    skippedUsers: Array<{ name: string; reason: string; leaveTypeName: string }>;
    processedDetails: Array<{ userId: string; email: string; name: string; leaveTypeName: string; accruedDays: number; accrualType: string; newBalance: number }>;
    runAt: string;
    year: number;
    month: number;
  }> {
    // EL bonus months: January(1), May(5), September(9) → credit 2 days instead of 1
    const EL_BONUS_MONTHS = [1, 5, 9];
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = new Date();

    const activeUsers = await db.select().from(adminUsers).where(eq(adminUsers.isActive, true));
    const activeLeaveTypesList = await db.select().from(leaveTypes).where(eq(leaveTypes.isActive, true));

    let usersProcessed = 0;
    let accrualsMade = 0;
    const skippedUsers: Array<{ name: string; reason: string; leaveTypeName: string }> = [];
    const processedDetails: Array<{ userId: string; email: string; name: string; leaveTypeName: string; accruedDays: number; accrualType: string; newBalance: number }> = [];

    for (const user of activeUsers) {
      const joiningDate = user.joiningDate ? new Date(user.joiningDate) : null;
      if (joiningDate) {
        const joiningYear = joiningDate.getFullYear();
        const joiningMonth = joiningDate.getMonth() + 1;
        if (year < joiningYear || (year === joiningYear && month < joiningMonth)) {
          continue;
        }
      }

      // 30-day minimum employment check applies to all leave types
      const employedForThirtyDays = joiningDate
        ? (now.getTime() - joiningDate.getTime()) >= THIRTY_DAYS_MS
        : true;

      let userBalances = await this.getLeaveBalances(user.id, year);
      if (userBalances.length === 0) {
        userBalances = await this.initLeaveBalances(user.id, year);
      }

      const hoursWorked = await this.getUserMonthlyHours(user.id, year, month);
      let userAccrued = false;
      const userName = `${user.firstName} ${user.lastName || ""}`.trim();

      for (const lt of activeLeaveTypesList) {
        const monthlyRate = parseFloat(lt.monthlyAccrual || "0");
        if (monthlyRate <= 0) continue;

        // 30-day employment check applies to all leave types
        if (!employedForThirtyDays) {
          skippedUsers.push({ name: userName, reason: "Employment < 30 days", leaveTypeName: lt.name });
          await db.insert(leaveAccruals).values({
            userId: user.id, leaveTypeId: lt.id, year, month,
            accruedDays: "0", hoursWorked: String(hoursWorked),
            qualified: false, accrualType: "monthly",
            skipReason: "Employment < 30 days",
          }).onConflictDoNothing();
          continue;
        }

        let daysToCredit = monthlyRate;
        let accrualType = "monthly";

        if (lt.isConditional) {
          // EL: conditional on hours worked threshold (exempt users bypass this check)
          if (!user.attendanceExempt) {
            const minHours = parseFloat(lt.minHoursForAccrual || "128");
            if (hoursWorked < minHours) {
              skippedUsers.push({
                name: userName,
                reason: `Hours worked (${hoursWorked}h) below required (${minHours}h)`,
                leaveTypeName: lt.name,
              });
              await db.insert(leaveAccruals).values({
                userId: user.id, leaveTypeId: lt.id, year, month,
                accruedDays: "0", hoursWorked: String(hoursWorked),
                qualified: false, accrualType: "monthly",
                skipReason: `Hours ${hoursWorked}h < ${minHours}h threshold`,
              }).onConflictDoNothing();
              continue;
            }
          }
          // EL bonus months: Jan(1), May(5), Sep(9) get +1 extra day
          if (EL_BONUS_MONTHS.includes(month)) {
            daysToCredit = monthlyRate + 1;
            accrualType = "monthly+bonus";
          }
        } else {
          // SL (isConditional=false, unconditional): cap annual total to exactly 8 days.
          // 0.67 × 12 = 8.04 so we check how much has already been credited this year
          // and reduce the credit so the full-year total never exceeds 8.
          const SL_ANNUAL_CAP = 8;
          const yearAccruals = await db.select().from(leaveAccruals).where(
            and(
              eq(leaveAccruals.userId, user.id),
              eq(leaveAccruals.leaveTypeId, lt.id),
              eq(leaveAccruals.year, year),
              eq(leaveAccruals.qualified, true),
            )
          );
          const alreadyCredited = yearAccruals.reduce((sum, a) => sum + parseFloat(a.accruedDays), 0);
          const allowedCredit = Math.max(0, SL_ANNUAL_CAP - alreadyCredited);
          if (allowedCredit <= 0) {
            skippedUsers.push({ name: userName, reason: `Annual SL cap (${SL_ANNUAL_CAP}) already reached`, leaveTypeName: lt.name });
            await db.insert(leaveAccruals).values({
              userId: user.id, leaveTypeId: lt.id, year, month,
              accruedDays: "0", hoursWorked: String(hoursWorked),
              qualified: false, accrualType: "monthly",
              skipReason: `SL annual cap of ${SL_ANNUAL_CAP} days already reached`,
            }).onConflictDoNothing();
            continue;
          }
          // Credit exactly what remains up to the cap (handles Dec catch-up or early-joiner rounding)
          daysToCredit = Math.min(daysToCredit, parseFloat(allowedCredit.toFixed(2)));
        }

        const inserted = await db.insert(leaveAccruals).values({
          userId: user.id, leaveTypeId: lt.id, year, month,
          accruedDays: String(daysToCredit),
          hoursWorked: String(hoursWorked),
          qualified: true,
          accrualType,
        }).onConflictDoNothing().returning();

        if (inserted.length === 0) continue; // Already processed this month

        let balance = userBalances.find(b => b.leaveTypeId === lt.id);
        if (!balance) {
          const [created] = await db.insert(leaveBalances).values({
            userId: user.id, leaveTypeId: lt.id,
            totalDays: "0", usedDays: "0", year,
          }).returning();
          balance = created;
          userBalances.push(created);
        }

        // No mid-year cap: EL cap of 45 days is applied at year-end only
        const newTotal = parseFloat(balance.totalDays) + daysToCredit;

        await db.update(leaveBalances)
          .set({ totalDays: String(newTotal), updatedAt: new Date() })
          .where(eq(leaveBalances.id, balance.id));

        accrualsMade++;
        userAccrued = true;
        processedDetails.push({ userId: user.id, email: user.email, name: userName, leaveTypeName: lt.name, accruedDays: daysToCredit, accrualType, newBalance: newTotal });
      }

      if (userAccrued) usersProcessed++;
    }

    const runAt = now.toISOString();

    // Store run log for HR audit
    await this.upsertSystemSetting("accrual_run_log_latest", { year, month, runAt, usersProcessed, accrualsMade, skippedCount: skippedUsers.length, skippedUsers, processedDetails });
    const histSetting = await this.getSystemSetting("accrual_run_log_history");
    const hist = (histSetting?.value as any[]) || [];
    hist.unshift({ year, month, runAt, usersProcessed, accrualsMade, skippedCount: skippedUsers.length });
    await this.upsertSystemSetting("accrual_run_log_history", hist.slice(0, 24));

    return { usersProcessed, accrualsMade, skippedUsers, processedDetails, runAt, year, month };
  }

  async runYearEndBatch(year: number): Promise<{
    processed: number;
    elCarried: number;
    slLapsed: number;
    coCleared: number;
    details: Array<{ userId: string; email: string; name: string; leaveTypeName: string; action: string; days: number }>;
  }> {
    const activeUsers = await db.select().from(adminUsers).where(eq(adminUsers.isActive, true));
    const allLeaveTypes = await db.select().from(leaveTypes).where(eq(leaveTypes.isActive, true));

    let processed = 0;
    let elCarried = 0;
    let slLapsed = 0;
    let coCleared = 0;
    const details: Array<{ userId: string; email: string; name: string; leaveTypeName: string; action: string; days: number }> = [];
    // Cap events: when EL carry-forward is limited by the carryForwardCap (excess forfeited)
    const capEvents: Array<{ userId: string; name: string; leaveTypeName: string; remaining: number; cap: number; forfeited: number }> = [];

    for (const user of activeUsers) {
      const balances = await this.getLeaveBalances(user.id, year);
      const userName = `${user.firstName} ${user.lastName || ""}`.trim();

      for (const lt of allLeaveTypes) {
        const balance = balances.find(b => b.leaveTypeId === lt.id);
        if (!balance) continue;

        const totalDays = parseFloat(balance.totalDays);
        const usedDays = parseFloat(balance.usedDays);
        const remaining = Math.max(0, totalDays - usedDays);

        const isEL = !!lt.isConditional && (lt.carryForwardCap || 0) > 0;
        const isCO = lt.name.toLowerCase().includes("comp") || lt.name.toLowerCase().includes("compensatory");
        // Explicitly exclude LWP from isSL so it is never processed by year-end lapse
        const isSL = !lt.isConditional && !isCO && !(/lwp|loss.?of.?pay/i.test(lt.name));

        if (isEL) {
          const cap = lt.carryForwardCap || 45;
          const carryForward = Math.min(remaining, cap);
          // Record a cap event if the employee had more than the cap — excess is forfeited
          if (remaining > cap) {
            capEvents.push({ userId: user.id, name: userName, leaveTypeName: lt.name, remaining, cap, forfeited: remaining - cap });
          }
          const nextYear = year + 1;

          // IDEMPOTENCY CHECK: skip if year-end carry-forward already exists for this user+type+year
          const existingCarryForward = await db.select().from(leaveAccruals).where(
            and(
              eq(leaveAccruals.userId, user.id),
              eq(leaveAccruals.leaveTypeId, lt.id),
              eq(leaveAccruals.year, nextYear),
              eq(leaveAccruals.month, 0),
              sql`${leaveAccruals.accrualType} = 'year_end_carry_forward'`
            )
          ).limit(1);

          if (existingCarryForward.length > 0) {
            // Already processed — report the existing carry-forward value
            details.push({ userId: user.id, email: user.email, name: userName, leaveTypeName: lt.name, action: "carry_forward_skipped", days: parseFloat(existingCarryForward[0].accruedDays) });
            elCarried++;
            continue;
          }

          // Create or update next year balance with carry-forward
          const nextYearBalances = await this.getLeaveBalances(user.id, nextYear);
          const nextBalance = nextYearBalances.find(b => b.leaveTypeId === lt.id);
          if (!nextBalance) {
            await db.insert(leaveBalances).values({
              userId: user.id, leaveTypeId: lt.id,
              totalDays: String(carryForward), usedDays: "0", year: nextYear,
            });
          } else {
            await db.update(leaveBalances)
              .set({ totalDays: String(parseFloat(nextBalance.totalDays) + carryForward), updatedAt: new Date() })
              .where(eq(leaveBalances.id, nextBalance.id));
          }

          await db.insert(leaveAccruals).values({
            userId: user.id, leaveTypeId: lt.id, year: nextYear, month: 0,
            accruedDays: String(carryForward), hoursWorked: "0", qualified: true,
            accrualType: "year_end_carry_forward",
            skipReason: `Carried from ${year}: ${remaining.toFixed(2)} remaining, cap ${cap}`,
          }).onConflictDoNothing();

          details.push({ userId: user.id, email: user.email, name: userName, leaveTypeName: lt.name, action: "carry_forward", days: carryForward });
          elCarried++;
        } else if (isSL) {
          // SL lapses fully on Dec 31 (unconditional, no carry-forward)
          if (remaining > 0) {
            // IDEMPOTENCY CHECK: skip if SL lapse already recorded for this user+type+year
            const existingSLLapse = await db.select().from(leaveAccruals).where(
              and(
                eq(leaveAccruals.userId, user.id),
                eq(leaveAccruals.leaveTypeId, lt.id),
                eq(leaveAccruals.year, year),
                eq(leaveAccruals.month, 12),
                sql`${leaveAccruals.accrualType} = 'year_end_lapse'`
              )
            ).limit(1);

            if (existingSLLapse.length === 0) {
              await db.insert(leaveAccruals).values({
                userId: user.id, leaveTypeId: lt.id, year, month: 12,
                accruedDays: String(-remaining), hoursWorked: "0", qualified: true,
                accrualType: "year_end_lapse",
                skipReason: `${remaining.toFixed(2)} SL days lapsed Dec 31, ${year}`,
              }).onConflictDoNothing();

              // Reconcile leave_balances so the current year shows zero remaining
              await db.update(leaveBalances)
                .set({ usedDays: String(parseFloat(balance.usedDays) + remaining), updatedAt: new Date() })
                .where(eq(leaveBalances.id, balance.id));
            }
          }
          details.push({ userId: user.id, email: user.email, name: userName, leaveTypeName: lt.name, action: "lapse", days: remaining });
          slLapsed++;
        } else if (isCO) {
          // Comp-Off: expire only accruals older than 30 days (age-based, not blanket year-end)
          const thirtyDaysAgo = new Date(new Date(year, 11, 31).getTime() - 30 * 24 * 60 * 60 * 1000);

          // IDEMPOTENCY CHECK: skip if CO lapse already recorded for this user+type+year
          const existingCOLapse = await db.select().from(leaveAccruals).where(
            and(
              eq(leaveAccruals.userId, user.id),
              eq(leaveAccruals.leaveTypeId, lt.id),
              eq(leaveAccruals.year, year),
              eq(leaveAccruals.month, 12),
              sql`${leaveAccruals.accrualType} = 'year_end_lapse'`
            )
          ).limit(1);

          if (existingCOLapse.length === 0) {
            const oldCoAccruals = await db.select().from(leaveAccruals).where(
              and(
                eq(leaveAccruals.userId, user.id),
                eq(leaveAccruals.leaveTypeId, lt.id),
                eq(leaveAccruals.qualified, true),
                sql`${leaveAccruals.createdAt} < ${thirtyDaysAgo.toISOString()}`,
                sql`CAST(${leaveAccruals.accruedDays} AS NUMERIC) > 0`
              )
            );
            const oldCoTotal = oldCoAccruals.reduce((sum, a) => sum + parseFloat(a.accruedDays), 0);
            const usedDays = parseFloat(balance.usedDays);
            const oldCoRemaining = Math.max(0, oldCoTotal - usedDays);
            if (oldCoRemaining > 0) {
              await db.insert(leaveAccruals).values({
                userId: user.id, leaveTypeId: lt.id, year, month: 12,
                accruedDays: String(-oldCoRemaining), hoursWorked: "0", qualified: true,
                accrualType: "year_end_lapse",
                skipReason: `${oldCoRemaining.toFixed(2)} Comp-Off days >30 days old expired Dec 31, ${year}`,
              }).onConflictDoNothing();

              // Reconcile leave_balances so expired CO shows zero remaining
              await db.update(leaveBalances)
                .set({ usedDays: String(usedDays + oldCoRemaining), updatedAt: new Date() })
                .where(eq(leaveBalances.id, balance.id));

              details.push({ userId: user.id, email: user.email, name: userName, leaveTypeName: lt.name, action: "co_expire", days: oldCoRemaining });
              coCleared++;
            }
          }
        }
      }
      processed++;
    }

    const histSetting = await this.getSystemSetting("year_end_batch_log");
    const hist = (histSetting?.value as any[]) || [];
    hist.unshift({ year, runAt: new Date().toISOString(), processed, elCarried, slLapsed, coCleared, capEvents });
    await this.upsertSystemSetting("year_end_batch_log", hist.slice(0, 5));

    return { processed, elCarried, slLapsed, coCleared, capEvents, details };
  }

  async countLeaveDays(startDate: string, endDate: string): Promise<number> {
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    if (start > end) return 0;

    const allHolidays = await db.select().from(holidays).where(
      and(
        eq(holidays.isOptional, false),
        sql`${holidays.date} >= ${startDate} AND ${holidays.date} <= ${endDate}`
      )
    );
    const holidayDates = new Set(allHolidays.map(h => h.date));

    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split("T")[0];
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  async getLeaveAccrualsByUser(userId: string, year?: number): Promise<LeaveAccrual[]> {
    const baseCondition = eq(leaveAccruals.userId, userId);
    const whereClause = year ? and(baseCondition, eq(leaveAccruals.year, year)) : baseCondition;
    return await db.select().from(leaveAccruals)
      .where(whereClause)
      .orderBy(desc(leaveAccruals.year), desc(leaveAccruals.month));
  }

  // ==========================================
  // HR PORTAL: Leave Requests
  // ==========================================

  async getLeaveRequests(filters?: { userId?: string; status?: string }): Promise<LeaveRequest[]> {
    const conditions: any[] = [];
    if (filters?.userId) {
      conditions.push(eq(leaveRequests.userId, filters.userId));
    }
    if (filters?.status) {
      conditions.push(eq(leaveRequests.status, filters.status as any));
    }
    if (conditions.length > 0) {
      return db.select().from(leaveRequests)
        .where(and(...conditions))
        .orderBy(desc(leaveRequests.createdAt));
    }
    return db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
  }

  async getLeaveRequest(id: string): Promise<LeaveRequest | undefined> {
    const [lr] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return lr;
  }

  async createLeaveRequest(lr: InsertLeaveRequest): Promise<LeaveRequest> {
    const [created] = await db.insert(leaveRequests).values(lr).returning();
    return created;
  }

  async updateLeaveRequest(id: string, lr: Partial<LeaveRequest>): Promise<LeaveRequest | undefined> {
    const [updated] = await db.update(leaveRequests)
      .set({ ...lr, updatedAt: new Date() })
      .where(eq(leaveRequests.id, id))
      .returning();
    return updated;
  }

  async getLeaveRequestsByTeam(userIds: string[]): Promise<LeaveRequest[]> {
    if (userIds.length === 0) return [];
    return db.select().from(leaveRequests)
      .where(inArray(leaveRequests.userId, userIds))
      .orderBy(desc(leaveRequests.createdAt));
  }

  async isUserOnLeaveToday(userId: string): Promise<boolean> {
    const today = new Date().toISOString().split("T")[0];
    const [result] = await db.select().from(leaveRequests)
      .where(and(
        eq(leaveRequests.userId, userId),
        eq(leaveRequests.status, "approved"),
        lte(leaveRequests.startDate, today),
        gte(leaveRequests.endDate, today)
      ))
      .limit(1);
    return !!result;
  }

  // ==========================================
  // HR PORTAL: Tickets
  // ==========================================

  async getTickets(filters?: { userId?: string; status?: string }): Promise<Ticket[]> {
    const conditions: any[] = [];
    if (filters?.userId) {
      conditions.push(eq(tickets.userId, filters.userId));
    }
    if (filters?.status) {
      conditions.push(eq(tickets.status, filters.status as any));
    }
    if (conditions.length > 0) {
      return db.select().from(tickets)
        .where(and(...conditions))
        .orderBy(desc(tickets.createdAt));
    }
    return db.select().from(tickets).orderBy(desc(tickets.createdAt));
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const [t] = await db.select().from(tickets).where(eq(tickets.id, id));
    return t;
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const [created] = await db.insert(tickets).values(ticket).returning();
    return created;
  }

  async updateTicket(id: string, ticket: Partial<Ticket>): Promise<Ticket | undefined> {
    const [updated] = await db.update(tickets)
      .set({ ...ticket, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    return updated;
  }

  // ==========================================
  // Stats
  // ==========================================

  async getStats() {
    const [jobStats] = await db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${jobs.isActive} = true)::int`,
    }).from(jobs);

    const [appStats] = await db.select({
      total: sql<number>`count(*)::int`,
      newCount: sql<number>`count(*) filter (where ${applications.status} = 'new')::int`,
    }).from(applications);

    const [contactStats] = await db.select({
      total: sql<number>`count(*)::int`,
      newCount: sql<number>`count(*) filter (where ${contacts.status} = 'new')::int`,
    }).from(contacts);

    return {
      totalJobs: jobStats?.total ?? 0,
      activeJobs: jobStats?.active ?? 0,
      totalApplications: appStats?.total ?? 0,
      newApplications: appStats?.newCount ?? 0,
      totalContacts: contactStats?.total ?? 0,
      newContacts: contactStats?.newCount ?? 0,
    };
  }

  // ==========================================
  // AUDIT LOGS
  // ==========================================

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogs(filters?: { actorId?: string; targetId?: string; action?: string; limit?: number; offset?: number }): Promise<AuditLog[]> {
    const conditions = [];
    if (filters?.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
    if (filters?.targetId) conditions.push(eq(auditLogs.targetId, filters.targetId));
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));

    const query = db.select().from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(filters?.limit ?? 100)
      .offset(filters?.offset ?? 0);

    return query;
  }

  async getAuditLogCount(filters?: { actorId?: string; targetId?: string; action?: string }): Promise<number> {
    const conditions = [];
    if (filters?.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
    if (filters?.targetId) conditions.push(eq(auditLogs.targetId, filters.targetId));
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));

    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return result?.count ?? 0;
  }

  // ==========================================
  // SALARY SLIPS
  // ==========================================

  async getSalarySlipsByUser(userId: string, year?: number): Promise<SalarySlip[]> {
    const conditions = [eq(salarySlips.userId, userId)];
    if (year) conditions.push(eq(salarySlips.year, year));
    return db.select().from(salarySlips)
      .where(and(...conditions))
      .orderBy(desc(salarySlips.year), desc(salarySlips.month));
  }

  async getSalarySlip(id: string): Promise<SalarySlip | undefined> {
    const [slip] = await db.select().from(salarySlips).where(eq(salarySlips.id, id));
    return slip;
  }

  async createSalarySlip(slip: InsertSalarySlip): Promise<SalarySlip> {
    const [created] = await db.insert(salarySlips).values(slip).returning();
    return created;
  }

  async getSalarySlipsByMonth(year: number, month: number): Promise<SalarySlip[]> {
    return db.select().from(salarySlips)
      .where(and(eq(salarySlips.year, year), eq(salarySlips.month, month)));
  }

  // ==========================================
  // LEAVE ADJUSTMENTS
  // ==========================================

  async createLeaveAdjustment(adj: InsertLeaveAdjustment): Promise<LeaveAdjustment> {
    const [created] = await db.insert(leaveAdjustments).values(adj).returning();
    return created;
  }

  async getLeaveAdjustments(filters?: { userId?: string; year?: number }): Promise<LeaveAdjustment[]> {
    const conditions = [];
    if (filters?.userId) conditions.push(eq(leaveAdjustments.userId, filters.userId));
    if (filters?.year) conditions.push(eq(leaveAdjustments.year, filters.year));
    return db.select().from(leaveAdjustments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leaveAdjustments.createdAt));
  }

  // ==========================================
  // EMPLOYEE DOCUMENTS
  // ==========================================

  async getEmployeeDocuments(userId: string): Promise<EmployeeDocument[]> {
    return db.select().from(employeeDocuments)
      .where(eq(employeeDocuments.userId, userId))
      .orderBy(asc(employeeDocuments.category), asc(employeeDocuments.documentType));
  }

  async getEmployeeDocument(id: string): Promise<EmployeeDocument | undefined> {
    const [doc] = await db.select().from(employeeDocuments).where(eq(employeeDocuments.id, id));
    return doc;
  }

  async createEmployeeDocument(doc: InsertEmployeeDocument): Promise<EmployeeDocument> {
    const [created] = await db.insert(employeeDocuments).values(doc).returning();
    return created;
  }

  async updateEmployeeDocument(id: string, updates: Partial<EmployeeDocument>): Promise<EmployeeDocument | undefined> {
    const [updated] = await db.update(employeeDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(employeeDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteEmployeeDocument(id: string): Promise<boolean> {
    const result = await db.delete(employeeDocuments).where(eq(employeeDocuments.id, id));
    return true;
  }

  async initializeEmployeeDocuments(userId: string): Promise<EmployeeDocument[]> {
    const docTypes = [
      { category: "identity", documentType: "aadhaar", isRequired: true },
      { category: "identity", documentType: "pan", isRequired: true },
      { category: "identity", documentType: "passport", isRequired: false },
      { category: "identity", documentType: "voter_id_dl", isRequired: false },
      { category: "education", documentType: "10th_marksheet", isRequired: true },
      { category: "education", documentType: "12th_marksheet", isRequired: true },
      { category: "education", documentType: "graduation_cert", isRequired: true },
      { category: "education", documentType: "postgrad_cert", isRequired: false },
      { category: "employment", documentType: "relieving_letter", isRequired: true },
      { category: "employment", documentType: "salary_slips_prev", isRequired: true },
      { category: "employment", documentType: "form16", isRequired: false },
      { category: "bank", documentType: "cancelled_cheque", isRequired: true },
    ];

    const created: EmployeeDocument[] = [];
    for (const dt of docTypes) {
      const [doc] = await db.insert(employeeDocuments).values({
        userId,
        category: dt.category,
        documentType: dt.documentType,
        isRequired: dt.isRequired,
        status: "pending",
      }).returning();
      created.push(doc);
    }
    return created;
  }

  async getAllEmployeeDocuments(): Promise<EmployeeDocument[]> {
    return db.select().from(employeeDocuments)
      .orderBy(asc(employeeDocuments.userId), asc(employeeDocuments.category));
  }

  // ==========================================
  // EMPLOYEE BANK DETAILS
  // ==========================================

  async getBankDetails(userId: string): Promise<EmployeeBankDetails | undefined> {
    const [details] = await db.select().from(employeeBankDetails)
      .where(eq(employeeBankDetails.userId, userId));
    return details;
  }

  async upsertBankDetails(data: InsertEmployeeBankDetails): Promise<EmployeeBankDetails> {
    const existing = await this.getBankDetails(data.userId);
    if (existing) {
      const [updated] = await db.update(employeeBankDetails)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(employeeBankDetails.userId, data.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(employeeBankDetails).values(data).returning();
    return created;
  }

  // ==========================================
  // EMPLOYEE EMERGENCY CONTACTS
  // ==========================================

  async getEmergencyContacts(userId: string): Promise<EmployeeEmergencyContact[]> {
    return db.select().from(employeeEmergencyContacts)
      .where(eq(employeeEmergencyContacts.userId, userId))
      .orderBy(desc(employeeEmergencyContacts.isPrimary), asc(employeeEmergencyContacts.createdAt));
  }

  async createEmergencyContact(contact: InsertEmployeeEmergencyContact): Promise<EmployeeEmergencyContact> {
    const [created] = await db.insert(employeeEmergencyContacts).values(contact).returning();
    return created;
  }

  async updateEmergencyContact(id: string, updates: Partial<EmployeeEmergencyContact>): Promise<EmployeeEmergencyContact | undefined> {
    const [updated] = await db.update(employeeEmergencyContacts)
      .set(updates)
      .where(eq(employeeEmergencyContacts.id, id))
      .returning();
    return updated;
  }

  async deleteEmergencyContact(id: string): Promise<boolean> {
    await db.delete(employeeEmergencyContacts).where(eq(employeeEmergencyContacts.id, id));
    return true;
  }

  // ==========================================
  // SYSTEM SETTINGS
  // ==========================================

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings)
      .where(eq(systemSettings.key, key));
    return setting;
  }

  async upsertSystemSetting(key: string, value: any, updatedBy?: string): Promise<SystemSetting> {
    const existing = await this.getSystemSetting(key);
    if (existing) {
      const [updated] = await db.update(systemSettings)
        .set({ value, updatedAt: new Date(), updatedBy: updatedBy || null })
        .where(eq(systemSettings.key, key))
        .returning();
      return updated;
    }
    const [created] = await db.insert(systemSettings)
      .values({ key, value, updatedBy: updatedBy || null })
      .returning();
    return created;
  }

  // ==========================================
  // OFFER LETTERS
  // ==========================================

  async createOfferLetter(data: InsertOfferLetter): Promise<OfferLetter> {
    const [created] = await db.insert(offerLetters).values(data).returning();
    return created;
  }

  async getOfferLetterByToken(token: string): Promise<OfferLetter | undefined> {
    const [letter] = await db.select().from(offerLetters)
      .where(eq(offerLetters.token, token));
    return letter;
  }

  async getOfferLetter(id: string): Promise<OfferLetter | undefined> {
    const [letter] = await db.select().from(offerLetters)
      .where(eq(offerLetters.id, id));
    return letter;
  }

  async updateOfferLetter(id: string, updates: Partial<OfferLetter>): Promise<OfferLetter | undefined> {
    const [updated] = await db.update(offerLetters)
      .set(updates)
      .where(eq(offerLetters.id, id))
      .returning();
    return updated;
  }

  async getOfferLetters(): Promise<OfferLetter[]> {
    return db.select().from(offerLetters)
      .orderBy(desc(offerLetters.createdAt));
  }

  async createAddendum(data: InsertOfferLetterAddendum): Promise<OfferLetterAddendum> {
    const [created] = await db.insert(offerLetterAddendums).values(data).returning();
    return created;
  }

  async getAddendumsForOffer(offerLetterId: string): Promise<OfferLetterAddendum[]> {
    return db.select().from(offerLetterAddendums)
      .where(eq(offerLetterAddendums.offerLetterId, offerLetterId))
      .orderBy(desc(offerLetterAddendums.createdAt));
  }

  async getAddendumByToken(token: string): Promise<OfferLetterAddendum | undefined> {
    const [addendum] = await db.select().from(offerLetterAddendums)
      .where(eq(offerLetterAddendums.token, token));
    return addendum;
  }

  async getAddendum(id: string): Promise<OfferLetterAddendum | undefined> {
    const [addendum] = await db.select().from(offerLetterAddendums)
      .where(eq(offerLetterAddendums.id, id));
    return addendum;
  }

  async updateAddendumStatus(id: string, updates: Partial<OfferLetterAddendum>): Promise<OfferLetterAddendum | undefined> {
    const [updated] = await db.update(offerLetterAddendums)
      .set(updates)
      .where(eq(offerLetterAddendums.id, id))
      .returning();
    return updated;
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(data).returning();
    return notification;
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async createHrLetter(data: InsertHrLetter): Promise<HrLetter> {
    const [created] = await db.insert(hrLetters).values(data).returning();
    return created;
  }

  async getHrLetter(id: string): Promise<HrLetter | undefined> {
    const [letter] = await db.select().from(hrLetters).where(eq(hrLetters.id, id));
    return letter;
  }

  async updateHrLetter(id: string, updates: Partial<HrLetter>): Promise<HrLetter | undefined> {
    const [updated] = await db.update(hrLetters)
      .set(updates)
      .where(eq(hrLetters.id, id))
      .returning();
    return updated;
  }

  async getHrLetters(filters?: { templateType?: string; status?: string; search?: string }): Promise<HrLetter[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.templateType) {
      conditions.push(sql`${hrLetters.templateType} = ${filters.templateType}`);
    }
    if (filters?.status) {
      conditions.push(sql`${hrLetters.status} = ${filters.status}`);
    }
    let results = conditions.length > 0
      ? await db.select().from(hrLetters).where(and(...conditions)).orderBy(desc(hrLetters.createdAt))
      : await db.select().from(hrLetters).orderBy(desc(hrLetters.createdAt));
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      results = results.filter(l =>
        l.employeeName.toLowerCase().includes(s) ||
        l.employeeCode?.toLowerCase().includes(s) ||
        l.referenceNumber?.toLowerCase().includes(s)
      );
    }
    return results;
  }

  async getHrLetterByRef(referenceNumber: string): Promise<HrLetter | undefined> {
    const [letter] = await db.select().from(hrLetters)
      .where(eq(hrLetters.referenceNumber, referenceNumber));
    return letter;
  }

  async getHrLetterByRefAndAuth(referenceNumber: string, authCode: string): Promise<HrLetter | undefined> {
    const [letter] = await db.select().from(hrLetters)
      .where(and(eq(hrLetters.referenceNumber, referenceNumber), eq(hrLetters.authCode, authCode)));
    return letter;
  }

  async getHrLetterCountByPrefix(prefix: string): Promise<number> {
    const results = await db.select({ refNum: hrLetters.referenceNumber }).from(hrLetters)
      .where(sql`${hrLetters.referenceNumber} LIKE ${prefix + '%'}`);
    return results.length;
  }

  async getLetterTemplateSentences(category?: string): Promise<LetterTemplateSentence[]> {
    if (category) {
      return db.select().from(letterTemplateSentences)
        .where(eq(letterTemplateSentences.category, category))
        .orderBy(asc(letterTemplateSentences.sortOrder));
    }
    return db.select().from(letterTemplateSentences)
      .orderBy(asc(letterTemplateSentences.category), asc(letterTemplateSentences.sortOrder));
  }

  async updateLetterTemplateSentence(id: string, updates: { sentence: string }): Promise<LetterTemplateSentence | undefined> {
    const [updated] = await db.update(letterTemplateSentences)
      .set({ sentence: updates.sentence, updatedAt: new Date() })
      .where(eq(letterTemplateSentences.id, id))
      .returning();
    return updated;
  }

  async getRoleSummaryTemplates(filters?: { vertical?: string; designation?: string }): Promise<RoleSummaryTemplate[]> {
    let results = await db.select().from(roleSummaryTemplates)
      .where(eq(roleSummaryTemplates.isActive, true))
      .orderBy(asc(roleSummaryTemplates.sortOrder));

    if (filters?.designation) {
      const designation = filters.designation.toLowerCase();
      const matched = results.filter(r => r.roleLabel.toLowerCase() === designation);
      if (matched.length > 0) return matched;
    }
    if (filters?.vertical) {
      return results.filter(r => r.vertical === filters.vertical);
    }
    return results;
  }
}

export const storage = new DatabaseStorage();
