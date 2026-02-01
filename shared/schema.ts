import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// User roles enum
export const userRoleEnum = pgEnum("user_role", ["super_admin", "admin", "hr", "operations", "employee"]);

// Admin users table (extends auth users with roles)
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  email: varchar("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default("employee"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Jobs table - stores all job postings from CSV uploads
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

// Relations
export const jobsRelations = relations(jobs, ({ many }) => ({
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  job: one(jobs, {
    fields: [applications.jobId],
    references: [jobs.id],
  }),
}));

// Zod schemas for validation
export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

// Types
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
