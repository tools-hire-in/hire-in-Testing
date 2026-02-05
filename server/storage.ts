import { db } from "./db";
import { eq, desc, and, ilike, or, sql, gte, lte, asc } from "drizzle-orm";
import {
  jobs,
  applications,
  contacts,
  adminUsers,
  holidays,
  attendance,
  leaveTypes,
  leaveBalances,
  leaveRequests,
  tickets,
  type Job,
  type InsertJob,
  type Application,
  type InsertApplication,
  type Contact,
  type InsertContact,
  type AdminUser,
  type InsertAdminUser,
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
  type Ticket,
  type InsertTicket,
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

  // Holidays
  getHolidays(year?: number): Promise<Holiday[]>;
  getHoliday(id: string): Promise<Holiday | undefined>;
  createHoliday(holiday: InsertHoliday): Promise<Holiday>;
  updateHoliday(id: string, holiday: Partial<InsertHoliday>): Promise<Holiday | undefined>;
  deleteHoliday(id: string): Promise<boolean>;

  // Attendance
  getAttendanceByUser(userId: string, startDate?: string, endDate?: string): Promise<Attendance[]>;
  getAttendanceByDate(date: string): Promise<Attendance[]>;
  getTodayAttendance(userId: string): Promise<Attendance | undefined>;
  createAttendance(record: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, record: Partial<InsertAttendance>): Promise<Attendance | undefined>;

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

  // Leave Requests
  getLeaveRequests(filters?: { userId?: string; status?: string }): Promise<LeaveRequest[]>;
  getLeaveRequest(id: string): Promise<LeaveRequest | undefined>;
  createLeaveRequest(lr: InsertLeaveRequest): Promise<LeaveRequest>;
  updateLeaveRequest(id: string, lr: Partial<LeaveRequest>): Promise<LeaveRequest | undefined>;

  // Tickets
  getTickets(filters?: { userId?: string; status?: string }): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: string, ticket: Partial<Ticket>): Promise<Ticket | undefined>;

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
      totalDays: String(lt.defaultDays),
      usedDays: "0",
      year,
    }));

    if (balancesToCreate.length === 0) return [];
    const created = await db.insert(leaveBalances).values(balancesToCreate).returning();
    return created;
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
}

export const storage = new DatabaseStorage();
