import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Jobs from "@/pages/Jobs";
import Contact from "@/pages/Contact";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import HealthcareRecruitment from "@/pages/services/HealthcareRecruitment";
import ITSoftware from "@/pages/services/ITSoftware";
import EngineeringTechnical from "@/pages/services/EngineeringTechnical";
import ProfessionalServices from "@/pages/services/ProfessionalServices";
import ContractStaffing from "@/pages/services/ContractStaffing";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminJobs from "@/pages/admin/Jobs";
import AdminApplications from "@/pages/admin/Applications";
import AdminContacts from "@/pages/admin/Contacts";
import AdminUsers from "@/pages/admin/Users";
import AdminLogin from "@/pages/admin/Login";
import HRDashboard from "@/pages/admin/hr/HRDashboard";
import HRAttendance from "@/pages/admin/hr/Attendance";
import HRLeaveManagement from "@/pages/admin/hr/LeaveManagement";
import HRHolidayCalendar from "@/pages/admin/hr/HolidayCalendar";
import HRProfile from "@/pages/admin/hr/Profile";
import HRTickets from "@/pages/admin/hr/Tickets";
import HRLeaveApprovals from "@/pages/admin/hr/LeaveApprovals";
import HRSettings from "@/pages/admin/hr/HRSettings";
import OrgChart from "@/pages/admin/hr/OrgChart";

function isEmployeeSubdomain() {
  const hostname = window.location.hostname;
  return hostname.startsWith("employee.") || hostname.startsWith("www.employee.");
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/contact" component={Contact} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />

      <Route path="/services/healthcare-recruitment" component={HealthcareRecruitment} />
      <Route path="/services/it-software" component={ITSoftware} />
      <Route path="/services/engineering-technical" component={EngineeringTechnical} />
      <Route path="/services/non-it-professional" component={ProfessionalServices} />
      <Route path="/services/contract-staffing" component={ContractStaffing} />

      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/jobs" component={AdminJobs} />
      <Route path="/admin/applications" component={AdminApplications} />
      <Route path="/admin/contacts" component={AdminContacts} />
      <Route path="/admin/users" component={AdminUsers} />

      <Route path="/admin/hr" component={HRDashboard} />
      <Route path="/admin/hr/attendance" component={HRAttendance} />
      <Route path="/admin/hr/leaves" component={HRLeaveManagement} />
      <Route path="/admin/hr/holidays" component={HRHolidayCalendar} />
      <Route path="/admin/hr/profile" component={HRProfile} />
      <Route path="/admin/hr/tickets" component={HRTickets} />
      <Route path="/admin/hr/leave-approvals" component={HRLeaveApprovals} />
      <Route path="/admin/hr/settings" component={HRSettings} />
      <Route path="/admin/hr/org-chart" component={OrgChart} />

      <Route component={NotFound} />
    </Switch>
  );
}

function EmployeeRouter() {
  return (
    <Switch>
      <Route path="/">{() => <Redirect to="/admin/login" />}</Route>
      <Route path="/login">{() => <Redirect to="/admin/login" />}</Route>

      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/jobs" component={AdminJobs} />
      <Route path="/admin/applications" component={AdminApplications} />
      <Route path="/admin/contacts" component={AdminContacts} />
      <Route path="/admin/users" component={AdminUsers} />

      <Route path="/admin/hr" component={HRDashboard} />
      <Route path="/admin/hr/attendance" component={HRAttendance} />
      <Route path="/admin/hr/leaves" component={HRLeaveManagement} />
      <Route path="/admin/hr/holidays" component={HRHolidayCalendar} />
      <Route path="/admin/hr/profile" component={HRProfile} />
      <Route path="/admin/hr/tickets" component={HRTickets} />
      <Route path="/admin/hr/leave-approvals" component={HRLeaveApprovals} />
      <Route path="/admin/hr/settings" component={HRSettings} />
      <Route path="/admin/hr/org-chart" component={OrgChart} />

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
