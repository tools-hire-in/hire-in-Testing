import { db } from "./db";
import { eq, desc, and, ilike, or, sql, gte, lte, asc, inArray } from "drizzle-orm";
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
} from "@shared/schema";

export interface IStorage {
  // Jobs
  getJobs(filters?: { search?: string; specialty?: string; state?: string; jobType?: string }): Promise<Job[]>;
  getActiveJobs(filters?: { search?: string; specialty?: string; state?: string; jobType?: string }): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  createJobs(jobList: InsertJob[]): Promise<Job[]>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;
  deleteJobs(ids: string[]): Promise<number>;
  updateJobsBulk(ids: string[], updates: Partial<InsertJob>): Promise<number>;
  getJobFilters(): Promise<{ specialties: string[]; states: string[]; jobTypes: string[] }>;

  // Applications
  getApplications(): Promise<Application[]>;
  getApplication(id: string): Promise<Application | undefined>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: string, app: Partial<Application>): Promise<Application | undefined>;

  // Contacts
  getContacts(): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<Contact>): Promise<Contact | undefined>;

  // Admin Users
  getAdminUsers(): Promise<AdminUser[]>;
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  createAdminUser(user: InsertAdminUser): Promise<AdminUser>;
  updateAdminUser(id: string, user: Partial<AdminUser>): Promise<AdminUser | undefined>;
  deleteAdminUser(id: string): Promise<boolean>;

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
  createRegionalHolidaySelection(data: InsertRegionalHolidaySelection): Promise<RegionalHolidaySelection>;
  deleteRegionalHolidaySelection(id: string, userId?: string): Promise<boolean>;

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
  accrueMonthlyLeaves(year: number, month: number): Promise<{ usersProcessed: number; accrualsMade: number; skippedUsers: Array<{ name: string; hoursWorked: number; requiredHours: number }> }>;

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

  // Offer Letters
  createOfferLetter(data: InsertOfferLetter): Promise<OfferLetter>;
  getOfferLetterByToken(token: string): Promise<OfferLetter | undefined>;
  getOfferLetter(id: string): Promise<OfferLetter | undefined>;
  updateOfferLetter(id: string, updates: Partial<OfferLetter>): Promise<OfferLetter | undefined>;
  getOfferLetters(): Promise<OfferLetter[]>;

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
  async getJobs(filters?: { search?: string; specialty?: string; state?: string; jobType?: string }): Promise<Job[]> {
    let query = db.select().from(jobs).orderBy(desc(jobs.createdAt));
    return query;
  }

  async getActiveJobs(filters?: { search?: string; specialty?: string; state?: string; jobType?: string }): Promise<Job[]> {
    const conditions = [eq(jobs.isActive, true)];
    
    if (filters?.specialty) {
      conditions.push(eq(jobs.specialty, filters.specialty));
    }
    if (filters?.state) {
      conditions.push(eq(jobs.state, filters.state));
    }
    if (filters?.jobType) {
      conditions.push(eq(jobs.jobType, filters.jobType));
    }

    let results = await db.select().from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt));

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(job => 
        job.title.toLowerCase().includes(searchLower) ||
        job.specialty?.toLowerCase().includes(searchLower) ||
        job.description?.toLowerCase().includes(searchLower)
      );
    }

    return results;
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

  async getJobFilters(): Promise<{ specialties: string[]; states: string[]; jobTypes: string[] }> {
    const allJobs = await db.select({
      specialty: jobs.specialty,
      state: jobs.state,
      jobType: jobs.jobType,
    }).from(jobs).where(eq(jobs.isActive, true));

    const specialties = Array.from(new Set(allJobs.map(j => j.specialty).filter((v): v is string => !!v)));
    const states = Array.from(new Set(allJobs.map(j => j.state).filter((v): v is string => !!v)));
    const jobTypeList = Array.from(new Set(allJobs.map(j => j.jobType).filter((v): v is string => !!v)));

    return { specialties: specialties.sort(), states: states.sort(), jobTypes: jobTypeList.sort() };
  }

  // Applications
  async getApplications(): Promise<Application[]> {
    return db.select().from(applications).orderBy(desc(applications.createdAt));
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
    const allUsers = await db.select().from(adminUsers).where(eq(adminUsers.isActive, true)).orderBy(adminUsers.firstName);
    const allDepts = await db.select().from(departments).where(eq(departments.isActive, true)).orderBy(departments.name);
    return { users: allUsers, departments: allDepts };
  }

  async getTeamMembers(managerId: string): Promise<AdminUser[]> {
    return db.select().from(adminUsers).where(eq(adminUsers.managerId, managerId)).orderBy(adminUsers.firstName);
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
    return db.select().from(attendance)
      .where(and(inArray(attendance.userId, userIds), eq(attendance.date, date)))
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
    if (existingBalances.length > 0) return existingBalances;

    const activeLeaveTypes = await db.select().from(leaveTypes).where(eq(leaveTypes.isActive, true));
    const balancesToCreate = activeLeaveTypes.map(lt => ({
      userId,
      leaveTypeId: lt.id,
      totalDays: "0",
      usedDays: "0",
      year,
    }));

    if (balancesToCreate.length === 0) return [];
    const created = await db.insert(leaveBalances).values(balancesToCreate).returning();
    return created;
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

  async accrueMonthlyLeaves(year: number, month: number): Promise<{ usersProcessed: number; accrualsMade: number; skippedUsers: Array<{ name: string; hoursWorked: number; requiredHours: number }> }> {
    const activeUsers = await db.select().from(adminUsers).where(eq(adminUsers.isActive, true));
    const activeLeaveTypesList = await db.select().from(leaveTypes).where(eq(leaveTypes.isActive, true));

    let usersProcessed = 0;
    let accrualsMade = 0;
    const skippedUsers: Array<{ name: string; hoursWorked: number; requiredHours: number }> = [];

    for (const user of activeUsers) {
      const joiningDate = user.joiningDate ? new Date(user.joiningDate) : null;
      if (joiningDate) {
        const joiningYear = joiningDate.getFullYear();
        const joiningMonth = joiningDate.getMonth() + 1;
        if (year < joiningYear || (year === joiningYear && month < joiningMonth)) {
          continue;
        }
      }

      let userBalances = await this.getLeaveBalances(user.id, year);
      if (userBalances.length === 0) {
        userBalances = await this.initLeaveBalances(user.id, year);
      }

      const hoursWorked = await this.getUserMonthlyHours(user.id, year, month);
      let userAccrued = false;

      for (const lt of activeLeaveTypesList) {
        const monthlyRate = parseFloat(lt.monthlyAccrual || "0");
        if (monthlyRate <= 0) continue;

        const minHours = parseFloat(lt.minHoursForAccrual || "128");
        const qualified = hoursWorked >= minHours;

        const inserted = await db.insert(leaveAccruals).values({
          userId: user.id,
          leaveTypeId: lt.id,
          year,
          month,
          accruedDays: qualified ? String(monthlyRate) : "0",
          hoursWorked: String(hoursWorked),
          qualified,
        }).onConflictDoNothing().returning();

        if (inserted.length === 0) continue;

        if (qualified) {
          let balance = userBalances.find(b => b.leaveTypeId === lt.id);
          if (!balance) {
            const [created] = await db.insert(leaveBalances).values({
              userId: user.id,
              leaveTypeId: lt.id,
              totalDays: "0",
              usedDays: "0",
              year,
            }).returning();
            balance = created;
            userBalances.push(created);
          }
          const newTotal = parseFloat(balance.totalDays) + monthlyRate;
          const maxDays = lt.defaultDays;
          const cappedTotal = Math.min(newTotal, maxDays);
          await db.update(leaveBalances)
            .set({ totalDays: String(cappedTotal), updatedAt: new Date() })
            .where(eq(leaveBalances.id, balance.id));

          accrualsMade++;
          userAccrued = true;
        } else {
          skippedUsers.push({
            name: `${user.firstName} ${user.lastName || ""}`.trim(),
            hoursWorked,
            requiredHours: minHours,
          });
        }
      }

      if (userAccrued) usersProcessed++;
    }

    return { usersProcessed, accrualsMade, skippedUsers };
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
}

export const storage = new DatabaseStorage();
