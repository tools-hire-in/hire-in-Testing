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
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminContacts from "@/pages/admin/Contacts";
import AdminUsers from "@/pages/admin/Users";
import AdminLogin from "@/pages/admin/Login";
import ForgotPassword from "@/pages/admin/ForgotPassword";
import ResetPassword from "@/pages/admin/ResetPassword";
import Recruitment from "@/pages/admin/Recruitment";
import HRDashboard from "@/pages/admin/hr/HRDashboard";
import HRAttendance from "@/pages/admin/hr/Attendance";
import HRLeaveManagement from "@/pages/admin/hr/LeaveManagement";
import HRHolidayCalendar from "@/pages/admin/hr/HolidayCalendar";
import HRProfile from "@/pages/admin/hr/Profile";
import HRLeaveApprovals from "@/pages/admin/hr/LeaveApprovals";
import HRSettings from "@/pages/admin/hr/HRSettings";
import OrgChart from "@/pages/admin/hr/OrgChart";
import SalarySlips from "@/pages/admin/hr/SalarySlips";
import MyDocuments from "@/pages/admin/hr/MyDocuments";
import HRTools from "@/pages/admin/hr/HRTools";
import JobApplications from "@/pages/admin/JobApplications";
import OnboardAccept from "@/pages/OnboardAccept";
import MyTraining from "@/pages/admin/hr/MyTraining";
import TrainingManagement from "@/pages/admin/hr/TrainingManagement";
import TeamAttendance from "@/pages/admin/hr/TeamAttendance";
import TrainingProgress from "@/pages/admin/hr/TrainingProgress";
import MyTeam from "@/pages/admin/hr/MyTeam";
import Goals from "@/pages/admin/performance/Goals";
import PerformanceCheckIns from "@/pages/admin/performance/CheckIns";
import Reviews from "@/pages/admin/performance/Reviews";
import PerformanceReviewCycles from "@/pages/admin/performance/ReviewCycles";
import PerformanceFeedback from "@/pages/admin/performance/Feedback";
import PerformanceAnalytics from "@/pages/admin/performance/Analytics";
import ReportsCompliance from "@/pages/admin/hr/ReportsCompliance";
import VerifyLetter from "@/pages/VerifyLetter";

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

function RedirectToTab({ to, tab }: { to: string; tab: string }) {
  return <Redirect to={`${to}?tab=${tab}`} />;
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/jobs/:id" component={JobDetail} />
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
      <Route path="/onboard/:token" component={OnboardAccept} />
      <Route path="/verify" component={VerifyLetter} />

      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/forgot-password" component={ForgotPassword} />
      <Route path="/admin/reset-password" component={ResetPassword} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/recruitment" component={Recruitment} />
      <Route path="/admin/applications/job/:jobId" component={JobApplications} />
      <Route path="/admin/contacts" component={AdminContacts} />
      <Route path="/admin/users" component={AdminUsers} />

      <Route path="/admin/jobs">{() => <Redirect to="/admin/recruitment" />}</Route>
      <Route path="/admin/applications">{() => <RedirectToTab to="/admin/recruitment" tab="applications" />}</Route>
      <Route path="/admin/audit-logs">{() => <RedirectToTab to="/admin/hr/reports" tab="audit" />}</Route>

      <Route path="/admin/hr" component={HRDashboard} />
      <Route path="/admin/hr/attendance" component={HRAttendance} />
      <Route path="/admin/hr/leaves" component={HRLeaveManagement} />
      <Route path="/admin/hr/holidays" component={HRHolidayCalendar} />
      <Route path="/admin/hr/profile" component={HRProfile} />
      <Route path="/admin/hr/team-attendance" component={TeamAttendance} />
      <Route path="/admin/hr/leave-approvals" component={HRLeaveApprovals} />
      <Route path="/admin/hr/settings" component={HRSettings} />
      <Route path="/admin/hr/org-chart" component={OrgChart} />
      <Route path="/admin/hr/salary-slips" component={SalarySlips} />
      <Route path="/admin/hr/my-documents" component={MyDocuments} />
      <Route path="/admin/hr/tools" component={HRTools} />
      <Route path="/admin/hr/my-training" component={MyTraining} />
      <Route path="/admin/hr/training" component={TrainingManagement} />
      <Route path="/admin/hr/training-progress" component={TrainingProgress} />
      <Route path="/admin/hr/my-team" component={MyTeam} />
      <Route path="/admin/hr/reports" component={ReportsCompliance} />

      <Route path="/admin/hr/tickets">{() => <RedirectToTab to="/admin/hr/attendance" tab="tickets" />}</Route>
      <Route path="/admin/hr/salary-reports">{() => <RedirectToTab to="/admin/hr/reports" tab="salary" />}</Route>
      <Route path="/admin/hr/document-compliance">{() => <RedirectToTab to="/admin/hr/reports" tab="compliance" />}</Route>

      <Route path="/admin/performance/goals" component={Goals} />
      <Route path="/admin/performance/check-ins" component={PerformanceCheckIns} />
      <Route path="/admin/performance/reviews" component={Reviews} />
      <Route path="/admin/performance/review-cycles" component={PerformanceReviewCycles} />
      <Route path="/admin/performance/feedback" component={PerformanceFeedback} />
      <Route path="/admin/performance/analytics" component={PerformanceAnalytics} />

      <Route path="/admin/performance/team-goals">{() => <RedirectToTab to="/admin/performance/goals" tab="team-goals" />}</Route>
      <Route path="/admin/performance/team-reviews">{() => <RedirectToTab to="/admin/performance/reviews" tab="team-reviews" />}</Route>

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
      <Route path="/verify" component={VerifyLetter} />

      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/forgot-password" component={ForgotPassword} />
      <Route path="/admin/reset-password" component={ResetPassword} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/recruitment" component={Recruitment} />
      <Route path="/admin/applications/job/:jobId" component={JobApplications} />
      <Route path="/admin/contacts" component={AdminContacts} />
      <Route path="/admin/users" component={AdminUsers} />

      <Route path="/admin/jobs">{() => <Redirect to="/admin/recruitment" />}</Route>
      <Route path="/admin/applications">{() => <RedirectToTab to="/admin/recruitment" tab="applications" />}</Route>
      <Route path="/admin/audit-logs">{() => <RedirectToTab to="/admin/hr/reports" tab="audit" />}</Route>

      <Route path="/admin/hr" component={HRDashboard} />
      <Route path="/admin/hr/attendance" component={HRAttendance} />
      <Route path="/admin/hr/leaves" component={HRLeaveManagement} />
      <Route path="/admin/hr/holidays" component={HRHolidayCalendar} />
      <Route path="/admin/hr/profile" component={HRProfile} />
      <Route path="/admin/hr/team-attendance" component={TeamAttendance} />
      <Route path="/admin/hr/leave-approvals" component={HRLeaveApprovals} />
      <Route path="/admin/hr/settings" component={HRSettings} />
      <Route path="/admin/hr/org-chart" component={OrgChart} />
      <Route path="/admin/hr/salary-slips" component={SalarySlips} />
      <Route path="/admin/hr/my-documents" component={MyDocuments} />
      <Route path="/admin/hr/tools" component={HRTools} />
      <Route path="/admin/hr/my-training" component={MyTraining} />
      <Route path="/admin/hr/training" component={TrainingManagement} />
      <Route path="/admin/hr/training-progress" component={TrainingProgress} />
      <Route path="/admin/hr/my-team" component={MyTeam} />
      <Route path="/admin/hr/reports" component={ReportsCompliance} />

      <Route path="/admin/hr/tickets">{() => <RedirectToTab to="/admin/hr/attendance" tab="tickets" />}</Route>
      <Route path="/admin/hr/salary-reports">{() => <RedirectToTab to="/admin/hr/reports" tab="salary" />}</Route>
      <Route path="/admin/hr/document-compliance">{() => <RedirectToTab to="/admin/hr/reports" tab="compliance" />}</Route>

      <Route path="/admin/performance/goals" component={Goals} />
      <Route path="/admin/performance/check-ins" component={PerformanceCheckIns} />
      <Route path="/admin/performance/reviews" component={Reviews} />
      <Route path="/admin/performance/review-cycles" component={PerformanceReviewCycles} />
      <Route path="/admin/performance/feedback" component={PerformanceFeedback} />
      <Route path="/admin/performance/analytics" component={PerformanceAnalytics} />

      <Route path="/admin/performance/team-goals">{() => <RedirectToTab to="/admin/performance/goals" tab="team-goals" />}</Route>
      <Route path="/admin/performance/team-reviews">{() => <RedirectToTab to="/admin/performance/reviews" tab="team-reviews" />}</Route>

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
