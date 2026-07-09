import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { resolveSettingsRedirect } from "@/lib/settings-redirect";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import About from "@/pages/About";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import Contact from "@/pages/Contact";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import HealthcareRecruitment from "@/pages/services/HealthcareRecruitment";
import ITSoftware from "@/pages/services/ITSoftware";
import EngineeringTechnical from "@/pages/services/EngineeringTechnical";
import ProfessionalServices from "@/pages/services/ProfessionalServices";
import ContractStaffing from "@/pages/services/ContractStaffing";
import CapabilityDeck from "@/pages/CapabilityDeck";
import ITStaffing from "@/pages/ITStaffing";
import EHealthcareStaffing from "@/pages/EHealthcareStaffing";
import WhyHireIn from "@/pages/WhyHireIn";
import ITStaffingGuide from "@/pages/ITStaffingGuide";
import HealthcareStaffingGuide from "@/pages/HealthcareStaffingGuide";
import StaffingFAQ from "@/pages/StaffingFAQ";
import RequestAQuote from "@/pages/RequestAQuote";
import OnboardAccept from "@/pages/OnboardAccept";
import AddendumAccept from "@/pages/AddendumAccept";
import VerifyLetter from "@/pages/VerifyLetter";
import Contracts from "@/pages/Contracts";
import ContractSign from "@/pages/ContractSign";
import Insights from "@/pages/Insights";
import InsightArticle from "@/pages/InsightArticle";

const AdminLogin = lazy(() => import("@/pages/admin/Login"));
const ForgotPassword = lazy(() => import("@/pages/admin/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/admin/ResetPassword"));
const AdminContacts = lazy(() => import("@/pages/admin/Contacts"));
const Recruitment = lazy(() => import("@/pages/admin/Recruitment"));
const JobApplications = lazy(() => import("@/pages/admin/JobApplications"));
const MyWork = lazy(() => import("@/pages/admin/hr/MyWork"));
const MyDesk = lazy(() => import("@/pages/admin/my-desk/MyDesk"));
const ServiceDesk = lazy(() => import("@/pages/admin/service-desk/ServiceDesk"));
const MyProfile = lazy(() => import("@/pages/admin/MyProfile"));
const MyGrowth = lazy(() => import("@/pages/admin/MyGrowth"));
const PeopleHR = lazy(() => import("@/pages/admin/PeopleHR"));
const MyTeamTabs = lazy(() => import("@/pages/admin/hr/MyTeamTabs"));
const HRDashboard = lazy(() => import("@/pages/admin/hr/HRDashboard"));
const HRAttendance = lazy(() => import("@/pages/admin/hr/Attendance"));
const HRLeaveManagement = lazy(() => import("@/pages/admin/hr/LeaveManagement"));
const HRHolidayCalendar = lazy(() => import("@/pages/admin/hr/HolidayCalendar"));
const HRProfile = lazy(() => import("@/pages/admin/hr/Profile"));
const HRLeaveApprovals = lazy(() => import("@/pages/admin/hr/LeaveApprovals"));
const HRSettings = lazy(() => import("@/pages/admin/hr/HRSettings"));
const OrgChart = lazy(() => import("@/pages/admin/hr/OrgChart"));
const SalarySlips = lazy(() => import("@/pages/admin/hr/SalarySlips"));
const SalaryAdvance = lazy(() => import("@/pages/admin/SalaryAdvance"));
const MyDocuments = lazy(() => import("@/pages/admin/hr/MyDocuments"));
const HRTools = lazy(() => import("@/pages/admin/hr/HRTools"));
const MyTraining = lazy(() => import("@/pages/admin/hr/MyTraining"));
const TeamAttendance = lazy(() => import("@/pages/admin/hr/TeamAttendance"));
const TrainingProgress = lazy(() => import("@/pages/admin/hr/TrainingProgress"));
const ReportsCompliance = lazy(() => import("@/pages/admin/hr/ReportsCompliance"));
const AdminUsers = lazy(() => import("@/pages/admin/Users"));
const Goals = lazy(() => import("@/pages/admin/performance/Goals"));
const PerformanceCheckIns = lazy(() => import("@/pages/admin/performance/CheckIns"));
const Reviews = lazy(() => import("@/pages/admin/performance/Reviews"));
const PerformanceFeedback = lazy(() => import("@/pages/admin/performance/Feedback"));
const PerformanceReviewCycles = lazy(() => import("@/pages/admin/performance/ReviewCycles"));
const PerformanceAnalytics = lazy(() => import("@/pages/admin/performance/Analytics"));
const ProbationGuide = lazy(() => import("@/pages/admin/probation/ProbationGuide"));
const PolicyGate = lazy(() => import("@/pages/admin/PolicyGate"));
const NewHire = lazy(() => import("@/pages/admin/NewHire"));
const ContractsHub = lazy(() => import("@/pages/admin/finance/ContractsHub"));
const Studio = lazy(() => import("@/pages/admin/studio/Studio"));
const StudioArticles = lazy(() => import("@/pages/admin/studio/Articles"));
const StudioLiveContent = lazy(() => import("@/pages/admin/studio/LiveContent"));
const StudioAuthors = lazy(() => import("@/pages/admin/studio/Authors"));
const StudioArticleEditor = lazy(() => import("@/pages/admin/studio/ArticleEditor"));
const StudioInbox = lazy(() => import("@/pages/admin/studio/Inbox"));
const StudioReviewArticle = lazy(() => import("@/pages/admin/studio/ReviewArticle"));
const StudioApprovals = lazy(() => import("@/pages/admin/studio/Approvals"));
const StudioFinalApproval = lazy(() => import("@/pages/admin/studio/FinalApproval"));
const StudioCMReview = lazy(() => import("@/pages/admin/studio/CMReview"));
const StudioAuthorSignOff = lazy(() => import("@/pages/admin/studio/AuthorSignOff"));
const ControlTower = lazy(() => import("@/pages/admin/ControlTower"));
const HelpDesk = lazy(() => import("@/pages/admin/HelpDesk"));
const HelpDeskTicket = lazy(() => import("@/pages/admin/HelpDeskTicket"));
const StudioCalendar = lazy(() => import("@/pages/admin/studio/Calendar"));
const StudioTemplateSettings = lazy(() => import("@/pages/admin/studio/TemplateSettings"));
const StudioSubscribers = lazy(() => import("@/pages/admin/studio/Subscribers"));
const StudioAnalytics = lazy(() => import("@/pages/admin/studio/Analytics"));
const StudioAccess = lazy(() => import("@/pages/admin/studio/StudioAccess"));
const PolicySigningPage = lazy(() => import("@/pages/admin/hr/PolicySigningPage"));
const TravelCalculator = lazy(() => import("@/pages/admin/TravelCalculator"));
const Communications = lazy(() => import("@/pages/admin/Communications"));
const SOPLibrary = lazy(() => import("@/pages/admin/sops/SOPLibrary"));
const SOPCompliance = lazy(() => import("@/pages/admin/sops/SOPCompliance"));
const MySopReviews = lazy(() => import("@/pages/admin/sops/MySopReviews"));
const TrainingCatalog = lazy(() => import("@/pages/admin/training/TrainingCatalog"));
const ExecCockpit = lazy(() => import("@/pages/admin/ExecCockpit"));
const VaultPage = lazy(() => import("@/pages/admin/vault/VaultPage"));
const VaultAuditPage = lazy(() => import("@/pages/admin/vault/VaultAuditPage"));
const BulkPayrollRun = lazy(() => import("@/pages/admin/payroll/BulkPayrollRun"));
const ExecutiveDashboard = lazy(() => import("@/pages/admin/payroll/ExecutiveDashboard"));

const HR_TAB_MAP: Record<string, string> = {
  attendance: "time-card",
  "time-card": "time-card",
  grace: "grace",
  leaves: "leave-balance",
  "time-off": "leave-balance",
  "leave-balance": "leave-balance",
  "apply-leave": "apply-leave",
  "leave-history": "leave-history",
  accrual: "accrual",
  holidays: "leave-calendar",
  "leave-calendar": "leave-calendar",
  regularizations: "regularizations",
  tickets: "regularizations",
};

const EXEC_ROLES = ["executive", "super_admin"] as const;

function RequireRoles({ roles, children }: { roles: readonly string[]; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user && !roles.includes(user.role)) {
      setLocation("/admin/my-desk");
    }
  }, [isLoading, user, roles, setLocation]);

  if (isLoading) return <AdminFallback />;
  if (!user) return <AdminFallback />;
  if (!roles.includes(user.role)) return <AdminFallback />;

  return <>{children}</>;
}

function AdminHomeRedirect() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  useEffect(() => {
    if (isLoading) return;
    if (user?.role === "executive") {
      setLocation("/admin/executive-cockpit");
    } else {
      setLocation("/admin/my-desk");
    }
  }, [user, isLoading, setLocation]);
  return null;
}

function HRTabRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    const mapped = tab ? HR_TAB_MAP[tab] : undefined;
    setLocation(mapped ? `/admin/my-desk?tab=${mapped}` : "/admin/my-desk");
  }, []);
  return null;
}

function LegacySettingsRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(resolveSettingsRedirect(window.location.search));
  }, []);
  return null;
}

function AdminFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}

function isEmployeeSubdomain(): boolean {
  if (typeof (window as any).__IS_EMPLOYEE_SUBDOMAIN__ === "boolean") {
    return (window as any).__IS_EMPLOYEE_SUBDOMAIN__;
  }
  const hostname = window.location.hostname;
  if (hostname.startsWith("employee.") || hostname.startsWith("www.employee.")) {
    return true;
  }
  if (hostname.endsWith(".replit.dev") || hostname === "localhost") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("employee") === "true") {
      return true;
    }
  }
  return false;
}

function PublicRouter() {
  return (
    <Switch>
      {/* Public pages */}
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/contracts" component={Contracts} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/jobs/:id" component={JobDetail} />
      <Route path="/insights" component={Insights} />
      <Route path="/insights/authors/:slug" component={lazy(() => import("@/pages/InsightAuthor"))} />
      <Route path="/insights/authors" component={lazy(() => import("@/pages/InsightAuthors"))} />
      <Route path="/insights/:slug" component={InsightArticle} />
      <Route path="/contact" component={Contact} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/services/healthcare-recruitment" component={HealthcareRecruitment} />
      <Route path="/services/it-software" component={ITSoftware} />
      <Route path="/services/engineering-technical" component={EngineeringTechnical} />
      <Route path="/services/non-it-professional" component={ProfessionalServices} />
      <Route path="/services/contract-staffing" component={ContractStaffing} />
      <Route path="/capability-deck" component={CapabilityDeck} />
      <Route path="/it-staffing" component={ITStaffing} />
      <Route path="/ehealthcare-staffing" component={EHealthcareStaffing} />
      <Route path="/why-hire-in-solutions" component={WhyHireIn} />
      <Route path="/it-staffing-guide" component={ITStaffingGuide} />
      <Route path="/healthcare-staffing-guide" component={HealthcareStaffingGuide} />
      <Route path="/staffing-faq" component={StaffingFAQ} />
      <Route path="/request-a-quote" component={RequestAQuote} />
      <Route path="/onboard/:token" component={OnboardAccept} />
      <Route path="/addendum/:token" component={AddendumAccept} />
      <Route path="/verify" component={VerifyLetter} />

      {/* Admin auth */}
      <Route path="/admin/login">{() => <Suspense fallback={<AdminFallback />}><AdminLogin /></Suspense>}</Route>
      <Route path="/admin/forgot-password">{() => <Suspense fallback={<AdminFallback />}><ForgotPassword /></Suspense>}</Route>
      <Route path="/admin/reset-password">{() => <Suspense fallback={<AdminFallback />}><ResetPassword /></Suspense>}</Route>

      {/* Admin root → role-aware home */}
      <Route path="/admin">{() => <AdminHomeRedirect />}</Route>
      <Route path="/admin/executive-cockpit">{() => <RequireRoles roles={EXEC_ROLES}><Suspense fallback={<AdminFallback />}><ExecCockpit /></Suspense></RequireRoles>}</Route>

      {/* Command Center */}
      <Route path="/admin/my-desk">{() => <Suspense fallback={<AdminFallback />}><MyDesk /></Suspense>}</Route>
      <Route path="/admin/service-desk">{() => <Suspense fallback={<AdminFallback />}><ServiceDesk /></Suspense>}</Route>

      {/* Legacy My Work → smart tab-mapping redirect */}
      <Route path="/admin/hr">{() => <HRTabRedirect />}</Route>

      {/* Consolidated tab pages (primary nav) */}
      <Route path="/admin/profile">{() => <Suspense fallback={<AdminFallback />}><MyProfile /></Suspense>}</Route>
      <Route path="/admin/growth">{() => <Suspense fallback={<AdminFallback />}><MyGrowth /></Suspense>}</Route>
      <Route path="/admin/hr/my-team">{() => <Suspense fallback={<AdminFallback />}><MyTeamTabs /></Suspense>}</Route>
      <Route path="/admin/hr/people">{() => <Suspense fallback={<AdminFallback />}><PeopleHR /></Suspense>}</Route>

      {/* Recruitment / Jobs */}
      <Route path="/admin/recruitment">{() => <Suspense fallback={<AdminFallback />}><Recruitment /></Suspense>}</Route>
      <Route path="/admin/applications/job/:jobId">{(params) => <Suspense fallback={<AdminFallback />}><JobApplications /></Suspense>}</Route>
      <Route path="/admin/contacts">{() => <Suspense fallback={<AdminFallback />}><AdminContacts /></Suspense>}</Route>
      <Route path="/admin/jobs">{() => <Redirect to="/admin/recruitment" />}</Route>
      <Route path="/admin/applications">{() => <Redirect to="/admin/recruitment?tab=applications" />}</Route>

      {/* New Hire */}
      <Route path="/admin/new-hire">{() => <Suspense fallback={<AdminFallback />}><NewHire /></Suspense>}</Route>

      {/* Travel Pay Calculator */}
      <Route path="/admin/travel-calculator">{() => <Suspense fallback={<AdminFallback />}><TravelCalculator /></Suspense>}</Route>

      {/* Communications — What's New + Release Notes */}
      <Route path="/admin/communications">{() => <Suspense fallback={<AdminFallback />}><Communications /></Suspense>}</Route>

      {/* Process Governance Center — SOP library */}
      <Route path="/admin/sops/compliance">{() => <Suspense fallback={<AdminFallback />}><SOPCompliance /></Suspense>}</Route>
      <Route path="/admin/sops/my-reviews">{() => <Suspense fallback={<AdminFallback />}><MySopReviews /></Suspense>}</Route>
      <Route path="/admin/sops">{() => <Suspense fallback={<AdminFallback />}><SOPLibrary /></Suspense>}</Route>

      {/* Training Catalog */}
      <Route path="/admin/training/catalog">{() => <Suspense fallback={<AdminFallback />}><TrainingCatalog /></Suspense>}</Route>

      {/* Personal My Work routes → redirected to Command Center / My Desk tabs */}
      <Route path="/admin/hr/dashboard">{() => <Redirect to="/admin/my-desk" />}</Route>
      <Route path="/admin/hr/attendance">{() => <Redirect to="/admin/my-desk?tab=time-card" />}</Route>
      <Route path="/admin/hr/leaves">{() => <Redirect to="/admin/my-desk?tab=leave-balance" />}</Route>
      <Route path="/admin/hr/holidays">{() => <Redirect to="/admin/my-desk?tab=leave-calendar" />}</Route>
      <Route path="/admin/hr/tickets">{() => <Redirect to="/admin/my-desk?tab=regularizations" />}</Route>

      {/* HR management / tool pages — remain at their paths */}
      <Route path="/admin/hr/profile">{() => <Suspense fallback={<AdminFallback />}><HRProfile /></Suspense>}</Route>
      <Route path="/admin/hr/team-attendance">{() => <Suspense fallback={<AdminFallback />}><TeamAttendance /></Suspense>}</Route>
      <Route path="/admin/hr/leave-approvals">{() => <Suspense fallback={<AdminFallback />}><HRLeaveApprovals /></Suspense>}</Route>
      {/* Settings — promoted to top-level nav with per-sub-category routes */}
      <Route path="/admin/settings/:group">{(params) => <Suspense fallback={<AdminFallback />}><HRSettings group={params.group} /></Suspense>}</Route>
      <Route path="/admin/settings">{() => <LegacySettingsRedirect />}</Route>
      <Route path="/admin/hr/settings">{() => <LegacySettingsRedirect />}</Route>
      <Route path="/admin/hr/org-chart">{() => <Suspense fallback={<AdminFallback />}><OrgChart /></Suspense>}</Route>
      <Route path="/admin/hr/salary-slips">{() => <Redirect to="/admin/my-desk?tab=payslips" />}</Route>
      <Route path="/admin/salary-advance">{() => <Suspense fallback={<AdminFallback />}><SalaryAdvance /></Suspense>}</Route>
      <Route path="/admin/hr/my-documents">{() => <Suspense fallback={<AdminFallback />}><MyDocuments /></Suspense>}</Route>
      <Route path="/admin/hr/tools">{() => <Suspense fallback={<AdminFallback />}><HRTools /></Suspense>}</Route>
      <Route path="/admin/hr/my-training">{() => <Suspense fallback={<AdminFallback />}><MyTraining /></Suspense>}</Route>
      <Route path="/admin/hr/training">{() => <Redirect to="/admin/growth?tab=training-mgmt" />}</Route>
      <Route path="/admin/hr/training-progress">{() => <Suspense fallback={<AdminFallback />}><TrainingProgress /></Suspense>}</Route>
      <Route path="/admin/hr/reports">{() => <Suspense fallback={<AdminFallback />}><ReportsCompliance /></Suspense>}</Route>
      <Route path="/admin/users">{() => <Suspense fallback={<AdminFallback />}><AdminUsers /></Suspense>}</Route>
      <Route path="/admin/policy-gate">{() => <Suspense fallback={<AdminFallback />}><PolicyGate /></Suspense>}</Route>
      <Route path="/admin/hr/documents/policy/:signingId">{() => <Suspense fallback={<AdminFallback />}><PolicySigningPage /></Suspense>}</Route>

      {/* Legacy redirect patterns */}
      <Route path="/admin/hr/salary-reports">{() => <Redirect to="/admin/hr/people?tab=salary" />}</Route>
      <Route path="/admin/hr/document-compliance">{() => <Redirect to="/admin/hr/people?tab=compliance" />}</Route>
      <Route path="/admin/audit-logs">{() => <Redirect to="/admin/hr/people?tab=audit" />}</Route>

      {/* Finance & Contracts */}
      <Route path="/admin/finance">{() => <Suspense fallback={<AdminFallback />}><ContractsHub /></Suspense>}</Route>

      {/* Help Desk */}
      <Route path="/admin/help-desk/:id">{() => <Suspense fallback={<AdminFallback />}><HelpDeskTicket /></Suspense>}</Route>
      <Route path="/admin/help-desk">{() => <Suspense fallback={<AdminFallback />}><HelpDesk /></Suspense>}</Route>

      {/* Content Studio */}
      <Route path="/admin/studio/articles/:id/review">{() => <Suspense fallback={<AdminFallback />}><StudioReviewArticle /></Suspense>}</Route>
      <Route path="/admin/studio/articles/:id/author-signoff">{() => <Suspense fallback={<AdminFallback />}><StudioAuthorSignOff /></Suspense>}</Route>
      <Route path="/admin/studio/articles/:id/edit">{() => <Suspense fallback={<AdminFallback />}><StudioArticleEditor /></Suspense>}</Route>
      <Route path="/admin/studio/articles">{() => <Suspense fallback={<AdminFallback />}><StudioArticles /></Suspense>}</Route>
      <Route path="/admin/studio/live">{() => <Suspense fallback={<AdminFallback />}><StudioLiveContent /></Suspense>}</Route>
      <Route path="/admin/studio/authors">{() => <Suspense fallback={<AdminFallback />}><StudioAuthors /></Suspense>}</Route>
      <Route path="/admin/studio/inbox">{() => <Suspense fallback={<AdminFallback />}><StudioInbox /></Suspense>}</Route>
      <Route path="/admin/studio/cm-review">{() => <Suspense fallback={<AdminFallback />}><StudioCMReview /></Suspense>}</Route>
      <Route path="/admin/studio/approvals">{() => <Suspense fallback={<AdminFallback />}><StudioApprovals /></Suspense>}</Route>
      <Route path="/admin/studio/final-approval">{() => <Suspense fallback={<AdminFallback />}><StudioFinalApproval /></Suspense>}</Route>
      <Route path="/admin/automated-changes">{() => <Redirect to="/admin/control-tower?tab=automated-changes" />}</Route>
      <Route path="/admin/control-tower">{() => <Suspense fallback={<AdminFallback />}><ControlTower /></Suspense>}</Route>
      <Route path="/admin/studio/calendar">{() => <Suspense fallback={<AdminFallback />}><StudioCalendar /></Suspense>}</Route>
      <Route path="/admin/studio/settings/templates">{() => <Suspense fallback={<AdminFallback />}><StudioTemplateSettings /></Suspense>}</Route>
      <Route path="/admin/studio/subscribers">{() => <Suspense fallback={<AdminFallback />}><StudioSubscribers /></Suspense>}</Route>
      <Route path="/admin/studio/analytics">{() => <Suspense fallback={<AdminFallback />}><StudioAnalytics /></Suspense>}</Route>
      <Route path="/admin/studio/access">{() => <Suspense fallback={<AdminFallback />}><StudioAccess /></Suspense>}</Route>
      <Route path="/admin/studio">{() => <Suspense fallback={<AdminFallback />}><Studio /></Suspense>}</Route>

      {/* Public contract signing */}
      <Route path="/contracts/sign/:token" component={ContractSign} />

      {/* Performance pages */}
      <Route path="/admin/performance/goals">{() => <Suspense fallback={<AdminFallback />}><Goals /></Suspense>}</Route>
      <Route path="/admin/performance/check-ins">{() => <Suspense fallback={<AdminFallback />}><PerformanceCheckIns mode="mine" /></Suspense>}</Route>
      <Route path="/admin/performance/reviews">{() => <Suspense fallback={<AdminFallback />}><Reviews /></Suspense>}</Route>
      <Route path="/admin/performance/review-cycles">{() => <Suspense fallback={<AdminFallback />}><PerformanceReviewCycles /></Suspense>}</Route>
      <Route path="/admin/performance/feedback">{() => <Suspense fallback={<AdminFallback />}><PerformanceFeedback /></Suspense>}</Route>
      <Route path="/admin/performance/analytics">{() => <Suspense fallback={<AdminFallback />}><PerformanceAnalytics /></Suspense>}</Route>
      <Route path="/admin/probation-guide">{() => <Suspense fallback={<AdminFallback />}><ProbationGuide /></Suspense>}</Route>
      <Route path="/admin/performance/team-goals">{() => <Redirect to="/admin/growth?tab=team-goals" />}</Route>
      <Route path="/admin/performance/team-reviews">{() => <Redirect to="/admin/growth?tab=team-reviews" />}</Route>

      {/* Systems Vault */}
      <Route path="/admin/vault/audit">{() => <Suspense fallback={<AdminFallback />}><VaultAuditPage /></Suspense>}</Route>
      <Route path="/admin/vault">{() => <Suspense fallback={<AdminFallback />}><VaultPage /></Suspense>}</Route>

      {/* Payroll */}
      <Route path="/admin/payroll/run">{() => <Suspense fallback={<AdminFallback />}><BulkPayrollRun /></Suspense>}</Route>
      <Route path="/admin/payroll/executive">{() => <Suspense fallback={<AdminFallback />}><ExecutiveDashboard /></Suspense>}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function EmployeeRouter() {
  return (
    <Switch>
      <Route path="/">{() => <Redirect to="/admin/login" />}</Route>
      <Route path="/login">{() => <Redirect to="/admin/login" />}</Route>
      <Route path="/onboard/:token" component={OnboardAccept} />
      <Route path="/addendum/:token" component={AddendumAccept} />
      <Route path="/verify" component={VerifyLetter} />

      {/* Admin auth */}
      <Route path="/admin/login">{() => <Suspense fallback={<AdminFallback />}><AdminLogin /></Suspense>}</Route>
      <Route path="/admin/forgot-password">{() => <Suspense fallback={<AdminFallback />}><ForgotPassword /></Suspense>}</Route>
      <Route path="/admin/reset-password">{() => <Suspense fallback={<AdminFallback />}><ResetPassword /></Suspense>}</Route>

      {/* Admin root → role-aware home */}
      <Route path="/admin">{() => <AdminHomeRedirect />}</Route>
      <Route path="/admin/executive-cockpit">{() => <RequireRoles roles={EXEC_ROLES}><Suspense fallback={<AdminFallback />}><ExecCockpit /></Suspense></RequireRoles>}</Route>

      {/* Command Center */}
      <Route path="/admin/my-desk">{() => <Suspense fallback={<AdminFallback />}><MyDesk /></Suspense>}</Route>
      <Route path="/admin/service-desk">{() => <Suspense fallback={<AdminFallback />}><ServiceDesk /></Suspense>}</Route>

      {/* Legacy My Work → smart tab-mapping redirect */}
      <Route path="/admin/hr">{() => <HRTabRedirect />}</Route>

      {/* Consolidated tab pages (primary nav) */}
      <Route path="/admin/profile">{() => <Suspense fallback={<AdminFallback />}><MyProfile /></Suspense>}</Route>
      <Route path="/admin/growth">{() => <Suspense fallback={<AdminFallback />}><MyGrowth /></Suspense>}</Route>
      <Route path="/admin/hr/my-team">{() => <Suspense fallback={<AdminFallback />}><MyTeamTabs /></Suspense>}</Route>
      <Route path="/admin/hr/people">{() => <Suspense fallback={<AdminFallback />}><PeopleHR /></Suspense>}</Route>

      {/* Recruitment / Jobs */}
      <Route path="/admin/recruitment">{() => <Suspense fallback={<AdminFallback />}><Recruitment /></Suspense>}</Route>
      <Route path="/admin/applications/job/:jobId">{() => <Suspense fallback={<AdminFallback />}><JobApplications /></Suspense>}</Route>
      <Route path="/admin/contacts">{() => <Suspense fallback={<AdminFallback />}><AdminContacts /></Suspense>}</Route>
      <Route path="/admin/jobs">{() => <Redirect to="/admin/recruitment" />}</Route>
      <Route path="/admin/applications">{() => <Redirect to="/admin/recruitment?tab=applications" />}</Route>

      {/* New Hire */}
      <Route path="/admin/new-hire">{() => <Suspense fallback={<AdminFallback />}><NewHire /></Suspense>}</Route>

      {/* Travel Pay Calculator */}
      <Route path="/admin/travel-calculator">{() => <Suspense fallback={<AdminFallback />}><TravelCalculator /></Suspense>}</Route>

      {/* Communications — What's New + Release Notes */}
      <Route path="/admin/communications">{() => <Suspense fallback={<AdminFallback />}><Communications /></Suspense>}</Route>

      {/* Process Governance Center — SOP library */}
      <Route path="/admin/sops/compliance">{() => <Suspense fallback={<AdminFallback />}><SOPCompliance /></Suspense>}</Route>
      <Route path="/admin/sops/my-reviews">{() => <Suspense fallback={<AdminFallback />}><MySopReviews /></Suspense>}</Route>
      <Route path="/admin/sops">{() => <Suspense fallback={<AdminFallback />}><SOPLibrary /></Suspense>}</Route>

      {/* Training Catalog */}
      <Route path="/admin/training/catalog">{() => <Suspense fallback={<AdminFallback />}><TrainingCatalog /></Suspense>}</Route>

      {/* Personal My Work routes → redirected to Command Center / My Desk tabs */}
      <Route path="/admin/hr/dashboard">{() => <Redirect to="/admin/my-desk" />}</Route>
      <Route path="/admin/hr/attendance">{() => <Redirect to="/admin/my-desk?tab=time-card" />}</Route>
      <Route path="/admin/hr/leaves">{() => <Redirect to="/admin/my-desk?tab=leave-balance" />}</Route>
      <Route path="/admin/hr/holidays">{() => <Redirect to="/admin/my-desk?tab=leave-calendar" />}</Route>
      <Route path="/admin/hr/tickets">{() => <Redirect to="/admin/my-desk?tab=regularizations" />}</Route>

      {/* HR management / tool pages — remain at their paths */}
      <Route path="/admin/hr/profile">{() => <Suspense fallback={<AdminFallback />}><HRProfile /></Suspense>}</Route>
      <Route path="/admin/hr/team-attendance">{() => <Suspense fallback={<AdminFallback />}><TeamAttendance /></Suspense>}</Route>
      <Route path="/admin/hr/leave-approvals">{() => <Suspense fallback={<AdminFallback />}><HRLeaveApprovals /></Suspense>}</Route>
      {/* Settings — promoted to top-level nav with per-sub-category routes */}
      <Route path="/admin/settings/:group">{(params) => <Suspense fallback={<AdminFallback />}><HRSettings group={params.group} /></Suspense>}</Route>
      <Route path="/admin/settings">{() => <LegacySettingsRedirect />}</Route>
      <Route path="/admin/hr/settings">{() => <LegacySettingsRedirect />}</Route>
      <Route path="/admin/hr/org-chart">{() => <Suspense fallback={<AdminFallback />}><OrgChart /></Suspense>}</Route>
      <Route path="/admin/hr/salary-slips">{() => <Redirect to="/admin/my-desk?tab=payslips" />}</Route>
      <Route path="/admin/salary-advance">{() => <Suspense fallback={<AdminFallback />}><SalaryAdvance /></Suspense>}</Route>
      <Route path="/admin/hr/my-documents">{() => <Suspense fallback={<AdminFallback />}><MyDocuments /></Suspense>}</Route>
      <Route path="/admin/hr/tools">{() => <Suspense fallback={<AdminFallback />}><HRTools /></Suspense>}</Route>
      <Route path="/admin/hr/my-training">{() => <Suspense fallback={<AdminFallback />}><MyTraining /></Suspense>}</Route>
      <Route path="/admin/hr/training">{() => <Redirect to="/admin/growth?tab=training-mgmt" />}</Route>
      <Route path="/admin/hr/training-progress">{() => <Suspense fallback={<AdminFallback />}><TrainingProgress /></Suspense>}</Route>
      <Route path="/admin/hr/reports">{() => <Suspense fallback={<AdminFallback />}><ReportsCompliance /></Suspense>}</Route>
      <Route path="/admin/users">{() => <Suspense fallback={<AdminFallback />}><AdminUsers /></Suspense>}</Route>
      <Route path="/admin/policy-gate">{() => <Suspense fallback={<AdminFallback />}><PolicyGate /></Suspense>}</Route>
      <Route path="/admin/hr/documents/policy/:signingId">{() => <Suspense fallback={<AdminFallback />}><PolicySigningPage /></Suspense>}</Route>

      {/* Legacy redirect patterns */}
      <Route path="/admin/hr/salary-reports">{() => <Redirect to="/admin/hr/people?tab=salary" />}</Route>
      <Route path="/admin/hr/document-compliance">{() => <Redirect to="/admin/hr/people?tab=compliance" />}</Route>
      <Route path="/admin/audit-logs">{() => <Redirect to="/admin/hr/people?tab=audit" />}</Route>

      {/* Finance & Contracts */}
      <Route path="/admin/finance">{() => <Suspense fallback={<AdminFallback />}><ContractsHub /></Suspense>}</Route>

      {/* Help Desk */}
      <Route path="/admin/help-desk/:id">{() => <Suspense fallback={<AdminFallback />}><HelpDeskTicket /></Suspense>}</Route>
      <Route path="/admin/help-desk">{() => <Suspense fallback={<AdminFallback />}><HelpDesk /></Suspense>}</Route>

      {/* Content Studio */}
      <Route path="/admin/studio/articles/:id/review">{() => <Suspense fallback={<AdminFallback />}><StudioReviewArticle /></Suspense>}</Route>
      <Route path="/admin/studio/articles/:id/author-signoff">{() => <Suspense fallback={<AdminFallback />}><StudioAuthorSignOff /></Suspense>}</Route>
      <Route path="/admin/studio/articles/:id/edit">{() => <Suspense fallback={<AdminFallback />}><StudioArticleEditor /></Suspense>}</Route>
      <Route path="/admin/studio/articles">{() => <Suspense fallback={<AdminFallback />}><StudioArticles /></Suspense>}</Route>
      <Route path="/admin/studio/live">{() => <Suspense fallback={<AdminFallback />}><StudioLiveContent /></Suspense>}</Route>
      <Route path="/admin/studio/authors">{() => <Suspense fallback={<AdminFallback />}><StudioAuthors /></Suspense>}</Route>
      <Route path="/admin/studio/inbox">{() => <Suspense fallback={<AdminFallback />}><StudioInbox /></Suspense>}</Route>
      <Route path="/admin/studio/cm-review">{() => <Suspense fallback={<AdminFallback />}><StudioCMReview /></Suspense>}</Route>
      <Route path="/admin/studio/approvals">{() => <Suspense fallback={<AdminFallback />}><StudioApprovals /></Suspense>}</Route>
      <Route path="/admin/studio/final-approval">{() => <Suspense fallback={<AdminFallback />}><StudioFinalApproval /></Suspense>}</Route>
      <Route path="/admin/automated-changes">{() => <Redirect to="/admin/control-tower?tab=automated-changes" />}</Route>
      <Route path="/admin/control-tower">{() => <Suspense fallback={<AdminFallback />}><ControlTower /></Suspense>}</Route>
      <Route path="/admin/studio/calendar">{() => <Suspense fallback={<AdminFallback />}><StudioCalendar /></Suspense>}</Route>
      <Route path="/admin/studio/settings/templates">{() => <Suspense fallback={<AdminFallback />}><StudioTemplateSettings /></Suspense>}</Route>
      <Route path="/admin/studio/subscribers">{() => <Suspense fallback={<AdminFallback />}><StudioSubscribers /></Suspense>}</Route>
      <Route path="/admin/studio/analytics">{() => <Suspense fallback={<AdminFallback />}><StudioAnalytics /></Suspense>}</Route>
      <Route path="/admin/studio/access">{() => <Suspense fallback={<AdminFallback />}><StudioAccess /></Suspense>}</Route>
      <Route path="/admin/studio">{() => <Suspense fallback={<AdminFallback />}><Studio /></Suspense>}</Route>

      {/* Public contract signing */}
      <Route path="/contracts/sign/:token" component={ContractSign} />

      {/* Performance pages */}
      <Route path="/admin/performance/goals">{() => <Suspense fallback={<AdminFallback />}><Goals /></Suspense>}</Route>
      <Route path="/admin/performance/check-ins">{() => <Suspense fallback={<AdminFallback />}><PerformanceCheckIns mode="mine" /></Suspense>}</Route>
      <Route path="/admin/performance/reviews">{() => <Suspense fallback={<AdminFallback />}><Reviews /></Suspense>}</Route>
      <Route path="/admin/performance/review-cycles">{() => <Suspense fallback={<AdminFallback />}><PerformanceReviewCycles /></Suspense>}</Route>
      <Route path="/admin/performance/feedback">{() => <Suspense fallback={<AdminFallback />}><PerformanceFeedback /></Suspense>}</Route>
      <Route path="/admin/performance/analytics">{() => <Suspense fallback={<AdminFallback />}><PerformanceAnalytics /></Suspense>}</Route>
      <Route path="/admin/probation-guide">{() => <Suspense fallback={<AdminFallback />}><ProbationGuide /></Suspense>}</Route>
      <Route path="/admin/performance/team-goals">{() => <Redirect to="/admin/growth?tab=team-goals" />}</Route>
      <Route path="/admin/performance/team-reviews">{() => <Redirect to="/admin/growth?tab=team-reviews" />}</Route>

      {/* Systems Vault */}
      <Route path="/admin/vault/audit">{() => <Suspense fallback={<AdminFallback />}><VaultAuditPage /></Suspense>}</Route>
      <Route path="/admin/vault">{() => <Suspense fallback={<AdminFallback />}><VaultPage /></Suspense>}</Route>

      {/* Payroll */}
      <Route path="/admin/payroll/run">{() => <Suspense fallback={<AdminFallback />}><BulkPayrollRun /></Suspense>}</Route>
      <Route path="/admin/payroll/executive">{() => <Suspense fallback={<AdminFallback />}><ExecutiveDashboard /></Suspense>}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const isEmployee = isEmployeeSubdomain();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {isEmployee ? <EmployeeRouter /> : <PublicRouter />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
