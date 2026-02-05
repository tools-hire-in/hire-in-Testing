import { db } from "./db";
import { eq, desc, and, ilike, or, sql } from "drizzle-orm";
import {
  jobs,
  applications,
  contacts,
  adminUsers,
  type Job,
  type InsertJob,
  type Application,
  type InsertApplication,
  type Contact,
  type InsertContact,
  type AdminUser,
  type InsertAdminUser,
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
    const result = await db.delete(jobs).where(eq(jobs.id, id));
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

    const specialties = [...new Set(allJobs.map(j => j.specialty).filter(Boolean))] as string[];
    const states = [...new Set(allJobs.map(j => j.state).filter(Boolean))] as string[];
    const jobTypes = [...new Set(allJobs.map(j => j.jobType).filter(Boolean))] as string[];

    return { specialties: specialties.sort(), states: states.sort(), jobTypes: jobTypes.sort() };
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

  // Stats
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
