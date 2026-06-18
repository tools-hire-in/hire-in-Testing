import { db } from "./db";
import { eq, desc, and, ilike, or, sql, gte, lte, asc, inArray, isNull, isNotNull, ne, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
  pendingChanges,
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
  contractClients,
  contractTemplates,
  contracts,
  contractInvoices,
  type ContractClient,
  type InsertContractClient,
  type ContractTemplate,
  type InsertContractTemplate,
  type Contract,
  type InsertContract,
  type ContractInvoice,
  type InsertContractInvoice,
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
  type PendingChange,
  type InsertPendingChange,
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
  attendanceRegularizations,
  type AttendanceRegularization,
  type InsertAttendanceRegularization,
  studioProjects,
  studioArticles,
  studioArticleVersions,
  studioAuthorProfiles,
  studioAuditEvents,
  studioArticleReactions,
  studioPromptTemplates,
  studioGenerations,
  studioReviewAssignments,
  studioNewsletterSubscribers,
  type StudioNewsletterSubscriber,
  type InsertStudioNewsletterSubscriber,
  type StudioProject,
  type InsertStudioProject,
  type StudioArticle,
  type InsertStudioArticle,
  type StudioArticleVersion,
  type InsertStudioArticleVersion,
  type StudioAuthorProfile,
  type InsertStudioAuthorProfile,
  type StudioAuditEvent,
  type InsertStudioAuditEvent,
  type StudioArticleReaction,
  cardTemplates,
  studioBrandSettings,
  type CardTemplate,
  type InsertCardTemplate,
  type StudioBrandSettings,
  type StudioPromptTemplate,
  type InsertStudioPromptTemplate,
  type StudioGeneration,
  type InsertStudioGeneration,
  type StudioReviewAssignment,
  type InsertStudioReviewAssignment,
} from "@shared/schema";

export interface StudioAnalytics {
  range: { dateFrom: string | null; dateTo: string | null };
  workflow: {
    publishedCount: number;
    medianDraftToPublishDays: number | null;
    slaRatePct: number | null;
    slaSampleSize: number;
    marketingRejectionRatePct: number | null;
    marketingDecisionCount: number;
  };
  audience: {
    views: number;
    ctaClicks: number;
    ctaRatePct: number | null;
    reactionsByType: { reactionType: string; count: number }[];
    totalReactions: number;
  };
  topArticles: { id: string; title: string; views: number; reactions: number; ctaClicks: number }[];
  authorLeaderboard: {
    authorProfileId: string | null;
    authorName: string;
    published: number;
    avgReactionsPerArticle: number;
  }[];
  categoryBreakdown: { category: string; published: number; avgViewsPerCategory: number }[];
  subscribers: { confirmed: number; newThisMonth: number };
}

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
  getOpenAttendance(userId: string): Promise<Attendance | undefined>;
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
  backfillLeaveAccruals(dryRun?: boolean): Promise<{
    employeesProcessed: number;
    skippedInactive: number;
    accrualRowsCreated: number;
    correctionRowsApplied: number;
    resolvedLeaveTypes: { el: { id: string; name: string }; sl: { id: string; name: string } };
    details: Array<{
      employeeId: string | null;
      name: string;
      joiningDate: string | null;
      firstAccrualMonth: string | null;
      isPartTime: boolean;
      elAdded: number;
      slAdded: number;
      correctionsApplied: number;
      monthsELSkipped: string[];
      monthsELMissingData: string[];
      newELBalance: number;
      newSLBalance: number;
    }>;
  }>;

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

  // Pending Changes (automated-job guardrail)
  proposePendingChange(change: InsertPendingChange): Promise<PendingChange | undefined>;
  getPendingChanges(filters?: { status?: string; sourceJob?: string; runDate?: string }): Promise<PendingChange[]>;
  getPendingChange(id: string): Promise<PendingChange | undefined>;
  countPendingChanges(status?: string): Promise<number>;
  approvePendingChange(id: string, reviewerId: string, note?: string): Promise<{ ok: boolean; reason?: string }>;
  rejectPendingChange(id: string, reviewerId: string, note?: string): Promise<{ ok: boolean; reason?: string }>;

  // Salary Slips
  getSalarySlipsByUser(userId: string, year?: number): Promise<SalarySlip[]>;
  getSalarySlip(id: string): Promise<SalarySlip | undefined>;
  createSalarySlip(slip: InsertSalarySlip): Promise<SalarySlip>;
  getSalarySlipsByMonth(year: number, month: number): Promise<SalarySlip[]>;
  upsertSalarySlip(slip: InsertSalarySlip & { userId: string; year: number; month: number }): Promise<SalarySlip>;

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
  initializeEmployeeDocuments(userId: string, employeeCategory?: string): Promise<EmployeeDocument[]>;
  updateDocumentRequiredStatusForCategory(userId: string, employeeCategory: string): Promise<void>;
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
  getStandaloneAddendums(): Promise<OfferLetterAddendum[]>;
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

  // Attendance Regularizations
  createRegularizationRequest(data: InsertAttendanceRegularization): Promise<AttendanceRegularization>;
  getRegularizationRequests(filters?: { employeeId?: string; managerTeamIds?: string[]; status?: string; startDate?: string; endDate?: string }): Promise<AttendanceRegularization[]>;
  getRegularizationRequest(id: string): Promise<AttendanceRegularization | undefined>;
  updateRegularizationRequest(id: string, updates: Partial<AttendanceRegularization>): Promise<AttendanceRegularization | undefined>;
  applyRegularizationOverride(data: { actorId: string; employeeId: string; attendanceDate: string; requestedPunchIn?: string; requestedPunchOut?: string; requestType: string; reason: string; comment: string }): Promise<AttendanceRegularization>;

  // Stats
  getStats(): Promise<{
    totalJobs: number;
    activeJobs: number;
    totalApplications: number;
    newApplications: number;
    totalContacts: number;
    newContacts: number;
  }>;

  // Content Studio
  getStudioProjects(): Promise<StudioProject[]>;
  createStudioProject(data: InsertStudioProject): Promise<StudioProject>;
  getStudioDashboardStats(projectId?: string): Promise<{
    totalArticles: number;
    byStatus: Record<string, number>;
    pendingReviews: number;
    scheduled: number;
    published: number;
  }>;
  // Articles
  getStudioArticles(filters: {
    projectId?: string;
    status?: string;
    contentType?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: (StudioArticle & { authorName: string | null })[]; total: number }>;
  getStudioArticle(id: string): Promise<StudioArticle | undefined>;
  createStudioArticle(data: InsertStudioArticle): Promise<StudioArticle>;
  updateStudioArticle(id: string, updates: Partial<InsertStudioArticle>): Promise<StudioArticle | undefined>;
  deleteStudioArticle(id: string): Promise<void>;
  // Versions
  getStudioArticleVersions(articleId: string): Promise<StudioArticleVersion[]>;
  getStudioArticleVersion(id: string): Promise<StudioArticleVersion | undefined>;
  createStudioArticleVersion(
    data: Omit<InsertStudioArticleVersion, "versionNo"> & { versionNo?: number },
  ): Promise<StudioArticleVersion>;
  // Authors
  getStudioAuthorProfiles(projectId?: string): Promise<StudioAuthorProfile[]>;
  getStudioAuthorProfile(id: string): Promise<StudioAuthorProfile | undefined>;
  createStudioAuthorProfile(data: InsertStudioAuthorProfile): Promise<StudioAuthorProfile>;
  updateStudioAuthorProfile(id: string, updates: Partial<InsertStudioAuthorProfile>): Promise<StudioAuthorProfile | undefined>;
  // Audit
  createStudioAuditEvent(data: InsertStudioAuditEvent): Promise<StudioAuditEvent>;
  getStudioAuditEvents(articleId: string): Promise<StudioAuditEvent[]>;
  getStudioAnalytics(filters: { projectId?: string; dateFrom?: Date; dateTo?: Date }): Promise<StudioAnalytics>;
  // Public reactions
  isInsightPublished(articleId: string): Promise<boolean>;
  getArticleReactionCounts(articleId: string): Promise<Record<string, number>>;
  getUserArticleReaction(articleId: string, sessionHash: string): Promise<StudioArticleReaction | undefined>;
  toggleArticleReaction(
    articleId: string,
    sessionHash: string,
    reactionType: string,
  ): Promise<{ action: "added" | "removed" | "switched"; previousType: string | null; reactionType: string }>;
  // Card templates + brand
  getStudioBrandSettings(): Promise<StudioBrandSettings | undefined>;
  getCardTemplates(family?: string): Promise<CardTemplate[]>;
  getCardTemplate(id: string): Promise<CardTemplate | undefined>;
  getCardTemplateFor(
    family: string,
    layout: string,
    platform: string,
    projectId?: string | null,
  ): Promise<CardTemplate | undefined>;
  updateCardTemplate(
    id: string,
    updates: Partial<InsertCardTemplate>,
  ): Promise<CardTemplate | undefined>;
  upsertCardTemplateByVariant(data: InsertCardTemplate): Promise<CardTemplate>;

  // Prompt library (seeded + versioned)
  getStudioPromptTemplates(projectId?: string): Promise<StudioPromptTemplate[]>;
  getStudioPromptTemplate(id: string): Promise<StudioPromptTemplate | undefined>;
  getActiveStudioPromptTemplate(
    contentType: string,
    projectId?: string | null,
  ): Promise<StudioPromptTemplate | undefined>;

  // Versioned generation / audit records
  createStudioGeneration(data: InsertStudioGeneration): Promise<StudioGeneration>;
  updateStudioGeneration(
    id: string,
    updates: Partial<InsertStudioGeneration>,
  ): Promise<StudioGeneration | undefined>;
  getStudioGenerations(articleId: string): Promise<StudioGeneration[]>;
  countStudioGenerationsByUserSince(userId: string, since: Date): Promise<number>;

  updateStudioProject(id: string, updates: Partial<InsertStudioProject>): Promise<StudioProject | undefined>;
  getStudioProject(id: string): Promise<StudioProject | undefined>;

  createStudioReviewAssignment(data: InsertStudioReviewAssignment): Promise<StudioReviewAssignment>;
  getStudioReviewAssignment(id: string): Promise<StudioReviewAssignment | undefined>;
  getActiveStudioReviewAssignment(articleId: string): Promise<StudioReviewAssignment | undefined>;
  updateStudioReviewAssignment(id: string, updates: Partial<InsertStudioReviewAssignment>): Promise<StudioReviewAssignment | undefined>;
  getStudioReviewAssignmentsForArticle(articleId: string): Promise<StudioReviewAssignment[]>;
  getStudioInboxForReviewer(userId: string): Promise<(StudioReviewAssignment & {
    article: StudioArticle | null;
    projectName: string | null;
  })[]>;
  getLastStudioAssignmentTimes(reviewerUserIds: string[]): Promise<Record<string, Date | null>>;
  getStudioApprovalQueue(statuses: string[], projectId?: string): Promise<(StudioArticle & {
    authorName: string | null;
    projectName: string | null;
    reviewerName: string | null;
  })[]>;
  getStudioWorkflowDetail(id: string): Promise<{
    article: StudioArticle;
    authorName: string | null;
    projectName: string | null;
    assignments: StudioReviewAssignment[];
    auditEvents: StudioAuditEvent[];
  } | undefined>;
  getStudioCalendarArticles(from: Date, to: Date, projectId?: string): Promise<(StudioArticle & {
    authorName: string | null;
    projectName: string | null;
    publishesToInsights: boolean;
  })[]>;
  getDueScheduledStudioArticles(now: Date): Promise<StudioArticle[]>;

  // Public Insights read path (published Hire'in articles only).
  getPublishedInsights(filters: {
    category?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: PublicInsightArticle[]; total: number }>;
  getPublishedInsightBySlug(slug: string): Promise<PublicInsightArticle | undefined>;
  getRelatedInsights(
    articleId: string,
    category: string | null,
    limit: number,
  ): Promise<PublicInsightArticle[]>;
  getPublishedInsightSlugs(): Promise<{ slug: string; publishedAt: Date | null; updatedAt: Date }[]>;

  // Newsletter subscribers
  getNewsletterSubscriberByEmail(email: string): Promise<StudioNewsletterSubscriber | undefined>;
  getNewsletterSubscriber(id: string): Promise<StudioNewsletterSubscriber | undefined>;
  createNewsletterSubscriber(data: InsertStudioNewsletterSubscriber): Promise<StudioNewsletterSubscriber>;
  updateNewsletterSubscriber(id: string, updates: Partial<StudioNewsletterSubscriber>): Promise<StudioNewsletterSubscriber | undefined>;
  getActiveNewsletterSubscribers(): Promise<StudioNewsletterSubscriber[]>;
  getAllNewsletterSubscribers(): Promise<StudioNewsletterSubscriber[]>;
  getNewsletterSubscriberCounts(): Promise<{ active: number; unsubscribed: number; suppressed: number }>;
}

export type PublicInsightArticle = StudioArticle & {
  authorName: string | null;
  authorTitle: string | null;
  authorBio: string | null;
  authorPhotoUrl: string | null;
  authorLinkedinUrl: string | null;
  authorSlug: string | null;
  authorProfileComplete: boolean;
};

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

  async getOpenAttendance(userId: string): Promise<Attendance | undefined> {
    // Most recent record with a punch-in but no punch-out — i.e. the currently
    // open work session. Used for punch-out so a night-shift session that ends
    // after midnight UTC (early-morning IST) still attaches to its start-day row,
    // rather than being lost by a strict UTC-today lookup.
    const [record] = await db.select().from(attendance)
      .where(and(
        eq(attendance.userId, userId),
        isNotNull(attendance.punchIn),
        isNull(attendance.punchOut),
      ))
      .orderBy(desc(attendance.punchIn))
      .limit(1);
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
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = new Date();

    // Probation settings — only applied to new hires with joining_date >= probationPolicyDate
    const probationMonthsSetting = await this.getSystemSetting("probation_months");
    const probationMonths = probationMonthsSetting ? Number(probationMonthsSetting.value) : 3;
    const probationPolicyDateSetting = await this.getSystemSetting("probation_policy_date");
    const probationPolicyDate = probationPolicyDateSetting?.value
      ? new Date(String(probationPolicyDateSetting.value))
      : null;

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

      // Pro-rate factor for part-time employees (50% of all rates and thresholds)
      const proRateFactor = user.employmentType?.toLowerCase().includes("part-time") ? 0.5 : 1.0;

      let userBalances = await this.getLeaveBalances(user.id, year);
      if (userBalances.length === 0) {
        userBalances = await this.initLeaveBalances(user.id, year);
      }

      const hoursWorked = await this.getUserMonthlyHours(user.id, year, month);
      let userAccrued = false;
      const userName = `${user.firstName} ${user.lastName || ""}`.trim();

      for (const lt of activeLeaveTypesList) {
        const baseMonthlyRate = parseFloat(lt.monthlyAccrual || "0");
        if (baseMonthlyRate <= 0) continue;
        const monthlyRate = parseFloat((baseMonthlyRate * proRateFactor).toFixed(4));

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

        // Bonus months (Jan=1, May=5, Sep=9): EL credits 2× the base monthly rate.
        const BONUS_MONTHS = [1, 5, 9];
        const isBonusMonth = lt.isConditional && BONUS_MONTHS.includes(month);
        let daysToCredit = isBonusMonth
          ? parseFloat((baseMonthlyRate * 2 * proRateFactor).toFixed(4))
          : monthlyRate;
        let accrualType = isBonusMonth ? "monthly+bonus" : "monthly";

        if (lt.isConditional) {
          // EL: probation skip for new hires only (joining_date >= probationPolicyDate)
          if (probationPolicyDate && joiningDate && joiningDate >= probationPolicyDate) {
            const joiningYear = joiningDate.getFullYear();
            const joiningMonth = joiningDate.getMonth() + 1;
            const monthsSinceJoining = (year - joiningYear) * 12 + (month - joiningMonth);
            if (monthsSinceJoining < probationMonths) {
              skippedUsers.push({
                name: userName,
                reason: `Probation period (month ${monthsSinceJoining + 1} of ${probationMonths})`,
                leaveTypeName: lt.name,
              });
              await db.insert(leaveAccruals).values({
                userId: user.id, leaveTypeId: lt.id, year, month,
                accruedDays: "0", hoursWorked: String(hoursWorked),
                qualified: false, accrualType: "monthly",
                skipReason: `Probation: month ${monthsSinceJoining + 1} of ${probationMonths}`,
              }).onConflictDoNothing();
              continue;
            }
          }
          // EL: conditional on hours worked threshold (exempt users bypass this check)
          if (!user.attendanceExempt) {
            const minHours = parseFloat(lt.minHoursForAccrual || "128") * proRateFactor;
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
        } else {
          // SL (isConditional=false, unconditional): cap annual total to 8 days (pro-rated for part-time).
          // 0.67 × 12 = 8.04 so we check how much has already been credited this year
          // and reduce the credit so the full-year total never exceeds the cap.
          const SL_ANNUAL_CAP = parseFloat((8 * proRateFactor).toFixed(2));
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

  async backfillLeaveAccruals(dryRun: boolean = false): Promise<{
    employeesProcessed: number;
    skippedInactive: number;
    accrualRowsCreated: number;
    correctionRowsApplied: number;
    resolvedLeaveTypes: { el: { id: string; name: string }; sl: { id: string; name: string } };
    details: Array<{
      userId: string;
      employeeId: string | null;
      name: string;
      joiningDate: string | null;
      firstAccrualMonth: string | null;
      isPartTime: boolean;
      elAdded: number;
      slAdded: number;
      correctionsApplied: number;
      monthsELSkipped: string[];
      monthsELMissingData: string[];
      newELBalance: number;
      newSLBalance: number;
    }>;
  }> {
    // ──── Constants ────────────────────────────────────────────────
    const BACKFILL_END_YEAR = 2026;
    const BACKFILL_END_MONTH = 5; // May 2026 inclusive
    // The first month the live cron ran (Jan 2026).
    // Months before this are pure backfill; on/after are correction months.
    const CRON_START_YEAR = 2026;
    const CRON_START_MONTH = 1;
    const EL_CARRY_CAP = 45;
    const EL_MONTHLY_RATE = 1.0; // base rate; bonus months (Jan/May/Sep) credit 2× via BONUS_MONTHS
    const BONUS_MONTHS = [1, 5, 9]; // January, May, September each credit 2.0 EL days
    const SL_MONTHLY_RATE = 0.67;
    const SL_ANNUAL_CAP = 8;
    const EL_MIN_HOURS = 128;

    // ──── Load data ─────────────────────────────────────────────────
    const allUsers = await db.select().from(adminUsers);
    const activeUsers = allUsers.filter(u => u.isActive && !u.deletedAt);
    const inactiveCount = allUsers.length - activeUsers.length;
    const activeLeaveTypesList = await db.select().from(leaveTypes).where(eq(leaveTypes.isActive, true));

    // Identify EL and SL types (skip LWP/Comp/Occurrence-based)
    // Step 1: name-based matching (case-insensitive keywords)
    const candidates = activeLeaveTypesList.filter(lt => !lt.occurrenceBased && !/lwp|loss.?of.?pay|comp/i.test(lt.name));
    let elType = candidates.find(lt => /earned|\bel\b/i.test(lt.name));
    let slType = candidates.find(lt => /sick|\bsl\b/i.test(lt.name));

    // Step 2: fall back to isConditional flag if name matching didn't resolve
    if (!elType) elType = candidates.find(lt => lt.isConditional && lt !== slType);
    if (!slType) slType = candidates.find(lt => !lt.isConditional && lt !== elType);

    if (!elType || !slType) {
      const typeList = candidates.map(lt => `"${lt.name}" (isConditional=${lt.isConditional})`).join(", ");
      const found = typeList || "(none)";
      throw new Error(`Could not identify EL and SL leave types. Active non-occurrence leave types found: ${found}. Ensure EL and SL are configured with recognizable names (e.g. "Earned Leave"/"EL" and "Sick Leave"/"SL").`);
    }

    let totalAccrualRows = 0;
    let totalCorrectionRows = 0;
    const details: Array<{
      employeeId: string | null; name: string; joiningDate: string | null; firstAccrualMonth: string | null;
      isPartTime: boolean; elAdded: number; slAdded: number; correctionsApplied: number;
      monthsELSkipped: string[]; monthsELMissingData: string[]; newELBalance: number; newSLBalance: number;
    }> = [];

    // ──── Process each active employee ──────────────────────────────
    for (const user of activeUsers) {
      if (!user.joiningDate) continue; // No joining date → skip

      const joiningDate = new Date(user.joiningDate);
      const joiningDay = joiningDate.getUTCDate();
      const joiningYear = joiningDate.getUTCFullYear();
      const joiningMonthIdx = joiningDate.getUTCMonth(); // 0-indexed

      // First accrual month: same month if joined on 1st, else next month
      let firstAccrualYear = joiningYear;
      let firstAccrualMonth = joiningMonthIdx + 1; // 1-indexed
      if (joiningDay > 1) {
        firstAccrualMonth++;
        if (firstAccrualMonth > 12) { firstAccrualMonth = 1; firstAccrualYear++; }
      }

      const userName = `${user.firstName} ${user.lastName || ""}`.trim();
      const isPartTime = user.employmentType?.toLowerCase().includes("part-time") ?? false;
      const proRate = isPartTime ? 0.5 : 1.0;

      const elRate    = parseFloat((EL_MONTHLY_RATE * proRate).toFixed(4));
      const slRate    = parseFloat((SL_MONTHLY_RATE * proRate).toFixed(4));
      const elMinHrs  = EL_MIN_HOURS * proRate;
      const slAnnualCap = SL_ANNUAL_CAP * proRate;

      const monthsELSkipped: string[] = [];
      const monthsELMissingData: string[] = [];
      let elAdded = 0;
      let slAdded = 0;
      let correctionCount = 0;
      // Track 2026-year-specific additions for projected balance in dry-run mode
      let el2026DeltaForBalance = 0;
      let sl2026DeltaForBalance = 0;
      // Track in-engine (would-be NEW) 2025 accruals for dry-run carry/lapse simulation
      let el2025AddedInEngine = 0;
      let sl2025AddedInEngine = 0;
      // Running SL totals per year (to enforce annual cap during iteration)
      const slAccruedByYear: Record<number, number> = {};

      // ── Month iteration ────────────────────────────────────────────
      let iterYear = firstAccrualYear;
      let iterMonth = firstAccrualMonth;

      while (iterYear < BACKFILL_END_YEAR || (iterYear === BACKFILL_END_YEAR && iterMonth <= BACKFILL_END_MONTH)) {
        const isPreCron = iterYear < CRON_START_YEAR || (iterYear === CRON_START_YEAR && iterMonth < CRON_START_MONTH);
        const monthLabel = `${iterYear}-${String(iterMonth).padStart(2, "0")}`;

        // Get attendance records for this month — distinguish "no records" from "0 hours worked"
        const monthStr2 = String(iterMonth).padStart(2, "0");
        const monthPrefix = `${iterYear}-${monthStr2}`;
        const attRecs = await db.select().from(attendance).where(
          and(eq(attendance.userId, user.id), sql`${attendance.date} LIKE ${monthPrefix + "%"}`)
        );
        const hasAttendanceData = attRecs.length > 0; // true if ANY records exist, even 0h
        let hoursWorked = 0;
        for (const rec of attRecs) {
          if (rec.totalHours) {
            hoursWorked += parseFloat(rec.totalHours);
          } else if (rec.punchIn && rec.punchOut) {
            hoursWorked += (new Date(rec.punchOut).getTime() - new Date(rec.punchIn).getTime()) / 3_600_000;
          }
        }
        hoursWorked = Math.round(hoursWorked * 100) / 100;

        // ── EL for this month ───────────────────────────────────────
        // Jan=1, May=5, Sep=9 are bonus months — credit 2× the base monthly rate.
        const isBonusMonth = BONUS_MONTHS.includes(iterMonth);
        const elEffectiveRate = isBonusMonth ? parseFloat((elRate * 2).toFixed(4)) : elRate;
        let elForMonth = 0;
        let elSkippedReason: string | null = null;

        if (!hasAttendanceData && !user.attendanceExempt) {
          // No attendance data: default to crediting EL and flag for HR review
          elForMonth = elEffectiveRate;
          monthsELMissingData.push(monthLabel);
        } else if (!user.attendanceExempt && hoursWorked < elMinHrs) {
          elSkippedReason = `${hoursWorked}h < ${elMinHrs}h threshold`;
          monthsELSkipped.push(`${monthLabel}(${hoursWorked}h)`);
        } else {
          elForMonth = elEffectiveRate;
        }

        // ── SL for this month ───────────────────────────────────────
        slAccruedByYear[iterYear] = slAccruedByYear[iterYear] ?? 0;
        const slAlreadyThisYear = slAccruedByYear[iterYear];
        let slForMonth = 0;
        const slRemaining = slAnnualCap - slAlreadyThisYear;
        if (slRemaining > 0) {
          slForMonth = parseFloat(Math.min(slRate, slRemaining).toFixed(2));
        }

        // ── Insert / correct accrual rows ───────────────────────────
        if (isPreCron) {
          // Check if backfill row already exists for this month
          const existingEL = await db.select().from(leaveAccruals).where(
            and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, elType.id),
              eq(leaveAccruals.year, iterYear), eq(leaveAccruals.month, iterMonth),
              sql`${leaveAccruals.accrualType} = 'backfill'`)
          ).limit(1);

          if (existingEL.length === 0) {
            if (!dryRun) {
              await db.insert(leaveAccruals).values({
                userId: user.id, leaveTypeId: elType.id, year: iterYear, month: iterMonth,
                accruedDays: String(elForMonth), hoursWorked: String(hoursWorked),
                qualified: elForMonth > 0,
                accrualType: "backfill",
                skipReason: elSkippedReason ?? (monthsELMissingData.includes(monthLabel) ? "No attendance data — defaulted to credit" : null),
              });
            }
            if (elForMonth > 0) {
              elAdded += elForMonth;
              totalAccrualRows++;
              if (iterYear === 2025) el2025AddedInEngine += elForMonth; // for dry-run carry projection
            }
          }

          const existingSL = await db.select().from(leaveAccruals).where(
            and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, slType.id),
              eq(leaveAccruals.year, iterYear), eq(leaveAccruals.month, iterMonth),
              sql`${leaveAccruals.accrualType} = 'backfill'`)
          ).limit(1);

          if (existingSL.length === 0) {
            if (!dryRun) {
              await db.insert(leaveAccruals).values({
                userId: user.id, leaveTypeId: slType.id, year: iterYear, month: iterMonth,
                accruedDays: String(slForMonth), hoursWorked: String(hoursWorked),
                qualified: slForMonth > 0,
                accrualType: "backfill",
                skipReason: slForMonth <= 0 ? "SL annual cap reached" : null,
              });
            }
            if (slForMonth > 0) {
              slAdded += slForMonth;
              totalAccrualRows++;
              if (iterYear === 2025) sl2025AddedInEngine += slForMonth; // for dry-run lapse projection
            }
          }
        } else {
          // Correction month (Jan-May 2026): compare existing vs correct
          // EL correction
          const existingELRows = await db.select().from(leaveAccruals).where(
            and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, elType.id),
              eq(leaveAccruals.year, iterYear), eq(leaveAccruals.month, iterMonth),
              sql`${leaveAccruals.accrualType} NOT IN ('backfill_correction', 'hr_adjustment')`)
          );
          const existingELCredit = existingELRows.reduce((s, r) => s + parseFloat(r.accruedDays), 0);

          // Determine correct EL: if hours < threshold for cron months, correct is 0
          // (if attendanceExempt or no data, default to full rate)
          let correctEL = elForMonth; // already computed above (0 if hours < threshold)

          const alreadyCorrected = await db.select().from(leaveAccruals).where(
            and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, elType.id),
              eq(leaveAccruals.year, iterYear), eq(leaveAccruals.month, iterMonth),
              sql`${leaveAccruals.accrualType} = 'backfill_correction'`)
          ).limit(1);

          if (alreadyCorrected.length === 0) {
            const elDelta = parseFloat((correctEL - existingELCredit).toFixed(4));
            if (Math.abs(elDelta) >= 0.001) {
              if (!dryRun) {
                await db.insert(leaveAccruals).values({
                  userId: user.id, leaveTypeId: elType.id, year: iterYear, month: iterMonth,
                  accruedDays: String(elDelta), hoursWorked: String(hoursWorked),
                  qualified: true,
                  accrualType: "backfill_correction",
                  skipReason: `Correction: was ${existingELCredit}, correct is ${correctEL}`,
                });
              }
              elAdded += elDelta;
              el2026DeltaForBalance += elDelta; // 2026 correction row
              totalCorrectionRows++;
              correctionCount++;
            }
          }

          // SL correction — check if any SL was missed for this month
          const existingSLRows = await db.select().from(leaveAccruals).where(
            and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, slType.id),
              eq(leaveAccruals.year, iterYear), eq(leaveAccruals.month, iterMonth),
              sql`${leaveAccruals.accrualType} NOT IN ('backfill_correction', 'hr_adjustment')`)
          );
          const existingSLCredit = existingSLRows.reduce((s, r) => s + parseFloat(r.accruedDays), 0);

          const alreadyCorrectedSL = await db.select().from(leaveAccruals).where(
            and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, slType.id),
              eq(leaveAccruals.year, iterYear), eq(leaveAccruals.month, iterMonth),
              sql`${leaveAccruals.accrualType} = 'backfill_correction'`)
          ).limit(1);

          if (alreadyCorrectedSL.length === 0) {
            const slDelta = parseFloat((slForMonth - existingSLCredit).toFixed(4));
            if (Math.abs(slDelta) >= 0.001) {
              if (!dryRun) {
                await db.insert(leaveAccruals).values({
                  userId: user.id, leaveTypeId: slType.id, year: iterYear, month: iterMonth,
                  accruedDays: String(slDelta), hoursWorked: String(hoursWorked),
                  qualified: true,
                  accrualType: "backfill_correction",
                  skipReason: `Correction: was ${existingSLCredit}, correct is ${slForMonth}`,
                });
              }
              slAdded += slDelta;
              sl2026DeltaForBalance += slDelta; // 2026 correction row
              totalCorrectionRows++;
              correctionCount++;
            }
          }
        }

        // Track SL for annual cap
        slAccruedByYear[iterYear] = (slAccruedByYear[iterYear] ?? 0) + slForMonth;

        // Advance month
        iterMonth++;
        if (iterMonth > 12) { iterMonth = 1; iterYear++; }
      }

      // ── Year-end 2025: compute amounts in both modes, write only if !dryRun ──
      const el2025Rows = await db.select().from(leaveAccruals).where(
        and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, elType.id),
          eq(leaveAccruals.year, 2025), sql`${leaveAccruals.month} BETWEEN 1 AND 12`)
      );
      // Projected 2025 total = persisted DB rows + in-engine would-be new rows (idempotent in both modes)
      const el2025TotalFromDb = el2025Rows.reduce((s, r) => s + parseFloat(r.accruedDays), 0);
      const el2025Total = el2025TotalFromDb + el2025AddedInEngine;
      const used2025ELReqs = await db.select().from(leaveRequests).where(
        and(eq(leaveRequests.userId, user.id), eq(leaveRequests.leaveTypeId, elType.id),
          eq(leaveRequests.status, "approved"),
          sql`${leaveRequests.startDate} >= '2025-01-01' AND ${leaveRequests.startDate} <= '2025-12-31'`)
      );
      const el2025Used = used2025ELReqs.reduce((s, r) => s + parseFloat(r.totalDays), 0);
      const el2025Remaining = Math.max(0, el2025Total - el2025Used);
      const el2025Carry = Math.min(el2025Remaining, EL_CARRY_CAP);

      const sl2025Rows = await db.select().from(leaveAccruals).where(
        and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, slType.id),
          eq(leaveAccruals.year, 2025), sql`${leaveAccruals.month} BETWEEN 1 AND 12`)
      );
      // Same projected-total approach for SL
      const sl2025TotalFromDb = sl2025Rows.reduce((s, r) => s + parseFloat(r.accruedDays), 0);
      const sl2025Total = sl2025TotalFromDb + sl2025AddedInEngine;
      const used2025SLReqs = await db.select().from(leaveRequests).where(
        and(eq(leaveRequests.userId, user.id), eq(leaveRequests.leaveTypeId, slType.id),
          eq(leaveRequests.status, "approved"),
          sql`${leaveRequests.startDate} >= '2025-01-01' AND ${leaveRequests.startDate} <= '2025-12-31'`)
      );
      const sl2025Used = used2025SLReqs.reduce((s, r) => s + parseFloat(r.totalDays), 0);
      const sl2025Remaining = Math.max(0, sl2025Total - sl2025Used);

      // Idempotency checks for carry/lapse (needed in both modes to avoid double-counting)
      const existingCarry = await db.select().from(leaveAccruals).where(
        and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, elType.id),
          eq(leaveAccruals.year, 2026), eq(leaveAccruals.month, 0),
          sql`${leaveAccruals.accrualType} = 'year_end_carry_forward'`)
      ).limit(1);
      const carryAlreadyRecorded = existingCarry.length > 0 && parseFloat(existingCarry[0].accruedDays) > 0;

      const existingLapse = await db.select().from(leaveAccruals).where(
        and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, slType.id),
          eq(leaveAccruals.year, 2025), eq(leaveAccruals.month, 13),
          sql`${leaveAccruals.accrualType} = 'year_end_lapse'`)
      ).limit(1);

      // Track carry for projected balance (only if not already recorded)
      if (!carryAlreadyRecorded && el2025Carry > 0) {
        elAdded += el2025Carry;
        el2026DeltaForBalance += el2025Carry; // carry-forward is a year=2026 row
      }

      if (!dryRun) {
        if (existingCarry.length > 0) {
          if (parseFloat(existingCarry[0].accruedDays) === 0 && el2025Carry > 0) {
            await db.update(leaveAccruals)
              .set({ accruedDays: String(el2025Carry), skipReason: "Updated by backfill" })
              .where(eq(leaveAccruals.id, existingCarry[0].id));
          }
        } else if (el2025Carry > 0) {
          await db.insert(leaveAccruals).values({
            userId: user.id, leaveTypeId: elType.id, year: 2026, month: 0,
            accruedDays: String(el2025Carry), hoursWorked: "0",
            qualified: true, accrualType: "year_end_carry_forward",
            skipReason: `EL carry from 2025: ${el2025Remaining.toFixed(2)} remaining → capped at ${EL_CARRY_CAP}`,
          });
        }
        if (existingLapse.length === 0 && sl2025Remaining > 0) {
          await db.insert(leaveAccruals).values({
            userId: user.id, leaveTypeId: slType.id, year: 2025, month: 13,
            accruedDays: String(-sl2025Remaining), hoursWorked: "0",
            qualified: true, accrualType: "year_end_lapse",
            skipReason: `SL year-end lapse: ${sl2025Remaining.toFixed(2)} days forfeited`,
          });
        }
      }

      // ── Update leave_balances (write mode only — only totalDays is touched; usedDays is never written by backfill) ──
      if (!dryRun) {
        for (const ltId of [elType.id, slType.id]) {
          for (const balYear of [2025, 2026]) {
            const rows = await db.select().from(leaveAccruals).where(
              and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, ltId),
                eq(leaveAccruals.year, balYear), eq(leaveAccruals.qualified, true))
            );
            const newTotal = rows.reduce((s, r) => s + parseFloat(r.accruedDays), 0);

            const existingBal = await db.select().from(leaveBalances).where(
              and(eq(leaveBalances.userId, user.id), eq(leaveBalances.leaveTypeId, ltId),
                eq(leaveBalances.year, balYear))
            ).limit(1);

            if (existingBal.length > 0) {
              // Only totalDays is updated — usedDays is managed by the leave-request approval flow.
              // Floor totalDays at usedDays to prevent impossible negative displayed balances.
              const currentUsedDays = parseFloat(existingBal[0].usedDays);
              if (newTotal < currentUsedDays) {
                console.warn(`[backfill] WARNING: computed totalDays (${newTotal.toFixed(2)}) < usedDays (${currentUsedDays}) for userId=${user.id} leaveTypeId=${ltId} year=${balYear}. Flooring to usedDays.`);
              }
              const flooredTotal = Math.max(newTotal, currentUsedDays);
              await db.update(leaveBalances)
                .set({ totalDays: String(parseFloat(flooredTotal.toFixed(2))), updatedAt: new Date() })
                .where(eq(leaveBalances.id, existingBal[0].id));
            } else if (newTotal > 0) {
              await db.insert(leaveBalances).values({
                userId: user.id, leaveTypeId: ltId,
                totalDays: String(parseFloat(newTotal.toFixed(2))), usedDays: "0", year: balYear,
              });
            }
          }
        }
      }

      // ── Compute final balances for result ──────────────────────────────
      let newELBalance = 0;
      let newSLBalance = 0;
      if (!dryRun) {
        // Read updated balance from DB (totalDays just written; usedDays unchanged by backfill)
        const el2026Bal = await db.select().from(leaveBalances).where(
          and(eq(leaveBalances.userId, user.id), eq(leaveBalances.leaveTypeId, elType.id), eq(leaveBalances.year, 2026))
        ).limit(1);
        const sl2026Bal = await db.select().from(leaveBalances).where(
          and(eq(leaveBalances.userId, user.id), eq(leaveBalances.leaveTypeId, slType.id), eq(leaveBalances.year, 2026))
        ).limit(1);
        if (el2026Bal.length) newELBalance = parseFloat(el2026Bal[0].totalDays) - parseFloat(el2026Bal[0].usedDays);
        if (sl2026Bal.length) newSLBalance = parseFloat(sl2026Bal[0].totalDays) - parseFloat(sl2026Bal[0].usedDays);
      } else {
        // Dry-run: project 2026 balance = accruals + manual adjustments + this-run deltas - usedDays.
        //
        // Endpoint-created hr_adjustment rows use month=0 + accrual_type='hr_adjustment' and are
        // mirrored exactly in leave_adjustments. To include legacy adjustments (only in
        // leave_adjustments) without double-counting new-style ones (in both tables), we:
        //   1) Sum qualified accruals EXCLUDING month=0 hr_adjustment rows (those are leave_adjustments mirrors)
        //   2) Add the leave_adjustments sum directly for this user/type/year
        // Historical startup corrections (month=98 or month=99 hr_adjustment) are NOT in
        // leave_adjustments, so they stay in the accruals sum — no double-counting.
        const existing2026ELAcc = await db.select().from(leaveAccruals).where(
          and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, elType.id),
            eq(leaveAccruals.year, 2026), eq(leaveAccruals.qualified, true),
            sql`NOT (${leaveAccruals.accrualType} = 'hr_adjustment' AND ${leaveAccruals.month} = 0)`)
        );
        const existing2026ELTotal = existing2026ELAcc.reduce((s, r) => s + parseFloat(r.accruedDays), 0);
        // Add leave_adjustments sum — covers legacy pre-fix adjustments and new endpoint adjustments.
        const existing2026ELAdjs = await db.select().from(leaveAdjustments).where(
          and(eq(leaveAdjustments.userId, user.id), eq(leaveAdjustments.leaveTypeId, elType.id),
            eq(leaveAdjustments.year, 2026))
        );
        const existing2026ELAdjTotal = existing2026ELAdjs.reduce((s, r) => s + parseFloat(r.adjustmentDays), 0);
        const existing2026ELBal = await db.select().from(leaveBalances).where(
          and(eq(leaveBalances.userId, user.id), eq(leaveBalances.leaveTypeId, elType.id), eq(leaveBalances.year, 2026))
        ).limit(1);
        const existing2026ELUsed = existing2026ELBal.length ? parseFloat(existing2026ELBal[0].usedDays) : 0;
        newELBalance = existing2026ELTotal + existing2026ELAdjTotal + el2026DeltaForBalance - existing2026ELUsed;

        const existing2026SLAcc = await db.select().from(leaveAccruals).where(
          and(eq(leaveAccruals.userId, user.id), eq(leaveAccruals.leaveTypeId, slType.id),
            eq(leaveAccruals.year, 2026), eq(leaveAccruals.qualified, true),
            sql`NOT (${leaveAccruals.accrualType} = 'hr_adjustment' AND ${leaveAccruals.month} = 0)`)
        );
        const existing2026SLTotal = existing2026SLAcc.reduce((s, r) => s + parseFloat(r.accruedDays), 0);
        // Same treatment for SL
        const existing2026SLAdjs = await db.select().from(leaveAdjustments).where(
          and(eq(leaveAdjustments.userId, user.id), eq(leaveAdjustments.leaveTypeId, slType.id),
            eq(leaveAdjustments.year, 2026))
        );
        const existing2026SLAdjTotal = existing2026SLAdjs.reduce((s, r) => s + parseFloat(r.adjustmentDays), 0);
        const existing2026SLBal = await db.select().from(leaveBalances).where(
          and(eq(leaveBalances.userId, user.id), eq(leaveBalances.leaveTypeId, slType.id), eq(leaveBalances.year, 2026))
        ).limit(1);
        const existing2026SLUsed = existing2026SLBal.length ? parseFloat(existing2026SLBal[0].usedDays) : 0;
        newSLBalance = existing2026SLTotal + existing2026SLAdjTotal + sl2026DeltaForBalance - existing2026SLUsed;
        // Apply the same floor as live mode (totalDays is floored at usedDays, so displayed balance ≥ 0)
        newELBalance = Math.max(0, newELBalance);
        newSLBalance = Math.max(0, newSLBalance);
      }

      details.push({
        userId: user.id,
        employeeId: user.employeeId ?? null,
        name: userName,
        joiningDate: user.joiningDate ?? null,
        firstAccrualMonth: `${firstAccrualYear}-${String(firstAccrualMonth).padStart(2, "0")}`,
        isPartTime,
        elAdded: parseFloat(elAdded.toFixed(2)),
        slAdded: parseFloat(slAdded.toFixed(2)),
        correctionsApplied: correctionCount,
        monthsELSkipped,
        monthsELMissingData,
        newELBalance: parseFloat(newELBalance.toFixed(2)),
        newSLBalance: parseFloat(newSLBalance.toFixed(2)),
      });
    }

    // Store run log
    if (!dryRun) {
      await this.upsertSystemSetting("backfill_leave_accruals_log", {
        runAt: new Date().toISOString(),
        employeesProcessed: details.length,
        accrualRowsCreated: totalAccrualRows,
        correctionRowsApplied: totalCorrectionRows,
      });
    }

    return {
      employeesProcessed: details.length,
      skippedInactive: inactiveCount,
      accrualRowsCreated: totalAccrualRows,
      correctionRowsApplied: totalCorrectionRows,
      resolvedLeaveTypes: {
        el: { id: elType.id, name: elType.name },
        sl: { id: slType.id, name: slType.name },
      },
      details,
    };
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
  // PENDING CHANGES (automated-job guardrail)
  // ==========================================
  // Automated jobs PROPOSE changes here instead of overwriting user-entered data.
  // The unique index dedupes re-runs (ON CONFLICT DO NOTHING) so an already-reviewed
  // proposal is never resurrected by a later run.
  async proposePendingChange(change: InsertPendingChange): Promise<PendingChange | undefined> {
    const [created] = await db.insert(pendingChanges)
      .values(change)
      .onConflictDoNothing()
      .returning();
    return created;
  }

  async getPendingChanges(filters?: { status?: string; sourceJob?: string; runDate?: string }): Promise<PendingChange[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(pendingChanges.status, filters.status as any));
    if (filters?.sourceJob) conditions.push(eq(pendingChanges.sourceJob, filters.sourceJob));
    if (filters?.runDate) conditions.push(eq(pendingChanges.runDate, filters.runDate));

    return db.select().from(pendingChanges)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(pendingChanges.runDate), asc(pendingChanges.createdAt));
  }

  async getPendingChange(id: string): Promise<PendingChange | undefined> {
    const [row] = await db.select().from(pendingChanges).where(eq(pendingChanges.id, id));
    return row;
  }

  async countPendingChanges(status: string = "pending"): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(pendingChanges)
      .where(eq(pendingChanges.status, status as any));
    return result?.count ?? 0;
  }

  // Approve a single proposal: re-validate guardrails, apply the change transactionally,
  // write an audit log, and mark the proposal approved. All-or-nothing.
  async approvePendingChange(id: string, reviewerId: string, note?: string): Promise<{ ok: boolean; reason?: string }> {
    return db.transaction(async (tx) => {
      const [change] = await tx.select().from(pendingChanges)
        .where(eq(pendingChanges.id, id))
        .for("update");
      if (!change) return { ok: false, reason: "Proposal not found" };
      if (change.status !== "pending") return { ok: false, reason: "Proposal already reviewed" };

      // ── Apply the change based on its target ──────────────────────────────────
      if (change.targetTable === "attendance" && change.changeType === "insert") {
        const payload = (change.payload as Record<string, any>) || {};
        const userId = change.targetUserId!;
        const date = change.runDate;

        // Re-check: never clobber a row the employee/HR created after the proposal.
        const existing = await tx.select({ id: attendance.id })
          .from(attendance)
          .where(and(eq(attendance.userId, userId), eq(attendance.date, date)))
          .limit(1);
        if (existing.length > 0) {
          return { ok: false, reason: "An attendance record now exists for this day — proposal is stale" };
        }

        await tx.insert(attendance).values({
          userId,
          date,
          status: (payload.status as any) ?? "absent",
          notes: payload.notes ?? change.reason ?? "[Auto] Approved absent proposal",
        });
      } else {
        return { ok: false, reason: `Unsupported change target: ${change.targetTable}/${change.changeType}` };
      }

      await tx.update(pendingChanges)
        .set({ status: "approved", reviewedBy: reviewerId, reviewedAt: new Date(), reviewNote: note ?? null })
        .where(eq(pendingChanges.id, id));

      await tx.insert(auditLogs).values({
        actorId: reviewerId,
        targetId: change.targetUserId ?? null,
        action: "pending_change_approved",
        changes: {
          pendingChangeId: change.id,
          sourceJob: change.sourceJob,
          targetTable: change.targetTable,
          runDate: change.runDate,
          field: change.field,
          proposedValue: change.proposedValue,
          note: note ?? null,
        },
      });

      return { ok: true };
    });
  }

  // Reject a single proposal: discard it (no data write) and audit the rejection.
  async rejectPendingChange(id: string, reviewerId: string, note?: string): Promise<{ ok: boolean; reason?: string }> {
    return db.transaction(async (tx) => {
      const [change] = await tx.select().from(pendingChanges)
        .where(eq(pendingChanges.id, id))
        .for("update");
      if (!change) return { ok: false, reason: "Proposal not found" };
      if (change.status !== "pending") return { ok: false, reason: "Proposal already reviewed" };

      await tx.update(pendingChanges)
        .set({ status: "rejected", reviewedBy: reviewerId, reviewedAt: new Date(), reviewNote: note ?? null })
        .where(eq(pendingChanges.id, id));

      await tx.insert(auditLogs).values({
        actorId: reviewerId,
        targetId: change.targetUserId ?? null,
        action: "pending_change_rejected",
        changes: {
          pendingChangeId: change.id,
          sourceJob: change.sourceJob,
          targetTable: change.targetTable,
          runDate: change.runDate,
          field: change.field,
          note: note ?? null,
        },
      });

      return { ok: true };
    });
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

  async upsertSalarySlip(slip: InsertSalarySlip & { userId: string; year: number; month: number }): Promise<SalarySlip> {
    await db.delete(salarySlips)
      .where(and(
        eq(salarySlips.userId, slip.userId),
        eq(salarySlips.year, slip.year),
        eq(salarySlips.month, slip.month),
      ));
    const [created] = await db.insert(salarySlips).values(slip).returning();
    return created;
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

  async initializeEmployeeDocuments(userId: string, employeeCategory?: string): Promise<EmployeeDocument[]> {
    const isNonExperienced = employeeCategory === "fresher" || employeeCategory === "intern";

    const docTypes = [
      { category: "identity", documentType: "aadhaar", isRequired: true },
      { category: "identity", documentType: "pan", isRequired: true },
      { category: "identity", documentType: "passport", isRequired: false },
      { category: "identity", documentType: "voter_id_dl", isRequired: false },
      { category: "education", documentType: "10th_marksheet", isRequired: true },
      { category: "education", documentType: "12th_marksheet", isRequired: true },
      { category: "education", documentType: "graduation_cert", isRequired: true },
      { category: "education", documentType: "postgrad_cert", isRequired: false },
      { category: "employment", documentType: "relieving_letter", isRequired: !isNonExperienced },
      { category: "employment", documentType: "salary_slips_prev", isRequired: !isNonExperienced },
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

  async updateDocumentRequiredStatusForCategory(userId: string, employeeCategory: string): Promise<void> {
    const isRequired = employeeCategory !== "fresher" && employeeCategory !== "intern";
    const targetDocTypes = ["relieving_letter", "salary_slips_prev"];

    for (const docType of targetDocTypes) {
      await db.update(employeeDocuments)
        .set({ isRequired, updatedAt: new Date() })
        .where(
          and(
            eq(employeeDocuments.userId, userId),
            eq(employeeDocuments.documentType, docType),
            eq(employeeDocuments.status, "pending")
          )
        );
    }
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

  async getStandaloneAddendums(): Promise<OfferLetterAddendum[]> {
    return db.select().from(offerLetterAddendums)
      .where(eq(offerLetterAddendums.isStandalone, true))
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

  // ==========================================
  // CONTRACT CLIENTS
  // ==========================================
  async getContractClients(activeOnly = true): Promise<ContractClient[]> {
    if (activeOnly) {
      return db.select().from(contractClients).where(eq(contractClients.isActive, true)).orderBy(asc(contractClients.name));
    }
    return db.select().from(contractClients).orderBy(asc(contractClients.name));
  }

  async getContractClient(id: string): Promise<ContractClient | undefined> {
    const [c] = await db.select().from(contractClients).where(eq(contractClients.id, id));
    return c;
  }

  async createContractClient(data: InsertContractClient): Promise<ContractClient> {
    const [c] = await db.insert(contractClients).values(data).returning();
    return c;
  }

  async updateContractClient(id: string, data: Partial<InsertContractClient>): Promise<ContractClient | undefined> {
    const [c] = await db.update(contractClients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contractClients.id, id))
      .returning();
    return c;
  }

  async toggleContractClientStatus(id: string, isActive: boolean): Promise<ContractClient | undefined> {
    const [c] = await db.update(contractClients)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(contractClients.id, id))
      .returning();
    return c;
  }

  // ==========================================
  // CONTRACT TEMPLATES
  // ==========================================
  async getContractTemplates(): Promise<ContractTemplate[]> {
    return db.select().from(contractTemplates).orderBy(desc(contractTemplates.createdAt));
  }

  async getContractTemplate(id: string): Promise<ContractTemplate | undefined> {
    const [t] = await db.select().from(contractTemplates).where(eq(contractTemplates.id, id));
    return t;
  }

  async createContractTemplate(data: InsertContractTemplate): Promise<ContractTemplate> {
    const [t] = await db.insert(contractTemplates).values(data).returning();
    return t;
  }

  async deleteContractTemplate(id: string): Promise<boolean> {
    await db.delete(contractTemplates).where(eq(contractTemplates.id, id));
    return true;
  }

  async incrementContractTemplateUsage(id: string): Promise<void> {
    await db.update(contractTemplates)
      .set({ usageCount: sql`${contractTemplates.usageCount} + 1` })
      .where(eq(contractTemplates.id, id));
  }

  // ==========================================
  // CONTRACTS
  // ==========================================
  async getContracts(filters?: { clientId?: string; status?: string; search?: string }): Promise<Contract[]> {
    let results = await db.select().from(contracts).orderBy(desc(contracts.createdAt));
    if (filters?.clientId) results = results.filter(c => c.clientId === filters.clientId);
    if (filters?.status) results = results.filter(c => c.status === filters.status);
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      results = results.filter(c =>
        c.clientName.toLowerCase().includes(s) ||
        c.candidateName?.toLowerCase().includes(s) ||
        c.templateName?.toLowerCase().includes(s)
      );
    }
    return results;
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const [c] = await db.select().from(contracts).where(eq(contracts.id, id));
    return c;
  }

  async getContractByToken(token: string): Promise<Contract | undefined> {
    const [c] = await db.select().from(contracts).where(eq(contracts.signingToken, token));
    return c;
  }

  async createContract(data: InsertContract): Promise<Contract> {
    const [c] = await db.insert(contracts).values(data).returning();
    return c;
  }

  async updateContract(id: string, updates: Partial<Contract>): Promise<Contract | undefined> {
    const [c] = await db.update(contracts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contracts.id, id))
      .returning();
    return c;
  }

  // ==========================================
  // CONTRACT INVOICES
  // ==========================================
  async getContractInvoices(contractId: string): Promise<import("@shared/schema").ContractInvoice[]> {
    return db.select().from(contractInvoices)
      .where(eq(contractInvoices.contractId, contractId))
      .orderBy(asc(contractInvoices.dueDate));
  }

  async getAllInvoices(filters?: { status?: string }): Promise<import("@shared/schema").ContractInvoice[]> {
    let results = await db.select().from(contractInvoices).orderBy(asc(contractInvoices.dueDate));
    if (filters?.status) results = results.filter(i => i.status === filters.status);
    return results;
  }

  async createContractInvoice(data: import("@shared/schema").InsertContractInvoice): Promise<import("@shared/schema").ContractInvoice> {
    const [i] = await db.insert(contractInvoices).values(data).returning();
    return i;
  }

  async updateContractInvoice(id: string, updates: Partial<import("@shared/schema").ContractInvoice>): Promise<import("@shared/schema").ContractInvoice | undefined> {
    const [i] = await db.update(contractInvoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contractInvoices.id, id))
      .returning();
    return i;
  }

  async deleteContractInvoice(id: string): Promise<boolean> {
    await db.delete(contractInvoices).where(eq(contractInvoices.id, id));
    return true;
  }

  // ==========================================
  // ATTENDANCE REGULARIZATIONS
  // ==========================================

  async createRegularizationRequest(data: InsertAttendanceRegularization): Promise<AttendanceRegularization> {
    const [created] = await db.insert(attendanceRegularizations).values(data).returning();
    return created;
  }

  async getRegularizationRequests(filters?: { employeeId?: string; managerTeamIds?: string[]; status?: string; startDate?: string; endDate?: string }): Promise<AttendanceRegularization[]> {
    // If scoped to manager's team but team is empty, return nothing immediately (not all records)
    if (filters?.managerTeamIds !== undefined && filters.managerTeamIds.length === 0) {
      return [];
    }
    let results = await db.select().from(attendanceRegularizations).orderBy(desc(attendanceRegularizations.createdAt));
    if (filters?.employeeId) {
      results = results.filter(r => r.employeeId === filters.employeeId);
    }
    if (filters?.managerTeamIds && filters.managerTeamIds.length > 0) {
      results = results.filter(r => filters.managerTeamIds!.includes(r.employeeId));
    }
    if (filters?.status) {
      results = results.filter(r => r.status === filters.status);
    }
    if (filters?.startDate) {
      results = results.filter(r => r.attendanceDate >= filters.startDate!);
    }
    if (filters?.endDate) {
      results = results.filter(r => r.attendanceDate <= filters.endDate!);
    }
    return results;
  }

  async getRegularizationRequest(id: string): Promise<AttendanceRegularization | undefined> {
    const [r] = await db.select().from(attendanceRegularizations).where(eq(attendanceRegularizations.id, id));
    return r;
  }

  async updateRegularizationRequest(id: string, updates: Partial<AttendanceRegularization>): Promise<AttendanceRegularization | undefined> {
    const [updated] = await db.update(attendanceRegularizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(attendanceRegularizations.id, id))
      .returning();
    return updated;
  }

  async applyRegularizationOverride(data: { actorId: string; employeeId: string; attendanceDate: string; requestedPunchIn?: string; requestedPunchOut?: string; requestType: string; reason: string; comment: string; attendanceStatus?: string }): Promise<AttendanceRegularization> {
    const punchIn = data.requestedPunchIn ? new Date(data.requestedPunchIn) : undefined;
    const punchOut = data.requestedPunchOut ? new Date(data.requestedPunchOut) : undefined;
    const [created] = await db.insert(attendanceRegularizations).values({
      employeeId: data.employeeId,
      attendanceDate: data.attendanceDate,
      requestedPunchIn: punchIn,
      requestedPunchOut: punchOut,
      requestType: data.requestType as any,
      reason: data.reason,
      status: "approved",
      reviewedBy: data.actorId,
      reviewerComment: data.comment,
      reviewedAt: new Date(),
    }).returning();

    // Apply the correction to the attendance record
    const existing = await db.select().from(attendance)
      .where(and(eq(attendance.userId, data.employeeId), eq(attendance.date, data.attendanceDate)))
      .limit(1);

    let totalHoursNum: string | undefined;
    if (punchIn && punchOut) {
      const diffMs = punchOut.getTime() - punchIn.getTime();
      totalHoursNum = (diffMs / 3600000).toFixed(2);
    }

    // Use the caller-supplied recomputed status (derived from shift policy in the route);
    // fall back to "present" for wrong_absent, or preserve existing status as last resort.
    const resolvedStatus = data.attendanceStatus ?? (data.requestType === "wrong_absent" ? "present" : existing[0]?.status ?? "present");

    if (existing.length > 0) {
      await db.update(attendance).set({
        punchIn: punchIn ?? existing[0].punchIn,
        punchOut: punchOut ?? existing[0].punchOut,
        totalHours: totalHoursNum ?? existing[0].totalHours,
        isCorrect: true,
        correctionSource: "hr_override",
        correctedById: data.actorId,
        correctionNote: data.comment,
        status: resolvedStatus,
        updatedAt: new Date(),
      }).where(eq(attendance.id, existing[0].id));
    } else if (data.requestType === "wrong_absent") {
      await db.insert(attendance).values({
        userId: data.employeeId,
        date: data.attendanceDate,
        punchIn,
        punchOut,
        totalHours: totalHoursNum,
        status: resolvedStatus,
        isCorrect: true,
        correctionSource: "hr_override",
        correctedById: data.actorId,
        correctionNote: data.comment,
      });
    }

    return created;
  }

  // ==========================================
  // CONTENT STUDIO
  // ==========================================

  async getStudioProjects(): Promise<StudioProject[]> {
    return await db
      .select()
      .from(studioProjects)
      .orderBy(desc(studioProjects.isPrimary), asc(studioProjects.name));
  }

  async createStudioProject(data: InsertStudioProject): Promise<StudioProject> {
    const [created] = await db.insert(studioProjects).values(data).returning();
    return created;
  }

  async getStudioDashboardStats(projectId?: string): Promise<{
    totalArticles: number;
    byStatus: Record<string, number>;
    pendingReviews: number;
    scheduled: number;
    published: number;
  }> {
    const whereClause = projectId ? eq(studioArticles.projectId, projectId) : undefined;

    const rows = await db
      .select({ status: studioArticles.status, count: sql<number>`count(*)::int` })
      .from(studioArticles)
      .where(whereClause)
      .groupBy(studioArticles.status);

    const byStatus: Record<string, number> = {
      draft: 0,
      in_review: 0,
      approved: 0,
      scheduled: 0,
      published: 0,
      ready_to_export: 0,
    };
    let totalArticles = 0;
    for (const r of rows) {
      byStatus[r.status] = r.count;
      totalArticles += r.count;
    }

    return {
      totalArticles,
      byStatus,
      pendingReviews: byStatus.in_review,
      scheduled: byStatus.scheduled,
      published: byStatus.published,
    };
  }

  // ---- Articles ----
  async getStudioArticles(filters: {
    projectId?: string;
    status?: string;
    contentType?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: (StudioArticle & { authorName: string | null })[]; total: number }> {
    const conditions = [];
    if (filters.projectId) conditions.push(eq(studioArticles.projectId, filters.projectId));
    if (filters.status) conditions.push(eq(studioArticles.status, filters.status as any));
    if (filters.contentType) conditions.push(eq(studioArticles.contentType, filters.contentType));
    if (filters.search) {
      conditions.push(ilike(studioArticles.title, `%${filters.search}%`));
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));

    const [{ count: total }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(studioArticles)
      .where(whereClause);

    const rows = await db
      .select({
        article: studioArticles,
        authorName: studioAuthorProfiles.displayName,
      })
      .from(studioArticles)
      .leftJoin(
        studioAuthorProfiles,
        eq(studioArticles.authorProfileId, studioAuthorProfiles.id),
      )
      .where(whereClause)
      .orderBy(desc(studioArticles.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      items: rows.map((r) => ({ ...r.article, authorName: r.authorName ?? null })),
      total,
    };
  }

  async getStudioArticle(id: string): Promise<StudioArticle | undefined> {
    const [row] = await db.select().from(studioArticles).where(eq(studioArticles.id, id));
    return row;
  }

  async createStudioArticle(data: InsertStudioArticle): Promise<StudioArticle> {
    const [created] = await db.insert(studioArticles).values(data).returning();
    return created;
  }

  async updateStudioArticle(
    id: string,
    updates: Partial<InsertStudioArticle>,
  ): Promise<StudioArticle | undefined> {
    const [updated] = await db
      .update(studioArticles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(studioArticles.id, id))
      .returning();
    return updated;
  }

  async deleteStudioArticle(id: string): Promise<void> {
    await db.delete(studioArticleVersions).where(eq(studioArticleVersions.articleId, id));
    await db.delete(studioAuditEvents).where(eq(studioAuditEvents.articleId, id));
    await db.delete(studioArticles).where(eq(studioArticles.id, id));
  }

  // ---- Versions ----
  async getStudioArticleVersions(articleId: string): Promise<StudioArticleVersion[]> {
    return await db
      .select()
      .from(studioArticleVersions)
      .where(eq(studioArticleVersions.articleId, articleId))
      .orderBy(desc(studioArticleVersions.versionNo));
  }

  async getStudioArticleVersion(id: string): Promise<StudioArticleVersion | undefined> {
    const [row] = await db
      .select()
      .from(studioArticleVersions)
      .where(eq(studioArticleVersions.id, id));
    return row;
  }

  async createStudioArticleVersion(
    data: Omit<InsertStudioArticleVersion, "versionNo"> & { versionNo?: number },
  ): Promise<StudioArticleVersion> {
    let versionNo = data.versionNo;
    if (versionNo === undefined) {
      const [{ max }] = await db
        .select({ max: sql<number>`coalesce(max(${studioArticleVersions.versionNo}), 0)::int` })
        .from(studioArticleVersions)
        .where(eq(studioArticleVersions.articleId, data.articleId));
      versionNo = (max ?? 0) + 1;
    }
    const [created] = await db
      .insert(studioArticleVersions)
      .values({ ...data, versionNo })
      .returning();
    return created;
  }

  // ---- Authors ----
  async getStudioAuthorProfiles(projectId?: string): Promise<StudioAuthorProfile[]> {
    const conditions = [];
    if (projectId) {
      conditions.push(
        or(
          eq(studioAuthorProfiles.projectId, projectId),
          isNull(studioAuthorProfiles.projectId),
        ),
      );
    }
    return await db
      .select()
      .from(studioAuthorProfiles)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(studioAuthorProfiles.isActive), asc(studioAuthorProfiles.displayName));
  }

  async getStudioAuthorProfile(id: string): Promise<StudioAuthorProfile | undefined> {
    const [row] = await db
      .select()
      .from(studioAuthorProfiles)
      .where(eq(studioAuthorProfiles.id, id));
    return row;
  }

  async createStudioAuthorProfile(data: InsertStudioAuthorProfile): Promise<StudioAuthorProfile> {
    const [created] = await db.insert(studioAuthorProfiles).values(data).returning();
    return created;
  }

  async updateStudioAuthorProfile(
    id: string,
    updates: Partial<InsertStudioAuthorProfile>,
  ): Promise<StudioAuthorProfile | undefined> {
    const [updated] = await db
      .update(studioAuthorProfiles)
      .set(updates)
      .where(eq(studioAuthorProfiles.id, id))
      .returning();
    return updated;
  }

  // ---- Audit ----
  async createStudioAuditEvent(data: InsertStudioAuditEvent): Promise<StudioAuditEvent> {
    const [created] = await db.insert(studioAuditEvents).values(data).returning();
    return created;
  }

  async getStudioAuditEvents(articleId: string): Promise<StudioAuditEvent[]> {
    return await db
      .select()
      .from(studioAuditEvents)
      .where(eq(studioAuditEvents.articleId, articleId))
      .orderBy(desc(studioAuditEvents.createdAt));
  }

  async getStudioAnalytics(filters: {
    projectId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<StudioAnalytics> {
    const { projectId, dateFrom, dateTo } = filters;
    const since = dateFrom && !isNaN(dateFrom.getTime()) ? dateFrom : undefined;
    const until = dateTo && !isNaN(dateTo.getTime()) ? dateTo : undefined;

    // Whole, inclusive business days between two dates (excludes Sat/Sun).
    const businessDaysBetween = (start: Date, end: Date): number => {
      if (end <= start) return 0;
      const ms = end.getTime() - start.getTime();
      const totalDays = ms / (24 * 60 * 60 * 1000);
      const fullWeeks = Math.floor(totalDays / 7);
      let business = fullWeeks * 5;
      let remaining = totalDays - fullWeeks * 7;
      let cursor = new Date(start.getTime() + fullWeeks * 7 * 24 * 60 * 60 * 1000);
      while (remaining > 0) {
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6) business += 1;
        remaining -= 1;
      }
      return business;
    };

    // ---- Workflow: published count + draft->publish duration (business days) ----
    const publishedConditions = [eq(studioArticles.status, "published"), isNotNull(studioArticles.publishedAt)];
    if (projectId) publishedConditions.push(eq(studioArticles.projectId, projectId));
    if (since) publishedConditions.push(gte(studioArticles.publishedAt, since));
    if (until) publishedConditions.push(lte(studioArticles.publishedAt, until));

    const publishedRows = await db
      .select({
        id: studioArticles.id,
        title: studioArticles.title,
        category: studioArticles.category,
        authorProfileId: studioArticles.authorProfileId,
        authorName: studioAuthorProfiles.displayName,
        createdAt: studioArticles.createdAt,
        publishedAt: studioArticles.publishedAt,
      })
      .from(studioArticles)
      .leftJoin(studioAuthorProfiles, eq(studioArticles.authorProfileId, studioAuthorProfiles.id))
      .where(and(...publishedConditions));

    const publishedCount = publishedRows.length;

    const durations = publishedRows
      .filter((r) => r.createdAt && r.publishedAt)
      .map((r) => businessDaysBetween(new Date(r.createdAt as any), new Date(r.publishedAt as any)))
      .sort((a, b) => a - b);
    let medianDraftToPublishDays: number | null = null;
    if (durations.length) {
      const mid = Math.floor(durations.length / 2);
      medianDraftToPublishDays =
        durations.length % 2 === 0 ? (durations[mid - 1] + durations[mid]) / 2 : durations[mid];
    }

    // Author leaderboard + category breakdown from the same published set.
    // Group published article ids by author and category; reaction/view averages
    // are folded in after the audience maps are built (below).
    const authorMap = new Map<
      string,
      { authorProfileId: string | null; authorName: string; articleIds: string[] }
    >();
    const categoryMap = new Map<string, string[]>();
    for (const r of publishedRows) {
      const key = r.authorProfileId ?? "__none__";
      const existing = authorMap.get(key);
      if (existing) existing.articleIds.push(r.id);
      else
        authorMap.set(key, {
          authorProfileId: r.authorProfileId ?? null,
          authorName: r.authorName ?? "Unattributed",
          articleIds: [r.id],
        });
      const cat = r.category ?? "uncategorized";
      const catIds = categoryMap.get(cat);
      if (catIds) catIds.push(r.id);
      else categoryMap.set(cat, [r.id]);
    }

    // ---- Workflow: 5-day review SLA rate ----
    const slaConditions = [isNotNull(studioReviewAssignments.decisionAt)];
    if (since) slaConditions.push(gte(studioReviewAssignments.decisionAt, since));
    if (until) slaConditions.push(lte(studioReviewAssignments.decisionAt, until));
    if (projectId) slaConditions.push(eq(studioArticles.projectId, projectId));
    const slaRows = await db
      .select({
        createdAt: studioReviewAssignments.createdAt,
        decisionAt: studioReviewAssignments.decisionAt,
      })
      .from(studioReviewAssignments)
      .leftJoin(studioArticles, eq(studioReviewAssignments.articleId, studioArticles.id))
      .where(and(...slaConditions));
    const slaSampleSize = slaRows.length;
    let slaRatePct: number | null = null;
    if (slaSampleSize) {
      const within = slaRows.filter(
        (r) =>
          r.createdAt &&
          r.decisionAt &&
          businessDaysBetween(new Date(r.createdAt as any), new Date(r.decisionAt as any)) <= 5,
      ).length;
      slaRatePct = Math.round((within / slaSampleSize) * 1000) / 10;
    }

    // ---- Workflow: marketing rejection rate ----
    // marketing_recommended + marketing_rejected events (optionally project/time scoped).
    const marketingConditions = [
      inArray(studioAuditEvents.eventType, ["marketing_recommended", "marketing_rejected"]),
    ];
    if (since) marketingConditions.push(gte(studioAuditEvents.createdAt, since));
    if (until) marketingConditions.push(lte(studioAuditEvents.createdAt, until));
    if (projectId) marketingConditions.push(eq(studioArticles.projectId, projectId));
    const marketingRows = await db
      .select({ eventType: studioAuditEvents.eventType })
      .from(studioAuditEvents)
      .leftJoin(studioArticles, eq(studioAuditEvents.articleId, studioArticles.id))
      .where(and(...marketingConditions));
    const marketingDecisionCount = marketingRows.length;
    let marketingRejectionRatePct: number | null = null;
    if (marketingDecisionCount) {
      const rejected = marketingRows.filter((r) => r.eventType === "marketing_rejected").length;
      marketingRejectionRatePct = Math.round((rejected / marketingDecisionCount) * 1000) / 10;
    }

    // ---- Audience: views + cta clicks (audit events) ----
    const audienceConditions = [
      inArray(studioAuditEvents.eventType, ["article_viewed", "cta_clicked"]),
    ];
    if (since) audienceConditions.push(gte(studioAuditEvents.createdAt, since));
    if (until) audienceConditions.push(lte(studioAuditEvents.createdAt, until));
    if (projectId) audienceConditions.push(eq(studioArticles.projectId, projectId));
    const audienceRows = await db
      .select({
        eventType: studioAuditEvents.eventType,
        articleId: studioAuditEvents.articleId,
        title: studioArticles.title,
      })
      .from(studioAuditEvents)
      .leftJoin(studioArticles, eq(studioAuditEvents.articleId, studioArticles.id))
      .where(and(...audienceConditions));

    let views = 0;
    let ctaClicks = 0;
    const viewsByArticle = new Map<string, { title: string; views: number }>();
    const ctaByArticle = new Map<string, number>();
    for (const r of audienceRows) {
      if (r.eventType === "article_viewed") {
        views += 1;
        if (r.articleId) {
          const e = viewsByArticle.get(r.articleId);
          if (e) e.views += 1;
          else viewsByArticle.set(r.articleId, { title: r.title ?? "Untitled", views: 1 });
        }
      } else if (r.eventType === "cta_clicked") {
        ctaClicks += 1;
        if (r.articleId) ctaByArticle.set(r.articleId, (ctaByArticle.get(r.articleId) ?? 0) + 1);
      }
    }
    const ctaRatePct = views > 0 ? Math.round((ctaClicks / views) * 1000) / 10 : null;

    // ---- Audience: reactions by type ----
    const reactionConditions: SQL[] = [];
    if (since) reactionConditions.push(gte(studioArticleReactions.createdAt, since));
    if (until) reactionConditions.push(lte(studioArticleReactions.createdAt, until));
    if (projectId) reactionConditions.push(eq(studioArticles.projectId, projectId));
    const reactionRows = await db
      .select({
        reactionType: studioArticleReactions.reactionType,
        articleId: studioArticleReactions.articleId,
        count: sql<number>`count(*)::int`,
      })
      .from(studioArticleReactions)
      .leftJoin(studioArticles, eq(studioArticleReactions.articleId, studioArticles.id))
      .where(reactionConditions.length ? and(...reactionConditions) : undefined)
      .groupBy(studioArticleReactions.reactionType, studioArticleReactions.articleId);

    const reactionTypeMap = new Map<string, number>();
    const reactionsByArticle = new Map<string, number>();
    let totalReactions = 0;
    for (const r of reactionRows) {
      const c = Number(r.count);
      totalReactions += c;
      reactionTypeMap.set(r.reactionType, (reactionTypeMap.get(r.reactionType) ?? 0) + c);
      if (r.articleId) reactionsByArticle.set(r.articleId, (reactionsByArticle.get(r.articleId) ?? 0) + c);
    }
    const reactionsByType = Array.from(reactionTypeMap.entries())
      .map(([reactionType, count]) => ({ reactionType, count }))
      .sort((a, b) => b.count - a.count);

    // ---- Top articles (by views, enriched with reactions + CTA clicks) ----
    const articleIds = new Set<string>([
      ...viewsByArticle.keys(),
      ...reactionsByArticle.keys(),
      ...ctaByArticle.keys(),
    ]);
    const articleTitleById = new Map<string, string>();
    for (const r of publishedRows) articleTitleById.set(r.id, r.title ?? "Untitled");
    const topArticles = Array.from(articleIds)
      .map((id) => ({
        id,
        title: viewsByArticle.get(id)?.title ?? articleTitleById.get(id) ?? "Untitled",
        views: viewsByArticle.get(id)?.views ?? 0,
        reactions: reactionsByArticle.get(id) ?? 0,
        ctaClicks: ctaByArticle.get(id) ?? 0,
      }))
      .sort((a, b) => b.views - a.views || b.reactions - a.reactions || b.ctaClicks - a.ctaClicks)
      .slice(0, 5);

    // ---- Author leaderboard: published count + avg reactions per article ----
    const authorLeaderboard = Array.from(authorMap.values())
      .map((a) => {
        const totalAuthorReactions = a.articleIds.reduce(
          (sum, id) => sum + (reactionsByArticle.get(id) ?? 0),
          0,
        );
        const published = a.articleIds.length;
        return {
          authorProfileId: a.authorProfileId,
          authorName: a.authorName,
          published,
          avgReactionsPerArticle:
            published > 0 ? Math.round((totalAuthorReactions / published) * 10) / 10 : 0,
        };
      })
      .sort((a, b) => b.published - a.published || b.avgReactionsPerArticle - a.avgReactionsPerArticle);

    // ---- Category breakdown: published count + avg views per article ----
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, ids]) => {
        const totalCategoryViews = ids.reduce(
          (sum, id) => sum + (viewsByArticle.get(id)?.views ?? 0),
          0,
        );
        const published = ids.length;
        return {
          category,
          published,
          avgViewsPerCategory:
            published > 0 ? Math.round((totalCategoryViews / published) * 10) / 10 : 0,
        };
      })
      .sort((a, b) => b.published - a.published);

    // ---- Subscribers: total confirmed + new this calendar month ----
    const subscriberConditions = [
      isNotNull(studioNewsletterSubscribers.confirmedAt),
      isNull(studioNewsletterSubscribers.unsubscribedAt),
      isNull(studioNewsletterSubscribers.suppressedAt),
    ];
    if (projectId) subscriberConditions.push(eq(studioNewsletterSubscribers.projectId, projectId));
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [confirmedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(studioNewsletterSubscribers)
      .where(and(...subscriberConditions));
    const [newThisMonthRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(studioNewsletterSubscribers)
      .where(and(...subscriberConditions, gte(studioNewsletterSubscribers.confirmedAt, monthStart)));
    const subscribers = {
      confirmed: Number(confirmedRow?.count ?? 0),
      newThisMonth: Number(newThisMonthRow?.count ?? 0),
    };

    return {
      range: {
        dateFrom: since ? since.toISOString() : null,
        dateTo: until ? until.toISOString() : null,
      },
      workflow: {
        publishedCount,
        medianDraftToPublishDays,
        slaRatePct,
        slaSampleSize,
        marketingRejectionRatePct,
        marketingDecisionCount,
      },
      audience: {
        views,
        ctaClicks,
        ctaRatePct,
        reactionsByType,
        totalReactions,
      },
      topArticles,
      authorLeaderboard,
      categoryBreakdown,
      subscribers,
    };
  }

  // ---- Public reactions ----
  async isInsightPublished(articleId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: studioArticles.id })
      .from(studioArticles)
      .where(
        and(
          eq(studioArticles.id, articleId),
          eq(studioArticles.status, "published"),
        ),
      )
      .limit(1);
    return !!row;
  }

  async getArticleReactionCounts(articleId: string): Promise<Record<string, number>> {
    const rows = await db
      .select({
        reactionType: studioArticleReactions.reactionType,
        count: sql<number>`count(*)::int`,
      })
      .from(studioArticleReactions)
      .where(eq(studioArticleReactions.articleId, articleId))
      .groupBy(studioArticleReactions.reactionType);
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.reactionType] = Number(r.count);
    return counts;
  }

  async getUserArticleReaction(
    articleId: string,
    sessionHash: string,
  ): Promise<StudioArticleReaction | undefined> {
    const [row] = await db
      .select()
      .from(studioArticleReactions)
      .where(
        and(
          eq(studioArticleReactions.articleId, articleId),
          eq(studioArticleReactions.sessionHash, sessionHash),
        ),
      )
      .limit(1);
    return row;
  }

  // One reaction per (article, session). Re-clicking the same type removes it
  // (toggle off); clicking a different type switches the existing row.
  async toggleArticleReaction(
    articleId: string,
    sessionHash: string,
    reactionType: string,
  ): Promise<{ action: "added" | "removed" | "switched"; previousType: string | null; reactionType: string }> {
    const existing = await this.getUserArticleReaction(articleId, sessionHash);
    if (existing) {
      if (existing.reactionType === reactionType) {
        await db
          .delete(studioArticleReactions)
          .where(eq(studioArticleReactions.id, existing.id));
        return { action: "removed", previousType: existing.reactionType, reactionType };
      }
      await db
        .update(studioArticleReactions)
        .set({ reactionType })
        .where(eq(studioArticleReactions.id, existing.id));
      return { action: "switched", previousType: existing.reactionType, reactionType };
    }
    await db
      .insert(studioArticleReactions)
      .values({ articleId, sessionHash, reactionType });
    return { action: "added", previousType: null, reactionType };
  }

  async getStudioBrandSettings(): Promise<StudioBrandSettings | undefined> {
    const [row] = await db.select().from(studioBrandSettings).limit(1);
    return row;
  }

  async getCardTemplates(family?: string, includeInactive = false): Promise<CardTemplate[]> {
    const conditions = [
      family ? eq(cardTemplates.family, family) : undefined,
      includeInactive ? undefined : eq(cardTemplates.isActive, true),
    ].filter(Boolean) as SQL[];
    const whereClause =
      conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
    return await db
      .select()
      .from(cardTemplates)
      .where(whereClause)
      .orderBy(asc(cardTemplates.layout), asc(cardTemplates.platform));
  }

  async getCardTemplate(id: string): Promise<CardTemplate | undefined> {
    const [row] = await db
      .select()
      .from(cardTemplates)
      .where(eq(cardTemplates.id, id))
      .limit(1);
    return row;
  }

  async getCardTemplateFor(
    family: string,
    layout: string,
    platform: string,
    projectId?: string | null,
  ): Promise<CardTemplate | undefined> {
    // Prefer a project-specific override, then fall back to the global default.
    if (projectId) {
      const [override] = await db
        .select()
        .from(cardTemplates)
        .where(
          and(
            eq(cardTemplates.family, family),
            eq(cardTemplates.layout, layout),
            eq(cardTemplates.platform, platform),
            eq(cardTemplates.projectId, projectId),
            eq(cardTemplates.isActive, true),
          ),
        )
        .limit(1);
      if (override) return override;
    }
    const [global] = await db
      .select()
      .from(cardTemplates)
      .where(
        and(
          eq(cardTemplates.family, family),
          eq(cardTemplates.layout, layout),
          eq(cardTemplates.platform, platform),
          isNull(cardTemplates.projectId),
          eq(cardTemplates.isActive, true),
        ),
      )
      .limit(1);
    return global;
  }

  async updateCardTemplate(
    id: string,
    updates: Partial<InsertCardTemplate>,
  ): Promise<CardTemplate | undefined> {
    const [row] = await db
      .update(cardTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cardTemplates.id, id))
      .returning();
    return row;
  }

  async upsertCardTemplateByVariant(
    data: InsertCardTemplate,
  ): Promise<CardTemplate> {
    const existing = await db
      .select()
      .from(cardTemplates)
      .where(
        and(
          eq(cardTemplates.family, data.family),
          eq(cardTemplates.layout, data.layout),
          eq(cardTemplates.platform, data.platform),
          data.projectId
            ? eq(cardTemplates.projectId, data.projectId)
            : isNull(cardTemplates.projectId),
        ),
      )
      .limit(1);
    if (existing[0]) {
      const [row] = await db
        .update(cardTemplates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(cardTemplates.id, existing[0].id))
        .returning();
      return row;
    }
    const [row] = await db.insert(cardTemplates).values(data).returning();
    return row;
  }

  // ---- Prompt library ----
  async getStudioPromptTemplates(projectId?: string): Promise<StudioPromptTemplate[]> {
    const conditions = [eq(studioPromptTemplates.isActive, true)];
    if (projectId) {
      conditions.push(
        or(
          eq(studioPromptTemplates.projectId, projectId),
          isNull(studioPromptTemplates.projectId),
        )!,
      );
    }
    return await db
      .select()
      .from(studioPromptTemplates)
      .where(and(...conditions))
      .orderBy(asc(studioPromptTemplates.contentType), desc(studioPromptTemplates.version));
  }

  async getStudioPromptTemplate(id: string): Promise<StudioPromptTemplate | undefined> {
    const [row] = await db
      .select()
      .from(studioPromptTemplates)
      .where(eq(studioPromptTemplates.id, id));
    return row;
  }

  async getActiveStudioPromptTemplate(
    contentType: string,
    projectId?: string | null,
  ): Promise<StudioPromptTemplate | undefined> {
    // Prefer a project-specific template; fall back to a global one. Highest
    // version of the most recent active row wins.
    const rows = await db
      .select()
      .from(studioPromptTemplates)
      .where(
        and(
          eq(studioPromptTemplates.contentType, contentType),
          eq(studioPromptTemplates.isActive, true),
          projectId
            ? or(
                eq(studioPromptTemplates.projectId, projectId),
                isNull(studioPromptTemplates.projectId),
              )
            : isNull(studioPromptTemplates.projectId),
        ),
      )
      .orderBy(desc(studioPromptTemplates.version));
    // Project-specific first.
    const projectMatch = projectId ? rows.find((r) => r.projectId === projectId) : undefined;
    return projectMatch ?? rows[0];
  }

  // ---- Generation / audit records ----
  async createStudioGeneration(data: InsertStudioGeneration): Promise<StudioGeneration> {
    const [created] = await db.insert(studioGenerations).values(data).returning();
    return created;
  }

  async updateStudioGeneration(
    id: string,
    updates: Partial<InsertStudioGeneration>,
  ): Promise<StudioGeneration | undefined> {
    const [updated] = await db
      .update(studioGenerations)
      .set(updates)
      .where(eq(studioGenerations.id, id))
      .returning();
    return updated;
  }

  // ---- Projects (mutations + single fetch) ----
  async getStudioProject(id: string): Promise<StudioProject | undefined> {
    const [row] = await db.select().from(studioProjects).where(eq(studioProjects.id, id));
    return row;
  }

  async updateStudioProject(
    id: string,
    updates: Partial<InsertStudioProject>,
  ): Promise<StudioProject | undefined> {
    const [updated] = await db
      .update(studioProjects)
      .set(updates)
      .where(eq(studioProjects.id, id))
      .returning();
    return updated;
  }

  async getStudioGenerations(articleId: string): Promise<StudioGeneration[]> {
    return await db
      .select()
      .from(studioGenerations)
      .where(eq(studioGenerations.articleId, articleId))
      .orderBy(desc(studioGenerations.createdAt));
  }

  async countStudioGenerationsByUserSince(userId: string, since: Date): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(studioGenerations)
      .where(
        and(
          eq(studioGenerations.generatedByUserId, userId),
          sql`${studioGenerations.createdAt} >= ${since}`,
        ),
      );
    return count ?? 0;
  }

  // ---- Review assignments ----
  async createStudioReviewAssignment(
    data: InsertStudioReviewAssignment,
  ): Promise<StudioReviewAssignment> {
    const [created] = await db.insert(studioReviewAssignments).values(data).returning();
    return created;
  }

  async getStudioReviewAssignment(id: string): Promise<StudioReviewAssignment | undefined> {
    const [row] = await db
      .select()
      .from(studioReviewAssignments)
      .where(eq(studioReviewAssignments.id, id));
    return row;
  }

  async getActiveStudioReviewAssignment(
    articleId: string,
  ): Promise<StudioReviewAssignment | undefined> {
    const [row] = await db
      .select()
      .from(studioReviewAssignments)
      .where(
        and(
          eq(studioReviewAssignments.articleId, articleId),
          eq(studioReviewAssignments.status, "pending"),
        ),
      )
      .orderBy(desc(studioReviewAssignments.createdAt))
      .limit(1);
    return row;
  }

  async updateStudioReviewAssignment(
    id: string,
    updates: Partial<InsertStudioReviewAssignment>,
  ): Promise<StudioReviewAssignment | undefined> {
    const [updated] = await db
      .update(studioReviewAssignments)
      .set(updates)
      .where(eq(studioReviewAssignments.id, id))
      .returning();
    return updated;
  }

  async getStudioReviewAssignmentsForArticle(
    articleId: string,
  ): Promise<StudioReviewAssignment[]> {
    return await db
      .select()
      .from(studioReviewAssignments)
      .where(eq(studioReviewAssignments.articleId, articleId))
      .orderBy(desc(studioReviewAssignments.createdAt));
  }

  async getStudioInboxForReviewer(userId: string): Promise<(StudioReviewAssignment & {
    article: StudioArticle | null;
    projectName: string | null;
  })[]> {
    const rows = await db
      .select({
        assignment: studioReviewAssignments,
        article: studioArticles,
        projectName: studioProjects.name,
      })
      .from(studioReviewAssignments)
      .leftJoin(studioArticles, eq(studioReviewAssignments.articleId, studioArticles.id))
      .leftJoin(studioProjects, eq(studioArticles.projectId, studioProjects.id))
      .where(
        and(
          eq(studioReviewAssignments.reviewerUserId, userId),
          eq(studioReviewAssignments.status, "pending"),
        ),
      )
      .orderBy(asc(studioReviewAssignments.dueAt), desc(studioReviewAssignments.createdAt));
    return rows.map((r) => ({
      ...r.assignment,
      article: r.article ?? null,
      projectName: r.projectName ?? null,
    }));
  }

  async getLastStudioAssignmentTimes(
    reviewerUserIds: string[],
  ): Promise<Record<string, Date | null>> {
    const result: Record<string, Date | null> = {};
    for (const id of reviewerUserIds) result[id] = null;
    if (reviewerUserIds.length === 0) return result;
    const rows = await db
      .select({
        reviewerUserId: studioReviewAssignments.reviewerUserId,
        last: sql<Date>`max(${studioReviewAssignments.createdAt})`,
      })
      .from(studioReviewAssignments)
      .where(inArray(studioReviewAssignments.reviewerUserId, reviewerUserIds))
      .groupBy(studioReviewAssignments.reviewerUserId);
    for (const r of rows) {
      result[r.reviewerUserId] = r.last ? new Date(r.last as any) : null;
    }
    return result;
  }

  async getStudioApprovalQueue(statuses: string[], projectId?: string): Promise<(StudioArticle & {
    authorName: string | null;
    projectName: string | null;
    reviewerName: string | null;
  })[]> {
    if (statuses.length === 0) return [];
    const conditions = [inArray(studioArticles.status, statuses as any)];
    if (projectId) conditions.push(eq(studioArticles.projectId, projectId));
    const reviewer = alias(adminUsers, "reviewer_user");
    const rows = await db
      .select({
        article: studioArticles,
        authorName: studioAuthorProfiles.displayName,
        projectName: studioProjects.name,
        reviewerFirst: reviewer.firstName,
        reviewerLast: reviewer.lastName,
        reviewerEmail: reviewer.email,
      })
      .from(studioArticles)
      .leftJoin(studioAuthorProfiles, eq(studioArticles.authorProfileId, studioAuthorProfiles.id))
      .leftJoin(studioProjects, eq(studioArticles.projectId, studioProjects.id))
      .leftJoin(reviewer, eq(studioArticles.approvedBy, reviewer.id))
      .where(and(...conditions))
      // Oldest first — the queue should surface the longest-waiting article.
      .orderBy(asc(studioArticles.updatedAt));
    return rows.map((r) => {
      const rn = `${r.reviewerFirst ?? ""} ${r.reviewerLast ?? ""}`.trim();
      return {
        ...r.article,
        authorName: r.authorName ?? null,
        projectName: r.projectName ?? null,
        reviewerName: rn || r.reviewerEmail || null,
      };
    });
  }

  async getStudioWorkflowDetail(id: string): Promise<{
    article: StudioArticle;
    authorName: string | null;
    projectName: string | null;
    assignments: StudioReviewAssignment[];
    auditEvents: StudioAuditEvent[];
  } | undefined> {
    const [row] = await db
      .select({
        article: studioArticles,
        authorName: studioAuthorProfiles.displayName,
        projectName: studioProjects.name,
      })
      .from(studioArticles)
      .leftJoin(studioAuthorProfiles, eq(studioArticles.authorProfileId, studioAuthorProfiles.id))
      .leftJoin(studioProjects, eq(studioArticles.projectId, studioProjects.id))
      .where(eq(studioArticles.id, id));
    if (!row) return undefined;
    const assignments = await this.getStudioReviewAssignmentsForArticle(id);
    const auditEvents = await this.getStudioAuditEvents(id);
    return {
      article: row.article,
      authorName: row.authorName ?? null,
      projectName: row.projectName ?? null,
      assignments,
      auditEvents,
    };
  }

  async getStudioCalendarArticles(from: Date, to: Date, projectId?: string): Promise<(StudioArticle & {
    authorName: string | null;
    projectName: string | null;
    publishesToInsights: boolean;
  })[]> {
    const dateInRange = or(
      and(
        eq(studioArticles.status, "scheduled" as any),
        gte(studioArticles.scheduledAt, from),
        lte(studioArticles.scheduledAt, to),
      ),
      and(
        eq(studioArticles.status, "published" as any),
        gte(studioArticles.publishedAt, from),
        lte(studioArticles.publishedAt, to),
      ),
      // Draft stubs with a scheduled date (e.g. from AI plan) appear as "Planned Draft" chips.
      and(
        eq(studioArticles.status, "draft" as any),
        isNotNull(studioArticles.scheduledAt),
        gte(studioArticles.scheduledAt, from),
        lte(studioArticles.scheduledAt, to),
      ),
    );
    const conditions = [dateInRange];
    if (projectId) conditions.push(eq(studioArticles.projectId, projectId));
    const rows = await db
      .select({
        article: studioArticles,
        authorName: studioAuthorProfiles.displayName,
        projectName: studioProjects.name,
        publishesToInsights: studioProjects.publishesToInsights,
      })
      .from(studioArticles)
      .leftJoin(studioAuthorProfiles, eq(studioArticles.authorProfileId, studioAuthorProfiles.id))
      .leftJoin(studioProjects, eq(studioArticles.projectId, studioProjects.id))
      .where(and(...conditions));
    return rows.map((r) => ({
      ...r.article,
      authorName: r.authorName ?? null,
      projectName: r.projectName ?? null,
      publishesToInsights: r.publishesToInsights ?? false,
    }));
  }

  async getDueScheduledStudioArticles(now: Date): Promise<StudioArticle[]> {
    return await db
      .select()
      .from(studioArticles)
      .where(
        and(
          eq(studioArticles.status, "scheduled" as any),
          lte(studioArticles.scheduledAt, now),
        ),
      );
  }

  // ---- Public Insights read path -----------------------------------------
  // Only published articles belonging to an insights-enabled project (Hire'in)
  // with a non-empty slug are exposed publicly.
  private insightSelect() {
    return {
      article: studioArticles,
      authorName: studioAuthorProfiles.displayName,
      authorTitle: studioAuthorProfiles.title,
      authorBio: studioAuthorProfiles.bio,
      authorPhotoUrl: studioAuthorProfiles.photoUrl,
      authorLinkedinUrl: studioAuthorProfiles.linkedinUrl,
      authorSlug: studioAuthorProfiles.slug,
      authorProfileComplete: studioAuthorProfiles.profileComplete,
    };
  }

  private mapInsightRow(r: any): PublicInsightArticle {
    return {
      ...r.article,
      authorName: r.authorName ?? null,
      authorTitle: r.authorTitle ?? null,
      authorBio: r.authorBio ?? null,
      authorPhotoUrl: r.authorPhotoUrl ?? null,
      authorLinkedinUrl: r.authorLinkedinUrl ?? null,
      authorSlug: r.authorSlug ?? null,
      authorProfileComplete: r.authorProfileComplete ?? false,
    };
  }

  async getPublishedInsights(filters: {
    category?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: PublicInsightArticle[]; total: number }> {
    const conditions = [
      eq(studioArticles.status, "published" as any),
      eq(studioProjects.publishesToInsights, true),
      isNotNull(studioArticles.slug),
      ne(studioArticles.slug, ""),
    ];
    if (filters.category) {
      conditions.push(eq(studioArticles.category, filters.category));
    }
    const whereClause = and(...conditions);

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12));

    const [{ count: total }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(studioArticles)
      .innerJoin(studioProjects, eq(studioArticles.projectId, studioProjects.id))
      .where(whereClause);

    const rows = await db
      .select(this.insightSelect())
      .from(studioArticles)
      .innerJoin(studioProjects, eq(studioArticles.projectId, studioProjects.id))
      .leftJoin(studioAuthorProfiles, eq(studioArticles.authorProfileId, studioAuthorProfiles.id))
      .where(whereClause)
      .orderBy(desc(studioArticles.publishedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { items: rows.map((r) => this.mapInsightRow(r)), total };
  }

  async getPublishedInsightBySlug(slug: string): Promise<PublicInsightArticle | undefined> {
    const [row] = await db
      .select(this.insightSelect())
      .from(studioArticles)
      .innerJoin(studioProjects, eq(studioArticles.projectId, studioProjects.id))
      .leftJoin(studioAuthorProfiles, eq(studioArticles.authorProfileId, studioAuthorProfiles.id))
      .where(
        and(
          eq(studioArticles.slug, slug),
          eq(studioArticles.status, "published" as any),
          eq(studioProjects.publishesToInsights, true),
        ),
      )
      .limit(1);
    return row ? this.mapInsightRow(row) : undefined;
  }

  async getRelatedInsights(
    articleId: string,
    category: string | null,
    limit: number,
  ): Promise<PublicInsightArticle[]> {
    const conditions = [
      eq(studioArticles.status, "published" as any),
      eq(studioProjects.publishesToInsights, true),
      isNotNull(studioArticles.slug),
      ne(studioArticles.slug, ""),
      ne(studioArticles.id, articleId),
    ];
    if (category) {
      conditions.push(eq(studioArticles.category, category));
    }
    const rows = await db
      .select(this.insightSelect())
      .from(studioArticles)
      .innerJoin(studioProjects, eq(studioArticles.projectId, studioProjects.id))
      .leftJoin(studioAuthorProfiles, eq(studioArticles.authorProfileId, studioAuthorProfiles.id))
      .where(and(...conditions))
      .orderBy(desc(studioArticles.publishedAt))
      .limit(Math.max(1, limit));
    return rows.map((r) => this.mapInsightRow(r));
  }

  async getPublishedInsightSlugs(): Promise<{ slug: string; publishedAt: Date | null; updatedAt: Date }[]> {
    const rows = await db
      .select({
        slug: studioArticles.slug,
        publishedAt: studioArticles.publishedAt,
        updatedAt: studioArticles.updatedAt,
      })
      .from(studioArticles)
      .innerJoin(studioProjects, eq(studioArticles.projectId, studioProjects.id))
      .where(
        and(
          eq(studioArticles.status, "published" as any),
          eq(studioProjects.publishesToInsights, true),
          isNotNull(studioArticles.slug),
          ne(studioArticles.slug, ""),
        ),
      )
      .orderBy(desc(studioArticles.publishedAt));
    return rows
      .filter((r) => !!r.slug)
      .map((r) => ({ slug: r.slug as string, publishedAt: r.publishedAt, updatedAt: r.updatedAt }));
  }

  // ---- Newsletter subscribers ----
  async getNewsletterSubscriberByEmail(email: string): Promise<StudioNewsletterSubscriber | undefined> {
    const [row] = await db
      .select()
      .from(studioNewsletterSubscribers)
      .where(eq(studioNewsletterSubscribers.email, email.toLowerCase()));
    return row;
  }

  async getNewsletterSubscriber(id: string): Promise<StudioNewsletterSubscriber | undefined> {
    const [row] = await db
      .select()
      .from(studioNewsletterSubscribers)
      .where(eq(studioNewsletterSubscribers.id, id));
    return row;
  }

  async createNewsletterSubscriber(data: InsertStudioNewsletterSubscriber): Promise<StudioNewsletterSubscriber> {
    const [row] = await db
      .insert(studioNewsletterSubscribers)
      .values({ ...data, email: data.email.toLowerCase() })
      .returning();
    return row;
  }

  async updateNewsletterSubscriber(
    id: string,
    updates: Partial<StudioNewsletterSubscriber>,
  ): Promise<StudioNewsletterSubscriber | undefined> {
    const [row] = await db
      .update(studioNewsletterSubscribers)
      .set(updates)
      .where(eq(studioNewsletterSubscribers.id, id))
      .returning();
    return row;
  }

  async getActiveNewsletterSubscribers(): Promise<StudioNewsletterSubscriber[]> {
    return db
      .select()
      .from(studioNewsletterSubscribers)
      .where(
        and(
          isNull(studioNewsletterSubscribers.unsubscribedAt),
          isNull(studioNewsletterSubscribers.suppressedAt),
        ),
      );
  }

  async getAllNewsletterSubscribers(): Promise<StudioNewsletterSubscriber[]> {
    return db
      .select()
      .from(studioNewsletterSubscribers)
      .orderBy(desc(studioNewsletterSubscribers.createdAt));
  }

  async getNewsletterSubscriberCounts(): Promise<{ active: number; unsubscribed: number; suppressed: number }> {
    const rows = await db.select().from(studioNewsletterSubscribers);
    let active = 0;
    let unsubscribed = 0;
    let suppressed = 0;
    for (const r of rows) {
      if (r.suppressedAt) suppressed++;
      else if (r.unsubscribedAt) unsubscribed++;
      else active++;
    }
    return { active, unsubscribed, suppressed };
  }

}

export const storage = new DatabaseStorage();
