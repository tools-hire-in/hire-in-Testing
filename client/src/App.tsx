import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
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
const MyDocuments = lazy(() => import("@/pages/admin/hr/MyDocuments"));
const HRTools = lazy(() => import("@/pages/admin/hr/HRTools"));
const MyTraining = lazy(() => import("@/pages/admin/hr/MyTraining"));
const TrainingManagement = lazy(() => import("@/pages/admin/hr/TrainingManagement"));
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
const PolicyGate = lazy(() => import("@/pages/admin/PolicyGate"));
const NewHire = lazy(() => import("@/pages/admin/NewHire"));
const ContractsHub = lazy(() => import("@/pages/admin/finance/ContractsHub"));
const Studio = lazy(() => import("@/pages/admin/studio/Studio"));
const StudioArticles = lazy(() => import("@/pages/admin/studio/Articles"));
const StudioAuthors = lazy(() => import("@/pages/admin/studio/Authors"));
const StudioArticleEditor = lazy(() => import("@/pages/admin/studio/ArticleEditor"));
const StudioInbox = lazy(() => import("@/pages/admin/studio/Inbox"));
const StudioReviewArticle = lazy(() => import("@/pages/admin/studio/ReviewArticle"));
const StudioApprovals = lazy(() => import("@/pages/admin/studio/Approvals"));
const StudioFinalApproval = lazy(() => import("@/pages/admin/studio/FinalApproval"));
const AutomatedChanges = lazy(() => import("@/pages/admin/AutomatedChanges"));
const StudioCalendar = lazy(() => import("@/pages/admin/studio/Calendar"));
const StudioTemplateSettings = lazy(() => import("@/pages/admin/studio/TemplateSettings"));
const StudioSubscribers = lazy(() => import("@/pages/admin/studio/Subscribers"));
const PolicySigningPage = lazy(() => import("@/pages/admin/hr/PolicySigningPage"));

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

      {/* Admin root → My Work */}
      <Route path="/admin">{() => <Redirect to="/admin/hr" />}</Route>

      {/* Consolidated tab pages (primary nav) */}
      <Route path="/admin/hr">{() => <Suspense fallback={<AdminFallback />}><MyWork /></Suspense>}</Route>
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

      {/* Legacy HR standalone pages */}
      <Route path="/admin/hr/dashboard">{() => <Suspense fallback={<AdminFallback />}><HRDashboard /></Suspense>}</Route>
      <Route path="/admin/hr/attendance">{() => <Suspense fallback={<AdminFallback />}><HRAttendance /></Suspense>}</Route>
      <Route path="/admin/hr/leaves">{() => <Suspense fallback={<AdminFallback />}><HRLeaveManagement /></Suspense>}</Route>
      <Route path="/admin/hr/holidays">{() => <Suspense fallback={<AdminFallback />}><HRHolidayCalendar /></Suspense>}</Route>
      <Route path="/admin/hr/profile">{() => <Suspense fallback={<AdminFallback />}><HRProfile /></Suspense>}</Route>
      <Route path="/admin/hr/team-attendance">{() => <Suspense fallback={<AdminFallback />}><TeamAttendance /></Suspense>}</Route>
      <Route path="/admin/hr/leave-approvals">{() => <Suspense fallback={<AdminFallback />}><HRLeaveApprovals /></Suspense>}</Route>
      <Route path="/admin/hr/settings">{() => <Suspense fallback={<AdminFallback />}><HRSettings /></Suspense>}</Route>
      <Route path="/admin/hr/org-chart">{() => <Suspense fallback={<AdminFallback />}><OrgChart /></Suspense>}</Route>
      <Route path="/admin/hr/salary-slips">{() => <Suspense fallback={<AdminFallback />}><SalarySlips /></Suspense>}</Route>
      <Route path="/admin/hr/my-documents">{() => <Suspense fallback={<AdminFallback />}><MyDocuments /></Suspense>}</Route>
      <Route path="/admin/hr/tools">{() => <Suspense fallback={<AdminFallback />}><HRTools /></Suspense>}</Route>
      <Route path="/admin/hr/my-training">{() => <Suspense fallback={<AdminFallback />}><MyTraining /></Suspense>}</Route>
      <Route path="/admin/hr/training">{() => <Suspense fallback={<AdminFallback />}><TrainingManagement /></Suspense>}</Route>
      <Route path="/admin/hr/training-progress">{() => <Suspense fallback={<AdminFallback />}><TrainingProgress /></Suspense>}</Route>
      <Route path="/admin/hr/reports">{() => <Suspense fallback={<AdminFallback />}><ReportsCompliance /></Suspense>}</Route>
      <Route path="/admin/users">{() => <Suspense fallback={<AdminFallback />}><AdminUsers /></Suspense>}</Route>
      <Route path="/admin/policy-gate">{() => <Suspense fallback={<AdminFallback />}><PolicyGate /></Suspense>}</Route>
      <Route path="/admin/hr/documents/policy/:signingId">{() => <Suspense fallback={<AdminFallback />}><PolicySigningPage /></Suspense>}</Route>

      {/* Legacy redirect patterns */}
      <Route path="/admin/hr/tickets">{() => <Redirect to="/admin/hr/attendance?tab=tickets" />}</Route>
      <Route path="/admin/hr/salary-reports">{() => <Redirect to="/admin/hr/people?tab=reports" />}</Route>
      <Route path="/admin/hr/document-compliance">{() => <Redirect to="/admin/hr/people?tab=reports" />}</Route>
      <Route path="/admin/audit-logs">{() => <Redirect to="/admin/hr/people?tab=reports" />}</Route>

      {/* Finance & Contracts */}
      <Route path="/admin/finance">{() => <Suspense fallback={<AdminFallback />}><ContractsHub /></Suspense>}</Route>

      {/* Content Studio */}
      <Route path="/admin/studio/articles/:id/review">{() => <Suspense fallback={<AdminFallback />}><StudioReviewArticle /></Suspense>}</Route>
      <Route path="/admin/studio/articles/:id/edit">{() => <Suspense fallback={<AdminFallback />}><StudioArticleEditor /></Suspense>}</Route>
      <Route path="/admin/studio/articles">{() => <Suspense fallback={<AdminFallback />}><StudioArticles /></Suspense>}</Route>
      <Route path="/admin/studio/authors">{() => <Suspense fallback={<AdminFallback />}><StudioAuthors /></Suspense>}</Route>
      <Route path="/admin/studio/inbox">{() => <Suspense fallback={<AdminFallback />}><StudioInbox /></Suspense>}</Route>
      <Route path="/admin/studio/approvals">{() => <Suspense fallback={<AdminFallback />}><StudioApprovals /></Suspense>}</Route>
      <Route path="/admin/studio/final-approval">{() => <Suspense fallback={<AdminFallback />}><StudioFinalApproval /></Suspense>}</Route>
      <Route path="/admin/automated-changes">{() => <Suspense fallback={<AdminFallback />}><AutomatedChanges /></Suspense>}</Route>
      <Route path="/admin/studio/calendar">{() => <Suspense fallback={<AdminFallback />}><StudioCalendar /></Suspense>}</Route>
      <Route path="/admin/studio/settings/templates">{() => <Suspense fallback={<AdminFallback />}><StudioTemplateSettings /></Suspense>}</Route>
      <Route path="/admin/studio/subscribers">{() => <Suspense fallback={<AdminFallback />}><StudioSubscribers /></Suspense>}</Route>
      <Route path="/admin/studio">{() => <Suspense fallback={<AdminFallback />}><Studio /></Suspense>}</Route>

      {/* Public contract signing */}
      <Route path="/contracts/sign/:token" component={ContractSign} />

      {/* Performance pages */}
      <Route path="/admin/performance/goals">{() => <Suspense fallback={<AdminFallback />}><Goals /></Suspense>}</Route>
      <Route path="/admin/performance/check-ins">{() => <Suspense fallback={<AdminFallback />}><PerformanceCheckIns /></Suspense>}</Route>
      <Route path="/admin/performance/reviews">{() => <Suspense fallback={<AdminFallback />}><Reviews /></Suspense>}</Route>
      <Route path="/admin/performance/review-cycles">{() => <Suspense fallback={<AdminFallback />}><PerformanceReviewCycles /></Suspense>}</Route>
      <Route path="/admin/performance/feedback">{() => <Suspense fallback={<AdminFallback />}><PerformanceFeedback /></Suspense>}</Route>
      <Route path="/admin/performance/analytics">{() => <Suspense fallback={<AdminFallback />}><PerformanceAnalytics /></Suspense>}</Route>
      <Route path="/admin/performance/team-goals">{() => <Redirect to="/admin/growth?tab=goals" />}</Route>
      <Route path="/admin/performance/team-reviews">{() => <Redirect to="/admin/growth?tab=reviews" />}</Route>

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

      {/* Admin root → My Work */}
      <Route path="/admin">{() => <Redirect to="/admin/hr" />}</Route>

      {/* Consolidated tab pages (primary nav) */}
      <Route path="/admin/hr">{() => <Suspense fallback={<AdminFallback />}><MyWork /></Suspense>}</Route>
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

      {/* Legacy HR standalone pages */}
      <Route path="/admin/hr/dashboard">{() => <Suspense fallback={<AdminFallback />}><HRDashboard /></Suspense>}</Route>
      <Route path="/admin/hr/attendance">{() => <Suspense fallback={<AdminFallback />}><HRAttendance /></Suspense>}</Route>
      <Route path="/admin/hr/leaves">{() => <Suspense fallback={<AdminFallback />}><HRLeaveManagement /></Suspense>}</Route>
      <Route path="/admin/hr/holidays">{() => <Suspense fallback={<AdminFallback />}><HRHolidayCalendar /></Suspense>}</Route>
      <Route path="/admin/hr/profile">{() => <Suspense fallback={<AdminFallback />}><HRProfile /></Suspense>}</Route>
      <Route path="/admin/hr/team-attendance">{() => <Suspense fallback={<AdminFallback />}><TeamAttendance /></Suspense>}</Route>
      <Route path="/admin/hr/leave-approvals">{() => <Suspense fallback={<AdminFallback />}><HRLeaveApprovals /></Suspense>}</Route>
      <Route path="/admin/hr/settings">{() => <Suspense fallback={<AdminFallback />}><HRSettings /></Suspense>}</Route>
      <Route path="/admin/hr/org-chart">{() => <Suspense fallback={<AdminFallback />}><OrgChart /></Suspense>}</Route>
      <Route path="/admin/hr/salary-slips">{() => <Suspense fallback={<AdminFallback />}><SalarySlips /></Suspense>}</Route>
      <Route path="/admin/hr/my-documents">{() => <Suspense fallback={<AdminFallback />}><MyDocuments /></Suspense>}</Route>
      <Route path="/admin/hr/tools">{() => <Suspense fallback={<AdminFallback />}><HRTools /></Suspense>}</Route>
      <Route path="/admin/hr/my-training">{() => <Suspense fallback={<AdminFallback />}><MyTraining /></Suspense>}</Route>
      <Route path="/admin/hr/training">{() => <Suspense fallback={<AdminFallback />}><TrainingManagement /></Suspense>}</Route>
      <Route path="/admin/hr/training-progress">{() => <Suspense fallback={<AdminFallback />}><TrainingProgress /></Suspense>}</Route>
      <Route path="/admin/hr/reports">{() => <Suspense fallback={<AdminFallback />}><ReportsCompliance /></Suspense>}</Route>
      <Route path="/admin/users">{() => <Suspense fallback={<AdminFallback />}><AdminUsers /></Suspense>}</Route>
      <Route path="/admin/policy-gate">{() => <Suspense fallback={<AdminFallback />}><PolicyGate /></Suspense>}</Route>
      <Route path="/admin/hr/documents/policy/:signingId">{() => <Suspense fallback={<AdminFallback />}><PolicySigningPage /></Suspense>}</Route>

      {/* Legacy redirect patterns */}
      <Route path="/admin/hr/tickets">{() => <Redirect to="/admin/hr/attendance?tab=tickets" />}</Route>
      <Route path="/admin/hr/salary-reports">{() => <Redirect to="/admin/hr/people?tab=reports" />}</Route>
      <Route path="/admin/hr/document-compliance">{() => <Redirect to="/admin/hr/people?tab=reports" />}</Route>
      <Route path="/admin/audit-logs">{() => <Redirect to="/admin/hr/people?tab=reports" />}</Route>

      {/* Finance & Contracts */}
      <Route path="/admin/finance">{() => <Suspense fallback={<AdminFallback />}><ContractsHub /></Suspense>}</Route>

      {/* Content Studio */}
      <Route path="/admin/studio/articles/:id/review">{() => <Suspense fallback={<AdminFallback />}><StudioReviewArticle /></Suspense>}</Route>
      <Route path="/admin/studio/articles/:id/edit">{() => <Suspense fallback={<AdminFallback />}><StudioArticleEditor /></Suspense>}</Route>
      <Route path="/admin/studio/articles">{() => <Suspense fallback={<AdminFallback />}><StudioArticles /></Suspense>}</Route>
      <Route path="/admin/studio/authors">{() => <Suspense fallback={<AdminFallback />}><StudioAuthors /></Suspense>}</Route>
      <Route path="/admin/studio/inbox">{() => <Suspense fallback={<AdminFallback />}><StudioInbox /></Suspense>}</Route>
      <Route path="/admin/studio/approvals">{() => <Suspense fallback={<AdminFallback />}><StudioApprovals /></Suspense>}</Route>
      <Route path="/admin/studio/final-approval">{() => <Suspense fallback={<AdminFallback />}><StudioFinalApproval /></Suspense>}</Route>
      <Route path="/admin/automated-changes">{() => <Suspense fallback={<AdminFallback />}><AutomatedChanges /></Suspense>}</Route>
      <Route path="/admin/studio/calendar">{() => <Suspense fallback={<AdminFallback />}><StudioCalendar /></Suspense>}</Route>
      <Route path="/admin/studio/settings/templates">{() => <Suspense fallback={<AdminFallback />}><StudioTemplateSettings /></Suspense>}</Route>
      <Route path="/admin/studio/subscribers">{() => <Suspense fallback={<AdminFallback />}><StudioSubscribers /></Suspense>}</Route>
      <Route path="/admin/studio">{() => <Suspense fallback={<AdminFallback />}><Studio /></Suspense>}</Route>

      {/* Public contract signing */}
      <Route path="/contracts/sign/:token" component={ContractSign} />

      {/* Performance pages */}
      <Route path="/admin/performance/goals">{() => <Suspense fallback={<AdminFallback />}><Goals /></Suspense>}</Route>
      <Route path="/admin/performance/check-ins">{() => <Suspense fallback={<AdminFallback />}><PerformanceCheckIns /></Suspense>}</Route>
      <Route path="/admin/performance/reviews">{() => <Suspense fallback={<AdminFallback />}><Reviews /></Suspense>}</Route>
      <Route path="/admin/performance/review-cycles">{() => <Suspense fallback={<AdminFallback />}><PerformanceReviewCycles /></Suspense>}</Route>
      <Route path="/admin/performance/feedback">{() => <Suspense fallback={<AdminFallback />}><PerformanceFeedback /></Suspense>}</Route>
      <Route path="/admin/performance/analytics">{() => <Suspense fallback={<AdminFallback />}><PerformanceAnalytics /></Suspense>}</Route>
      <Route path="/admin/performance/team-goals">{() => <Redirect to="/admin/growth?tab=goals" />}</Route>
      <Route path="/admin/performance/team-reviews">{() => <Redirect to="/admin/growth?tab=reviews" />}</Route>

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
