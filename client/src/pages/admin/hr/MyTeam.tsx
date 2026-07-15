import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { StatCard } from "@/components/ui/stat-card";
import {
  Users,
  Search,
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  TreePalm,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  UserCircle,
  Building2,
  BadgeCheck,
  Star,
  TrendingUp,
  Check,
  X,
  AlertTriangle,
  Edit,
  Plus,
  Trash2,
  User,
  Phone,
  FileText,
  History,
  CheckCircle,
  XCircle,
  Timer,
  ClipboardList,
  Target,
  Activity,
  ChevronDown,
  ChevronUp,
  Clipboard,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePendingRegularizationCount } from "@/hooks/use-pending-regularizations";
import { formatLocalDate } from "@/lib/dateUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import RegularizationsPanel from "./RegularizationsPanel";
import GovernanceControlsTab from "@/components/admin/governance/GovernanceControlsTab";

const INDIA_PT_STATES = [
  "Andhra Pradesh", "Gujarat", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Odisha",
  "Puducherry", "Punjab", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "West Bengal",
];

interface ShiftTimingInfo {
  istStart: string;
  istEnd: string;
  isDst: boolean;
}

interface TeamMember {
  id: string;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  designation: string | null;
  departmentId: string | null;
  departmentName: string | null;
  joiningDate: string | null;
  isActive: boolean;
  hierarchyLevel: string | null;
  isDirect: boolean;
  shiftId: string | null;
  shiftTiming: ShiftTimingInfo | null;
}

interface TeamResponse {
  members: TeamMember[];
  role: string;
}

interface EmployeeProfile {
  id: string;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  designation: string | null;
  departmentId: string | null;
  departmentName: string | null;
  joiningDate: string | null;
  isActive: boolean;
  hierarchyLevel: string | null;
  salary: string | null;
  gender: string | null;
  employmentType: string | null;
  employeeCategory: string | null;
  attendanceExempt: boolean;
  trainingExempt: boolean;
  maternityLeaveEligible: boolean;
}

interface SalarySlip {
  id: string;
  year: number;
  month: number;
  basicSalary: string;
  grossSalary: string;
  deductions: string;
  netPayable: string;
  totalWorkingDays: number;
  daysPresent: number;
  daysAbsent: number;
}

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  totalHours: string | null;
  status: string;
  notes: string | null;
}

interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  address: string | null;
  isPrimary: boolean;
}

interface TicketRecord {
  id: string;
  userId: string;
  type: string;
  attendanceId: string | null;
  date: string;
  requestedPunchIn: string | null;
  requestedPunchOut: string | null;
  reason: string;
  status: string;
  reviewedBy: string | null;
  reviewComment: string | null;
}

interface RegionalSelection {
  id: string;
  userId: string;
  holidayId: string;
  year: number;
}

interface HolidayItem {
  id: string;
  name: string;
  date: string;
  type: string;
  isOptional: boolean;
}

interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  totalDays: string;
  usedDays: string;
  year: number;
}

interface LeaveRequest {
  id: string;
  leaveTypeName: string;
  leaveTypeId?: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason: string | null;
  status: string;
  reviewedBy?: string | null;
  reviewComment?: string | null;
  createdAt: string;
}

interface ResolvedHoliday {
  id: string;
  name: string;
  date: string;
  type: string;
  isOptional: boolean;
}

interface EmployeeDetails {
  user: TeamMember & { joiningDate: string | null; managerId: string | null; salary?: string | null; shiftTiming?: ShiftTimingInfo | null };
  salary?: { currentSalary: string | null; slips: SalarySlip[] };
  attendance: AttendanceRecord[];
  emergencyContacts: EmergencyContact[];
  tickets: TicketRecord[];
  regionalHolidaySelections: RegionalSelection[];
  holidays?: ResolvedHoliday[];
  leaveBalances?: LeaveBalance[];
  recentLeaves?: LeaveRequest[];
}

interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  targetId: string | null;
  targetName: string;
  action: string;
  changes: any;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
}

interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  monthlyAccrual: string;
  isActive: boolean;
}

interface LeaveAccrual {
  id: string;
  userId: string;
  leaveTypeId: string;
  year: number;
  month: number;
  accruedDays: string;
  hoursWorked: string;
  qualified: boolean;
}

interface EmployeeLeaveData {
  employee: { id: string; firstName: string; lastName: string; email: string };
  balances: Array<{ id: string; leaveTypeId: string; totalDays: string; usedDays: string; year: number }>;
  leaveTypes: LeaveType[];
  requests: Array<{
    id: string;
    userId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    totalDays: string;
    reason: string | null;
    status: string;
    reviewedBy: string | null;
    reviewComment: string | null;
    createdAt: string;
  }>;
  accruals: LeaveAccrual[];
  summary: {
    totalDaysTaken: number;
    pendingCount: number;
    mostUsedLeaveType: string;
  };
  year: number;
}

const roleColors: Record<string, string> = {
  super_admin: "bg-primary text-primary-foreground",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  hr: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  operations: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  manager: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  employee: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};
const statusColors: Record<string, string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  absent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  half_day: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  short_day: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  late: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  on_leave: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  holiday: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  weekend: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const leaveStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatCurrency(val: string | null) {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null) {
  return formatLocalDate(dateStr, "en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(ts: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function TeamList({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const { user } = useAuth();

  const { data, isLoading } = useQuery<TeamResponse>({
    queryKey: ["/api/admin/my-team"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const members = data?.members || [];
  const isManager = data?.role === "manager";

  const departments = [...new Set(members.map(m => m.departmentName).filter(Boolean))] as string[];

  const filtered = members.filter(m => {
    const matchSearch =
      !search ||
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      (m.employeeId && m.employeeId.toLowerCase().includes(search.toLowerCase())) ||
      m.email.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "all" || m.departmentName === deptFilter;
    return matchSearch && matchDept;
  });

  const directReports = isManager ? filtered.filter(m => m.isDirect) : [];
  const indirectReports = isManager ? filtered.filter(m => !m.isDirect) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-team"
            placeholder="Search by name, ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger data-testid="select-department-filter" className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(d => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        {filtered.length} team member{filtered.length !== 1 ? "s" : ""}
        {isManager && directReports.length > 0 && ` (${directReports.length} direct, ${indirectReports.length} indirect)`}
      </div>

      {isManager && directReports.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" /> Direct Reports
          </h3>
          <div className="grid gap-2">
            {directReports.map(m => (
              <MemberCard key={m.id} member={m} onSelect={onSelect} isDirect />
            ))}
          </div>
        </div>
      )}

      {isManager && indirectReports.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Indirect Reports</h3>
          <div className="grid gap-2">
            {indirectReports.map(m => (
              <MemberCard key={m.id} member={m} onSelect={onSelect} isDirect={false} />
            ))}
          </div>
        </div>
      )}

      {!isManager && (
        <div className="grid gap-2">
          {filtered.map(m => (
            <MemberCard key={m.id} member={m} onSelect={onSelect} isDirect />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No team members found matching your filters.
        </div>
      )}
    </div>
  );
}

function MemberCard({
  member,
  onSelect,
  isDirect,
}: {
  member: TeamMember;
  onSelect: (id: string) => void;
  isDirect: boolean;
}) {
  return (
    <Card
      data-testid={`card-member-${member.id}`}
      className={`cursor-pointer hover:shadow-md transition-shadow ${!isDirect ? "opacity-80 border-dashed" : ""}`}
      onClick={() => onSelect(member.id)}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
            {member.firstName[0]}{member.lastName[0]}
          </div>
          <div>
            <div className="font-medium flex items-center gap-2">
              {member.firstName} {member.lastName}
              {member.isActive ? (
                <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">Active</Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-red-300 text-red-700 dark:border-red-700 dark:text-red-400">Inactive</Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
              {member.employeeId && <span>{member.employeeId}</span>}
              {member.designation && <span>{member.designation}</span>}
              {member.departmentName && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {member.departmentName}
                </span>
              )}
              {member.joiningDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {formatDate(member.joiningDate)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={roleColors[member.role] || "bg-gray-100 text-gray-800"}>
            {member.role.replace("_", " ")}
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

interface EmployeeDetailViewProps {
  userId: string;
  onBack: () => void;
  onEditProfile?: () => void;
  onEditPayroll?: () => void;
  onEditAttendance?: (record: AttendanceRecord) => void;
  onAddHoliday?: () => void;
  onRemoveHoliday?: (selectionId: string, note: string) => void;
  onAddContact?: () => void;
  onEditContact?: (contact: EmergencyContact) => void;
  onDeleteContact?: (contactId: string, note: string) => void;
  onReviewTicket?: (ticket: TicketRecord) => void;
}

function EmployeeDetailView({
  userId,
  onBack,
  onEditProfile,
  onEditPayroll,
  onEditAttendance,
  onAddHoliday,
  onRemoveHoliday,
  onAddContact,
  onEditContact,
  onDeleteContact,
  onReviewTicket,
}: EmployeeDetailViewProps) {
  const { data, isLoading } = useQuery<EmployeeDetails>({
    queryKey: ["/api/admin/my-team", userId, "details"],
  });

  const auditQuery = useQuery<{ logs: AuditLogEntry[]; total: number }>({
    queryKey: ["/api/admin/my-team", userId, "audit-log"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load employee details.
        <Button variant="outline" className="ml-3" onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  const user = data.user;
  const profile: EmployeeProfile = {
    id: user.id,
    employeeId: user.employeeId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    designation: user.designation,
    departmentId: user.departmentId,
    departmentName: user.departmentName,
    joiningDate: user.joiningDate,
    isActive: user.isActive,
    hierarchyLevel: user.hierarchyLevel,
    salary: user.salary || null,
    gender: (user as any).gender ?? null,
    employmentType: (user as any).employmentType ?? null,
    attendanceExempt: (user as any).attendanceExempt ?? false,
    trainingExempt: (user as any).trainingExempt ?? false,
    maternityLeaveEligible: (user as any).maternityLeaveEligible ?? false,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button data-testid="button-back" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">{profile.firstName} {profile.lastName}</h2>
          <p className="text-sm text-muted-foreground">{profile.employeeId || "No ID"} · {profile.email}</p>
        </div>
        <Badge className={`ml-auto ${roleColors[profile.role] || ""}`}>
          {profile.role.replace("_", " ")}
        </Badge>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger data-testid="tab-profile" value="profile" className="gap-1">
            <UserCircle className="h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger data-testid="tab-salary" value="salary" className="gap-1">
            <DollarSign className="h-4 w-4" /> Salary
          </TabsTrigger>
          <TabsTrigger data-testid="tab-attendance" value="attendance" className="gap-1">
            <Clock className="h-4 w-4" /> Attendance
          </TabsTrigger>
          <TabsTrigger data-testid="tab-holidays" value="holidays" className="gap-1">
            <TreePalm className="h-4 w-4" /> Holidays
          </TabsTrigger>
          <TabsTrigger data-testid="tab-leaves" value="leaves" className="gap-1">
            <CalendarDays className="h-4 w-4" /> Leave Balances
          </TabsTrigger>
          <TabsTrigger data-testid="tab-leave-tracking" value="leave-tracking" className="gap-1">
            <CalendarPlus className="h-4 w-4" /> Leave Tracking
          </TabsTrigger>
          <TabsTrigger data-testid="tab-emergency" value="emergency" className="gap-1">
            <Phone className="h-4 w-4" /> Emergency Contacts
          </TabsTrigger>
          <TabsTrigger data-testid="tab-tickets" value="tickets" className="gap-1">
            <FileText className="h-4 w-4" /> Tickets
          </TabsTrigger>
          <TabsTrigger data-testid="tab-regularizations" value="regularizations" className="gap-1">
            <ClipboardList className="h-4 w-4" /> Regularizations
          </TabsTrigger>
          <TabsTrigger data-testid="tab-shift" value="shift" className="gap-1">
            <Timer className="h-4 w-4" /> Shift
          </TabsTrigger>
          <TabsTrigger data-testid="tab-history" value="history" className="gap-1">
            <History className="h-4 w-4" /> Change History
          </TabsTrigger>
          <TabsTrigger data-testid="tab-compliance" value="compliance" className="gap-1">
            <BadgeCheck className="h-4 w-4" /> Compliance
          </TabsTrigger>
          <TabsTrigger data-testid="tab-governance" value="governance" className="gap-1">
            <ShieldCheck className="h-4 w-4" /> Governance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab profile={profile} onEdit={onEditProfile} onEditPayroll={onEditPayroll} />
        </TabsContent>
        <TabsContent value="salary">
          <SalaryTab salary={data.salary} employeeId={userId} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceTab records={data.attendance} onEdit={onEditAttendance} shiftTiming={data.user.shiftTiming ?? null} />
        </TabsContent>
        <TabsContent value="holidays">
          <HolidaysTab
            holidays={data.holidays || []}
            regionalSelections={data.regionalHolidaySelections}
            onAddHoliday={onAddHoliday}
            onRemoveHoliday={onRemoveHoliday}
          />
        </TabsContent>
        <TabsContent value="leaves">
          <LeavesTab balances={data.leaveBalances || []} recentLeaves={data.recentLeaves || []} />
        </TabsContent>
        <TabsContent value="leave-tracking">
          <LeaveTrackingTab userId={userId} />
        </TabsContent>
        <TabsContent value="emergency">
          <EmergencyContactsTab
            contacts={data.emergencyContacts}
            onAdd={onAddContact}
            onEdit={onEditContact}
            onDelete={onDeleteContact}
          />
        </TabsContent>
        <TabsContent value="tickets">
          <TicketsTab tickets={data.tickets} onReview={onReviewTicket} />
        </TabsContent>
        <TabsContent value="regularizations">
          <TeamMemberRegularizations userId={userId} />
        </TabsContent>
        <TabsContent value="shift">
          <ShiftTab userId={userId} />
        </TabsContent>
        <TabsContent value="history">
          <ChangeHistoryTab auditQuery={auditQuery} />
        </TabsContent>
        <TabsContent value="governance">
          <GovernanceControlsTab employeeId={userId} canClose={true} />
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BadgeCheck className="h-4 w-4" /> Compliance & Exemption Flags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Employment Type</div>
                  <div className="font-medium">{profile.employmentType || "—"}</div>
                </div>
                <div className="border rounded-lg p-4 space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Gender</div>
                  <div className="font-medium">{profile.gender || "—"}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`border rounded-lg p-4 ${profile.attendanceExempt ? "bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800" : ""}`}>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Attendance Exempt</div>
                  <div className={`font-semibold ${profile.attendanceExempt ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>
                    {profile.attendanceExempt ? "Yes — Exempt" : "No"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Skip daily punch-in compliance</div>
                </div>
                <div className={`border rounded-lg p-4 ${profile.trainingExempt ? "bg-purple-50 border-purple-200 dark:bg-purple-900/10 dark:border-purple-800" : ""}`}>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Training Exempt</div>
                  <div className={`font-semibold ${profile.trainingExempt ? "text-purple-700 dark:text-purple-300" : "text-muted-foreground"}`}>
                    {profile.trainingExempt ? "Yes — Exempt" : "No"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Skip training compliance lock</div>
                </div>
                <div className={`border rounded-lg p-4 ${profile.maternityLeaveEligible ? "bg-pink-50 border-pink-200 dark:bg-pink-900/10 dark:border-pink-800" : ""}`}>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Maternity Leave Eligible</div>
                  <div className={`font-semibold ${profile.maternityLeaveEligible ? "text-pink-700 dark:text-pink-300" : "text-muted-foreground"}`}>
                    {profile.maternityLeaveEligible ? "Yes — Eligible" : "No"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Can apply for maternity leave</div>
                </div>
              </div>
              {onEditProfile && (
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={onEditProfile} data-testid="button-edit-compliance">
                    <Edit className="h-4 w-4 mr-1" /> Edit Flags
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ShiftHistoryEntry {
  id: string;
  changed_at: string;
  reason: string;
  old_shift_id: string | null;
  new_shift_id: string | null;
  changed_by_name: string;
  changed_by_email: string;
  old_shift_label: string | null;
  new_shift_label: string | null;
}

interface ShiftInfo {
  id: string;
  name: string;
  displayLabel: string;
  usCoverage: string;
  istStart: string;
  istEnd: string;
  isDst: boolean;
}

function ShiftTab({ userId }: { userId: string }) {
  const historyQuery = useQuery<ShiftHistoryEntry[]>({
    queryKey: ["/api/hr/users", userId, "shift-history"],
    queryFn: async () => {
      const res = await fetch(`/api/hr/users/${userId}/shift-history`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const detailsQuery = useQuery<EmployeeDetails>({
    queryKey: ["/api/admin/my-team", userId, "details"],
  });

  const currentShiftId = detailsQuery.data?.user?.shiftId ?? null;
  const shiftTiming = detailsQuery.data?.user?.shiftTiming ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Current Shift
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!currentShiftId ? (
            <p className="text-sm text-muted-foreground">No shift assigned.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" data-testid="badge-current-shift">
                  {currentShiftId}
                </Badge>
                <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                  {shiftTiming?.isDst ? "Summer schedule" : "Winter schedule"} · active
                </span>
              </div>
              {shiftTiming && (
                <p className="text-sm text-muted-foreground">
                  IST: <span className="font-medium text-foreground">{shiftTiming.istStart} – {shiftTiming.istEnd}</span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Shift Change History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !historyQuery.data || historyQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No shift changes recorded.</p>
          ) : (
            <div className="space-y-3">
              {historyQuery.data.map(entry => (
                <div key={entry.id} className="border rounded-lg p-3 text-sm" data-testid={`shift-history-${entry.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground">{entry.old_shift_label || "No shift"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{entry.new_shift_label || "No shift"}</span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        By {entry.changed_by_name} · {new Date(entry.changed_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-xs italic">"{entry.reason}"</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileTab({ profile, onEdit, onEditPayroll }: { profile: EmployeeProfile; onEdit?: () => void; onEditPayroll?: () => void }) {
  const { data: probationStatus } = useQuery<{
    active: boolean;
    reason: string;
    probationEndDate: string | null;
    confirmed: boolean;
    confirmedAt?: string | null;
    confirmedByName?: string | null;
    overdue: boolean;
    probationMonths: number;
  }>({
    queryKey: ["/api/hr/probation-status", profile.id],
    queryFn: async () => {
      const res = await fetch(`/api/hr/probation-status/${profile.id}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const fields = [
    { label: "Employee ID", value: profile.employeeId || "—" },
    { label: "Email", value: profile.email },
    { label: "Designation", value: profile.designation || "—" },
    { label: "Department", value: profile.departmentName || "—" },
    { label: "Hierarchy Level", value: profile.hierarchyLevel?.replace("_", " ") || "—" },
    { label: "Joining Date", value: formatDate(profile.joiningDate) },
    { label: "Status", value: profile.isActive ? "Active" : "Inactive" },
    { label: "Role", value: profile.role.replace("_", " ") },
    { label: "Gender", value: profile.gender || "—" },
    { label: "Employment Type", value: profile.employmentType || "—" },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCircle className="h-5 w-5" /> Personal Information
        </CardTitle>
        <div className="flex items-center gap-2">
          {onEditPayroll && (
            <Button data-testid="button-payroll-config" variant="ghost" size="sm" onClick={onEditPayroll}>
              <DollarSign className="h-4 w-4 mr-1" /> Payroll Config
            </Button>
          )}
          {onEdit && (
            <Button data-testid="button-edit-profile" variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(f => (
            <div key={f.label}>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{f.label}</div>
              <div className="font-medium mt-1">{f.value}</div>
            </div>
          ))}
        </div>
      <div className="mt-4 border-t pt-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Exemption Flags</div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${profile.attendanceExempt ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" : "bg-muted text-muted-foreground"}`} data-testid="badge-attendance-exempt">
            {profile.attendanceExempt ? "✓" : "✗"} Attendance Exempt
          </span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${profile.trainingExempt ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" : "bg-muted text-muted-foreground"}`} data-testid="badge-training-exempt">
            {profile.trainingExempt ? "✓" : "✗"} Training Exempt
          </span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${profile.maternityLeaveEligible ? "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" : "bg-muted text-muted-foreground"}`} data-testid="badge-maternity-eligible">
            {profile.maternityLeaveEligible ? "✓" : "✗"} Maternity Leave Eligible
          </span>
        </div>
      </div>
      {probationStatus !== undefined && (
        <div className="mt-4 border-t pt-4" data-testid="section-probation-status">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Probation Status</div>
          {!probationStatus ? null : probationStatus.confirmed ? (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400" data-testid="badge-probation-cleared">
              <ShieldCheck className="h-4 w-4" />
              <div>
                <span className="font-medium">Probation confirmed — full leave accrual active.</span>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {probationStatus.confirmedAt && (
                    <span className="text-xs text-muted-foreground">
                      Confirmed on {new Date(probationStatus.confirmedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  )}
                  {probationStatus.confirmedByName && (
                    <span className="text-xs text-muted-foreground">
                      by {probationStatus.confirmedByName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : probationStatus.overdue ? (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-4 py-3" data-testid="badge-probation-overdue">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Action Required — Probation Period Elapsed</p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                  The {probationStatus.probationMonths}-month probation period ended on{" "}
                  {probationStatus.probationEndDate
                    ? new Date(probationStatus.probationEndDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                    : "—"}
                  {" "}but has not been formally confirmed. EL & SL accrual remains paused until HR confirms the outcome.
                </p>
              </div>
            </div>
          ) : probationStatus.active ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3" data-testid="badge-probation-active">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Active Probation</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  {probationStatus.probationMonths}-month probation period
                  {probationStatus.probationEndDate
                    ? `. Scheduled end: ${new Date(probationStatus.probationEndDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`
                    : "."}
                  {" "}EL & SL accrual is paused until probation concludes or is confirmed by HR.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400" data-testid="badge-probation-cleared">
              <ShieldCheck className="h-4 w-4" />
              <span>Not on active probation.</span>
            </div>
          )}
        </div>
      )}
      </CardContent>
    </Card>
  );
}

interface SalaryChangeRow {
  id: string;
  employeeId: string;
  sourceType: string;
  sourceDocumentType: string | null;
  oldSalary: string | null;
  newSalary: string | null;
  amount: string | null;
  effectiveDate: string | null;
  reason: string | null;
  status: string;
  createdAt: string;
  initiator?: { firstName: string; lastName: string } | null;
  approver?: { firstName: string; lastName: string } | null;
}

interface ProofOption { type: string; id: string; label: string; salary: string | null }

const salarySourceLabels: Record<string, string> = {
  offer_letter: "Offer Letter",
  addendum: "Addendum",
  manual: "Manual Edit",
  advance: "Salary Advance",
};

const salaryStatusStyles: Record<string, string> = {
  applied: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pending_approval: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function SalaryChangeDialog({ employeeId, currentSalary, open, onOpenChange }: { employeeId: string; currentSalary: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [newSalary, setNewSalary] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [proofRef, setProofRef] = useState("none");

  const proofQuery = useQuery<ProofOption[]>({
    queryKey: ["/api/hr/salary-changes/proof-options", { employeeId }],
    enabled: open,
  });

  const submit = useMutation({
    mutationFn: async () => {
      const proof = (proofQuery.data || []).find(p => `${p.type}:${p.id}` === proofRef);
      if (!proof) throw new Error("Please select a linked proof document (offer letter or addendum).");
      return apiRequest("POST", "/api/hr/salary-changes", {
        employeeId,
        newSalary: Number(newSalary),
        effectiveDate,
        reason,
        proofDocumentType: proof.type,
        proofDocumentId: proof.id,
      });
    },
    onSuccess: async (res: any) => {
      const body = await res.json().catch(() => ({}));
      queryClient.invalidateQueries({ queryKey: ["/api/hr/salary-changes", { employeeId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-team", employeeId, "details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/salary-changes/pending-count"] });
      toast({
        title: body?.status === "applied" ? "Salary updated" : "Sent for approval",
        description: body?.status === "applied"
          ? "The new salary has been applied."
          : "A Super Admin must approve this change before it takes effect.",
      });
      onOpenChange(false);
      setNewSalary(""); setReason(""); setProofRef("none");
    },
    onError: (err: any) => {
      toast({ title: "Could not submit", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const canSubmit = Number(newSalary) > 0 && reason.trim().length >= 5 && !!effectiveDate && proofRef !== "none" && !!proofRef;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Salary</DialogTitle>
          <DialogDescription>
            Record a manual salary change. Changes you make may require Super Admin approval before they apply.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Current Salary</label>
            <div className="text-sm text-muted-foreground mt-1">{formatCurrency(currentSalary)}</div>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="new-salary">New Monthly Salary</label>
            <Input id="new-salary" data-testid="input-new-salary" type="number" min="0" step="0.01" value={newSalary} onChange={e => setNewSalary(e.target.value)} placeholder="e.g. 50000" />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="effective-date">Effective Date</label>
            <Input id="effective-date" data-testid="input-effective-date" type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Supporting Document <span className="text-red-500">*</span></label>
            <Select value={proofRef} onValueChange={setProofRef}>
              <SelectTrigger data-testid="select-proof-document"><SelectValue placeholder="Select a proof document" /></SelectTrigger>
              <SelectContent>
                {(proofQuery.data || []).map(p => (
                  <SelectItem key={`${p.type}:${p.id}`} value={`${p.type}:${p.id}`}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(proofQuery.data || []).length === 0 && (
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-no-proof-options">
                No offer letters or addendums are linked to this employee. A salary change requires a proof document.
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="salary-reason">Reason</label>
            <Textarea id="salary-reason" data-testid="input-salary-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this salary changing?" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-salary-change">Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={!canSubmit || submit.isPending} data-testid="button-submit-salary-change">
            {submit.isPending ? "Submitting…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SalaryTab({ salary, employeeId }: { salary: EmployeeDetails["salary"]; employeeId: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const { can } = usePermissions();
  const canEdit = can("payroll.employee.flags");

  const historyQuery = useQuery<SalaryChangeRow[]>({
    queryKey: ["/api/hr/salary-changes", { employeeId }],
    enabled: !!employeeId,
  });

  if (!salary) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No salary information available.
        </CardContent>
      </Card>
    );
  }

  const history = historyQuery.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <StatCard
            label="Current Salary"
            value={formatCurrency(salary.currentSalary)}
            icon={<DollarSign className="h-5 w-5" />}
            accentColour="text-green-600"
          />
        </div>
        {canEdit && (
          <Button onClick={() => setEditOpen(true)} data-testid="button-edit-salary" className="mt-1">
            <DollarSign className="h-4 w-4 mr-1" /> Edit Salary
          </Button>
        )}
      </div>

      <SalaryChangeDialog employeeId={employeeId} currentSalary={salary.currentSalary} open={editOpen} onOpenChange={setEditOpen} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5" /> Salary Change History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : history.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No salary changes recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Effective</th>
                    <th className="text-left py-2 font-medium">Source</th>
                    <th className="text-right py-2 font-medium">From</th>
                    <th className="text-right py-2 font-medium">To</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">By</th>
                    <th className="text-left py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} className="border-b last:border-0" data-testid={`row-salary-change-${h.id}`}>
                      <td className="py-2">{formatLocalDate(h.effectiveDate)}</td>
                      <td className="py-2">{salarySourceLabels[h.sourceType] || h.sourceType}</td>
                      <td className="text-right py-2">{h.sourceType === "advance" ? "—" : formatCurrency(h.oldSalary)}</td>
                      <td className="text-right py-2 font-medium">{h.sourceType === "advance" ? `+${formatCurrency(h.amount)}` : formatCurrency(h.newSalary)}</td>
                      <td className="py-2">
                        <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${salaryStatusStyles[h.status] || "bg-muted text-muted-foreground"}`}>
                          {h.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2">{h.initiator ? `${h.initiator.firstName} ${h.initiator.lastName}` : "—"}</td>
                      <td className="py-2 max-w-[200px] truncate" title={h.reason || ""}>{h.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Salary Slip History</CardTitle>
        </CardHeader>
        <CardContent>
          {(salary.slips || []).length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No salary slips found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Month/Year</th>
                    <th className="text-right py-2 font-medium">Gross</th>
                    <th className="text-right py-2 font-medium">Deductions</th>
                    <th className="text-right py-2 font-medium">Net</th>
                    <th className="text-right py-2 font-medium">Days Present</th>
                  </tr>
                </thead>
                <tbody>
                  {salary.slips.map(s => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2">{monthNames[s.month - 1]} {s.year}</td>
                      <td className="text-right py-2">{formatCurrency(s.grossSalary)}</td>
                      <td className="text-right py-2 text-red-600">{formatCurrency(s.deductions)}</td>
                      <td className="text-right py-2 font-medium">{formatCurrency(s.netPayable)}</td>
                      <td className="text-right py-2">{s.daysPresent}/{s.totalWorkingDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EmployeeAdvancesCard employeeId={employeeId} role={user?.role || ""} />
      <PayrollProfileCard employeeId={employeeId} />
    </div>
  );
}

// ── Payroll Profile Card — structure assignment + statutory flags ──────────────

interface PayrollProfile {
  id: string;
  salaryStructureId: string | null;
  pfExempt: boolean;
  esiDisability: boolean;
}

interface StructureOption {
  id: string;
  name: string;
  pfMode: string;
}

function PayrollProfileCard({ employeeId }: { employeeId: string }) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can("hr.salaryStructures.manage");
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<{ salaryStructureId: string; pfExempt: boolean; esiDisability: boolean } | null>(null);

  const profileQuery = useQuery<PayrollProfile>({
    queryKey: ["/api/hr/employees", employeeId, "payroll-profile"],
    queryFn: async () => {
      const res = await fetch(`/api/hr/employees/${employeeId}/payroll-profile`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payroll profile");
      return res.json();
    },
    enabled: !!employeeId,
  });

  const structuresQuery = useQuery<StructureOption[]>({
    queryKey: ["/api/hr/salary-structures"],
    enabled: editOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { salaryStructureId: string | null; pfExempt: boolean; esiDisability: boolean }) => {
      const res = await apiRequest("PUT", `/api/hr/employees/${employeeId}/payroll-profile`, payload);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payroll profile updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees", employeeId, "payroll-profile"] });
      setEditOpen(false);
    },
    onError: () => toast({ title: "Failed to update payroll profile", variant: "destructive" }),
  });

  function openEdit() {
    if (!profileQuery.data) return;
    setDraft({
      salaryStructureId: profileQuery.data.salaryStructureId || "",
      pfExempt: profileQuery.data.pfExempt,
      esiDisability: profileQuery.data.esiDisability,
    });
    setEditOpen(true);
  }

  const profile = profileQuery.data;
  const structures = structuresQuery.data || [];
  const assignedStructure = structures.find(s => s.id === profile?.salaryStructureId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> Payroll Settings
          </CardTitle>
          {canEdit && profile && (
            <Button size="sm" variant="outline" onClick={openEdit} data-testid="button-edit-payroll-profile">
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {profileQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !profile ? (
          <div className="text-sm text-muted-foreground text-center py-4">Payroll profile unavailable.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground font-medium mb-1">Salary Structure</p>
              <p data-testid="text-payroll-structure">
                {profile.salaryStructureId
                  ? (assignedStructure?.name || `Structure ${profile.salaryStructureId.slice(0, 8)}…`)
                  : <span className="text-muted-foreground">None assigned</span>}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium mb-1">PF Mode</p>
              <p data-testid="text-payroll-pf-mode">
                {profile.salaryStructureId && assignedStructure
                  ? (assignedStructure.pfMode === "restricted" ? "Restricted (₹15,000 cap)" : "Unrestricted")
                  : "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">PF Exempt</span>
              <span data-testid="text-payroll-pf-exempt" className={`text-xs px-2 py-0.5 rounded-full font-medium ${profile.pfExempt ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>
                {profile.pfExempt ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">ESI Disability</span>
              <span data-testid="text-payroll-esi-disability" className={`text-xs px-2 py-0.5 rounded-full font-medium ${profile.esiDisability ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground"}`}>
                {profile.esiDisability ? "Yes (₹25k threshold)" : "No"}
              </span>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payroll Settings</DialogTitle>
            <DialogDescription>
              Assign a salary structure and configure statutory exemption flags for this employee.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-5 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="payroll-structure-select">Salary Structure</Label>
                <Select
                  value={draft.salaryStructureId || "none"}
                  onValueChange={v => setDraft(d => d ? { ...d, salaryStructureId: v === "none" ? "" : v } : d)}
                >
                  <SelectTrigger id="payroll-structure-select" data-testid="select-payroll-structure">
                    <SelectValue placeholder="Select structure…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (no breakdown)</SelectItem>
                    {structuresQuery.isLoading
                      ? <SelectItem value="_loading" disabled>Loading…</SelectItem>
                      : structures.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="pf-exempt-toggle">PF Exempt</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Employee contributes 0% toward EPF</p>
                </div>
                <Switch
                  id="pf-exempt-toggle"
                  checked={draft.pfExempt}
                  onCheckedChange={v => setDraft(d => d ? { ...d, pfExempt: v } : d)}
                  data-testid="toggle-pf-exempt"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="esi-disability-toggle">ESI Disability (Higher Threshold)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Raises ESI applicability threshold from ₹21,000 to ₹25,000 gross/month (ESIC disability rule)</p>
                </div>
                <Switch
                  id="esi-disability-toggle"
                  checked={draft.esiDisability}
                  onCheckedChange={v => setDraft(d => d ? { ...d, esiDisability: v } : d)}
                  data-testid="toggle-esi-disability"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => draft && saveMutation.mutate({ salaryStructureId: draft.salaryStructureId || null, pfExempt: draft.pfExempt, esiDisability: draft.esiDisability })}
              disabled={saveMutation.isPending}
              data-testid="button-save-payroll-profile"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Advances & Adjustments card for MyTeam SalaryTab ─────────────────────────
const ADJ_MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface EmpRepayment {
  id: string;
  installmentNo: number;
  year: number;
  month: number;
  scheduledAmount: string;
  status: string;
  deductedAmount?: string | null;
}

interface EmpAdvanceRow {
  id: string;
  requestNumber: string;
  kind?: string;
  status: string;
  requestedAmount: string;
  approvedAmount?: string | null;
  outstandingBalance: string;
  repaymentMonths?: number | null;
  repaymentStartMonth?: number | null;
  repaymentStartYear?: number | null;
  targetMonth?: number | null;
  targetYear?: number | null;
  reason: string;
  backfilled?: boolean;
  disbursedAt?: string | null;
  createdAt: string;
  recordedBy?: { firstName: string; lastName: string } | null;
  reviewerComment?: string | null;
  repayments?: EmpRepayment[];
  monthsRemaining?: number;
}

function adjKindLabel(kind?: string) {
  if (kind === "overpayment") return "Overpayment";
  if (kind === "salary_credit") return "Salary Credit";
  return "Advance";
}

function adjStatusStyle(status: string) {
  const map: Record<string, string> = {
    pending_review: "bg-violet-100 text-violet-700",
    approved: "bg-green-100 text-green-700",
    disbursed: "bg-emerald-100 text-emerald-700",
    repaying: "bg-cyan-100 text-cyan-700",
    applied: "bg-teal-100 text-teal-700",
    rejected: "bg-red-100 text-red-700",
    returned: "bg-rose-100 text-rose-700",
    closed: "bg-slate-100 text-slate-600",
    cancelled: "bg-slate-100 text-slate-500",
  };
  return map[status] || "bg-muted text-muted-foreground";
}

const ADJ_RECORD_MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Helper: format a repayment status for the schedule table
function repaymentStatusBadge(status: string) {
  if (status === "deducted") return <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700">Deducted</span>;
  if (status === "skipped") return <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">Skipped</span>;
  return <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700">Scheduled</span>;
}

// Helper: format disbursedAt date for display
function formatDisbursedAt(val?: string | null) {
  if (!val) return null;
  try {
    return new Date(val).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return null; }
}

function EmployeeAdvancesCard({ employeeId, role }: { employeeId: string; role: string }) {
  const { toast } = useToast();
  const canSeeAdjustments = ["super_admin", "admin", "hr", "manager", "finance"].includes(role);
  const canRecord = ["super_admin", "admin", "hr"].includes(role);
  const canApprove = role === "super_admin";

  const { data: rows = [], isLoading, refetch } = useQuery<EmpAdvanceRow[]>({
    queryKey: ["/api/salary-advances/employee", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/salary-advances/employee/${employeeId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: canSeeAdjustments && !!employeeId,
  });

  // ── Accordion state ──────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Adjust start month dialog ────────────────────────────────────────────
  const [adjustRow, setAdjustRow] = useState<EmpAdvanceRow | null>(null);
  const nowForAdj = new Date();
  const nextMo = new Date(nowForAdj.getFullYear(), nowForAdj.getMonth() + 1, 1);
  const [adjMonth, setAdjMonth] = useState(String(nextMo.getMonth() + 1));
  const [adjYear, setAdjYear] = useState(String(nextMo.getFullYear()));

  const reschedule = useMutation({
    mutationFn: async ({ id, startYear, startMonth }: { id: string; startYear: number; startMonth: number }) => {
      const res = await apiRequest("PATCH", `/api/salary-advances/${id}/reschedule`, { startYear, startMonth });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Repayment schedule updated" });
      setAdjustRow(null);
      refetch();
    },
    onError: (e: any) => toast({ title: "Reschedule failed", description: e.message, variant: "destructive" }),
  });

  // ── Record dialog state ──────────────────────────────────────────────────
  const [showRecord, setShowRecord] = useState(false);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const defaultStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [recKind, setRecKind] = useState<"advance" | "overpayment" | "salary_credit">("overpayment");
  const [recAmount, setRecAmount] = useState("");
  const [recReason, setRecReason] = useState("");
  const [recMonths, setRecMonths] = useState("1");
  const [recStartMonth, setRecStartMonth] = useState(String(defaultStart.getMonth() + 1));
  const [recStartYear, setRecStartYear] = useState(String(defaultStart.getFullYear()));
  const [recTargetMonth, setRecTargetMonth] = useState(String(now.getMonth() + 1));
  const [recTargetYear, setRecTargetYear] = useState(String(now.getFullYear()));
  const [recDisbursedAt, setRecDisbursedAt] = useState(todayStr);

  const submitRecord = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(recAmount);
      if (isNaN(amt) || amt <= 0) throw new Error("Amount must be positive");
      const body: any = { employeeId, kind: recKind, amount: amt };
      if (recReason.trim()) body.reason = recReason.trim();
      if (recKind === "advance") {
        body.repaymentMonths = parseInt(recMonths, 10) || 1;
        body.startMonth = parseInt(recStartMonth, 10);
        body.startYear = parseInt(recStartYear, 10);
        body.disbursedAt = recDisbursedAt;
      } else if (recKind === "overpayment") {
        body.repaymentMonths = parseInt(recMonths, 10) || 1;
        body.startMonth = parseInt(recStartMonth, 10);
        body.startYear = parseInt(recStartYear, 10);
      } else if (recKind === "salary_credit") {
        body.targetMonth = parseInt(recTargetMonth, 10);
        body.targetYear = parseInt(recTargetYear, 10);
      }
      const res = await apiRequest("POST", "/api/salary-advances/backfill", body);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: (data) => {
      const toastMsg = recKind === "advance"
        ? data?.startMonthAdjusted
          ? `Advance recorded. Start month shifted to ${ADJ_MONTHS[data?.effectiveStart?.month] || ""} ${data?.effectiveStart?.year || ""} (July run is locked).`
          : "Advance recorded and active."
        : recKind === "salary_credit"
          ? "Salary credit submitted for approval"
          : "Overpayment submitted for approval";
      toast({ title: toastMsg });
      setShowRecord(false);
      setRecAmount(""); setRecReason(""); setRecMonths("1"); setRecDisbursedAt(todayStr);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/salary-advances/pending-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/salary-advances/my-submissions"] });
    },
    onError: (e: any) => toast({ title: "Failed to submit", description: e.message, variant: "destructive" }),
  });

  // ── Inline approve/return/reject state (super_admin) ────────────────────
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"return" | "reject" | "approve" | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [approveMonth, setApproveMonth] = useState("");
  const [approveYear, setApproveYear] = useState("");

  const submitReview = useMutation({
    mutationFn: async ({ id, type, comment, startYear, startMonth }: { id: string; type: "approve" | "return" | "reject"; comment?: string; startYear?: number | null; startMonth?: number | null }) => {
      const endpoint = type === "approve" ? "approve-adjustment" : type === "return" ? "return-adjustment" : "reject-adjustment";
      const body: any = type === "approve"
        ? (startYear && startMonth ? { startYear, startMonth } : {})
        : { comment };
      const res = await apiRequest("PATCH", `/api/salary-advances/${id}/${endpoint}`, body);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: (_d, vars) => {
      const labels = { approve: "Approved", return: "Returned for edit", reject: "Rejected" };
      toast({ title: labels[vars.type] });
      setActionRowId(null); setActionType(null); setActionComment("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/salary-advances/pending-adjustments"] });
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  // ── Reverse an already-approved adjustment (super_admin only) ─────────────
  // Sends an approved overpayment/credit back to the editable "returned" state.
  const [reverseRowId, setReverseRowId] = useState<string | null>(null);
  const [reverseComment, setReverseComment] = useState("");
  const reverseAdjustment = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
      const res = await apiRequest("PATCH", `/api/salary-advances/${id}/reverse-adjustment`, { comment });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Approval reversed", description: "The adjustment was returned for edit." });
      setReverseRowId(null); setReverseComment("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/salary-advances/pending-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/salary-advances/my-submissions"] });
    },
    onError: (e: any) => toast({ title: "Cannot reverse", description: e.message, variant: "destructive" }),
  });

  if (!canSeeAdjustments) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Advances &amp; Adjustments</CardTitle>
          {canRecord && (
            <Button size="sm" variant="outline" onClick={() => setShowRecord(true)} data-testid="button-record-adjustment">
              Record Adjustment
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">No advances or adjustments on record.</div>
        ) : (
          <div className="space-y-2">
            {rows.map(row => {
              const repayments = row.repayments || [];
              const scheduled = repayments.filter(r => r.status === "scheduled")
                .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
              const firstScheduled = scheduled[0];
              const isExpanded = expandedId === row.id;

              // "Adjust start month" is available when:
              // - it's a disbursed/repaying advance (not overpayment/credit)
              // - there is at least one scheduled (not yet deducted) installment
              // - the actor can record adjustments (hr/admin/super_admin)
              // Note: backend independently guards against choosing a locked salary run month.
              const canAdjust = canRecord && row.kind === "advance" &&
                ["disbursed", "repaying"].includes(row.status) &&
                scheduled.length > 0 &&
                !!firstScheduled;

              // Repayment summary line
              const startMonth = row.repaymentStartMonth;
              const startYear = row.repaymentStartYear;
              const summaryLine = row.kind === "advance" && repayments.length > 0
                ? `Repayment starts ${ADJ_MONTHS[startMonth || firstScheduled?.month || 0] || ""} ${startYear || firstScheduled?.year || ""} · ${scheduled.length} of ${repayments.length} remaining`
                : null;

              const disbursedLabel = formatDisbursedAt(row.disbursedAt);

              return (
                <div key={row.id} className="rounded-lg border" data-testid={`row-advance-${row.id}`}>
                  <div className="flex items-start justify-between gap-3 px-3 py-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{row.requestNumber}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-medium">{adjKindLabel(row.kind)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${adjStatusStyle(row.status)}`}>{row.status.replace(/_/g, " ")}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {row.reason || "—"}
                        {row.kind === "salary_credit" && row.targetMonth && row.targetYear
                          ? ` · Target: ${ADJ_MONTHS[row.targetMonth]} ${row.targetYear}` : ""}
                        {row.kind === "overpayment" && row.repaymentStartMonth && row.repaymentStartYear
                          ? ` · Recovery from ${ADJ_MONTHS[row.repaymentStartMonth]} ${row.repaymentStartYear}` : ""}
                      </div>
                      {disbursedLabel && row.kind === "advance" && (
                        <div className="text-xs text-muted-foreground mt-0.5">Disbursed on: {disbursedLabel}</div>
                      )}
                      {summaryLine && (
                        <div className="text-xs text-blue-600 mt-0.5">{summaryLine}</div>
                      )}
                      {row.reviewerComment && (row.status === "returned" || row.status === "rejected") && (
                        <div className="text-xs text-rose-600 mt-0.5">Note: {row.reviewerComment}</div>
                      )}
                    </div>
                    <div className="flex items-start gap-2 flex-wrap">
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-semibold">₹{formatCurrency(row.requestedAmount)}</div>
                        {Number(row.outstandingBalance) > 0 && row.kind !== "salary_credit" && (
                          <div className="text-xs text-muted-foreground">Bal: ₹{formatCurrency(row.outstandingBalance)}</div>
                        )}
                      </div>
                      {repayments.length > 0 && (
                        <button
                          className="text-muted-foreground hover:text-foreground mt-0.5"
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}
                          data-testid={`button-toggle-schedule-${row.id}`}
                          title={isExpanded ? "Collapse schedule" : "Show repayment schedule"}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                      {canApprove && row.status === "pending_review" && actionRowId !== row.id && (
                        <div className="flex gap-1 flex-wrap">
                          <Button size="sm" variant="outline" className="text-xs text-rose-600 border-rose-200 h-7 px-2"
                            onClick={() => { setActionRowId(row.id); setActionType("return"); setActionComment(""); }}
                            data-testid={`button-return-adj-${row.id}`}>Return</Button>
                          <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-200 h-7 px-2"
                            onClick={() => { setActionRowId(row.id); setActionType("reject"); setActionComment(""); }}
                            data-testid={`button-reject-adj-${row.id}`}>Reject</Button>
                          <Button size="sm" className="text-xs h-7 px-2"
                            onClick={() => {
                              if (row.kind === "overpayment") {
                                setActionRowId(row.id); setActionType("approve");
                                setApproveMonth(String(row.repaymentStartMonth || nextMo.getMonth() + 1));
                                setApproveYear(String(row.repaymentStartYear || nextMo.getFullYear()));
                              } else {
                                submitReview.mutate({ id: row.id, type: "approve" });
                              }
                            }}
                            disabled={submitReview.isPending}
                            data-testid={`button-approve-adj-${row.id}`}>Approve</Button>
                        </div>
                      )}
                      {canAdjust && actionRowId !== row.id && (
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-amber-600 border-amber-200"
                          onClick={() => {
                            setAdjustRow(row);
                            setAdjMonth(String(firstScheduled?.month || nextMo.getMonth() + 1));
                            setAdjYear(String(firstScheduled?.year || nextMo.getFullYear()));
                          }}
                          data-testid={`button-adjust-start-${row.id}`}>
                          Adjust start month
                        </Button>
                      )}
                      {canApprove && reverseRowId !== row.id &&
                        ((row.kind === "overpayment" && row.status === "disbursed") ||
                         (row.kind === "salary_credit" && row.status === "approved")) && (
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-orange-600 border-orange-200"
                          onClick={() => { setReverseRowId(row.id); setReverseComment(""); }}
                          data-testid={`button-reverse-adj-${row.id}`}>
                          Reverse
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Reverse an approved adjustment (super_admin) */}
                  {canApprove && reverseRowId === row.id && (
                    <div className="border-t px-3 py-2 bg-orange-50/50 space-y-2">
                      <Label className="text-xs">Reason for reversal (required)</Label>
                      <p className="text-xs text-muted-foreground">
                        This sends the approved {adjKindLabel(row.kind).toLowerCase()} back to an editable state so it can be corrected and resubmitted. It cannot be undone once money has been recovered or paid out.
                      </p>
                      <Textarea
                        value={reverseComment}
                        onChange={e => setReverseComment(e.target.value)}
                        placeholder="Why is this approval being reversed?"
                        className="text-sm" rows={2}
                        data-testid={`input-reverse-comment-${row.id}`} />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7" onClick={() => { setReverseRowId(null); setReverseComment(""); }}>Cancel</Button>
                        <Button size="sm" className="h-7 bg-orange-600 hover:bg-orange-700"
                          disabled={!reverseComment.trim() || reverseAdjustment.isPending}
                          onClick={() => reverseAdjustment.mutate({ id: row.id, comment: reverseComment.trim() })}
                          data-testid={`button-confirm-reverse-${row.id}`}>
                          Reverse Approval
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Accordion: repayment schedule */}
                  {isExpanded && repayments.length > 0 && (
                    <div className="border-t bg-muted/20 px-3 py-2">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Repayment Schedule</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="text-left py-1 font-medium">#</th>
                            <th className="text-left py-1 font-medium">Month</th>
                            <th className="text-right py-1 font-medium">Amount</th>
                            <th className="text-right py-1 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {repayments.map(r => (
                            <tr key={r.id} className="border-t border-muted/40">
                              <td className="py-1 text-muted-foreground">{r.installmentNo}</td>
                              <td className="py-1">{ADJ_MONTHS[r.month]} {r.year}</td>
                              <td className="py-1 text-right font-mono">
                                ₹{parseFloat(r.deductedAmount || r.scheduledAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-1 text-right">{repaymentStatusBadge(r.status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {canApprove && actionRowId === row.id && actionType === "approve" && (
                    <div className="border-t px-3 py-2 bg-muted/30 space-y-2">
                      <Label className="text-xs">First recovery month</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={approveMonth} onChange={e => setApproveMonth(e.target.value)}
                          className="w-full rounded-md border bg-background px-2 py-2 text-sm" data-testid={`select-approve-month-${row.id}`}>
                          {ADJ_RECORD_MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                        <Input type="number" min={2000} max={2100} value={approveYear} onChange={e => setApproveYear(e.target.value)} data-testid={`input-approve-year-${row.id}`} />
                      </div>
                      <p className="text-xs text-muted-foreground">Recovery deductions will begin from this month.</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7" onClick={() => { setActionRowId(null); setActionType(null); }}>Cancel</Button>
                        <Button size="sm" className="h-7"
                          disabled={!approveMonth || !approveYear || submitReview.isPending}
                          onClick={() => submitReview.mutate({ id: row.id, type: "approve", startMonth: parseInt(approveMonth, 10), startYear: parseInt(approveYear, 10) })}
                          data-testid={`button-confirm-approve-${row.id}`}>
                          Approve
                        </Button>
                      </div>
                    </div>
                  )}
                  {canApprove && actionRowId === row.id && (actionType === "return" || actionType === "reject") && (
                    <div className="border-t px-3 py-2 bg-muted/30 space-y-2">
                      <Label className="text-xs">{actionType === "return" ? "Return note (required)" : "Rejection reason (required)"}</Label>
                      <Textarea
                        value={actionComment}
                        onChange={e => setActionComment(e.target.value)}
                        placeholder={actionType === "return" ? "What needs to be corrected?" : "Why is this being rejected?"}
                        className="text-sm" rows={2}
                        data-testid={`input-adj-comment-${row.id}`} />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7" onClick={() => { setActionRowId(null); setActionType(null); }}>Cancel</Button>
                        <Button size="sm" className="h-7"
                          disabled={!actionComment.trim() || submitReview.isPending}
                          onClick={() => submitReview.mutate({ id: row.id, type: actionType!, comment: actionComment.trim() })}
                          data-testid={`button-confirm-adj-${row.id}`}>
                          Confirm
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Adjust start month dialog */}
        {adjustRow && (
          <Dialog open={!!adjustRow} onOpenChange={(o) => !o && setAdjustRow(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Adjust Start Month</DialogTitle>
                <DialogDescription>
                  Shift all pending installments for <strong>{adjustRow.requestNumber}</strong> to a new start month.
                  Already-deducted installments are not affected.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="space-y-1">
                  <Label className="text-xs">New start month</Label>
                  <select value={adjMonth} onChange={e => setAdjMonth(e.target.value)}
                    className="w-full rounded-md border bg-background px-2 py-2 text-sm" data-testid="select-adj-new-month">
                    {ADJ_RECORD_MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year</Label>
                  <Input type="number" min={2020} max={2100} value={adjYear} onChange={e => setAdjYear(e.target.value)} data-testid="input-adj-new-year" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAdjustRow(null)}>Cancel</Button>
                <Button
                  disabled={reschedule.isPending}
                  onClick={() => reschedule.mutate({ id: adjustRow.id, startYear: parseInt(adjYear, 10), startMonth: parseInt(adjMonth, 10) })}
                  data-testid="button-confirm-reschedule">
                  {reschedule.isPending ? "Saving…" : "Confirm"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Record adjustment dialog */}
        <Dialog open={showRecord} onOpenChange={(o) => !o && setShowRecord(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Salary Adjustment</DialogTitle>
              <DialogDescription>Submitted adjustments require super admin approval before affecting payroll.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Type</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant={recKind === "advance" ? "default" : "outline"}
                    onClick={() => setRecKind("advance")} data-testid="btn-kind-advance">Advance</Button>
                  <Button size="sm" variant={recKind === "overpayment" ? "default" : "outline"}
                    onClick={() => setRecKind("overpayment")} data-testid="btn-kind-overpayment">Overpayment</Button>
                  <Button size="sm" variant={recKind === "salary_credit" ? "default" : "outline"}
                    onClick={() => setRecKind("salary_credit")} data-testid="btn-kind-salary-credit">Salary Credit</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {recKind === "advance"
                    ? "Backfill an already-given advance. Recovery runs over the chosen months. Created active immediately."
                    : recKind === "overpayment"
                      ? "Records an overpayment to be recovered from salary in installments."
                      : "Records a one-time credit to be added to a specific payroll month."}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount (₹)</Label>
                <Input type="number" min={1} value={recAmount} onChange={e => setRecAmount(e.target.value)} placeholder="e.g. 5000" data-testid="input-adj-amount" />
              </div>
              {recKind === "advance" && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Date of Disbursement</Label>
                    <Input type="date" value={recDisbursedAt} onChange={e => setRecDisbursedAt(e.target.value)} data-testid="input-adj-disbursed-at" />
                    <p className="text-xs text-muted-foreground">When was the cash actually given to the employee?</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Repayment months</Label>
                      <Input type="number" min={1} max={36} value={recMonths} onChange={e => setRecMonths(e.target.value)} data-testid="input-adj-months" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Start month</Label>
                      <select value={recStartMonth} onChange={e => setRecStartMonth(e.target.value)}
                        className="w-full rounded-md border bg-background px-2 py-2 text-sm" data-testid="select-adj-start-month">
                        {ADJ_RECORD_MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Start year</Label>
                      <Input type="number" min={2000} max={2100} value={recStartYear} onChange={e => setRecStartYear(e.target.value)} data-testid="input-adj-start-year" />
                    </div>
                  </div>
                </>
              )}
              {recKind === "overpayment" && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Recovery months</Label>
                    <Input type="number" min={1} max={36} value={recMonths} onChange={e => setRecMonths(e.target.value)} data-testid="input-adj-months" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">First recovery month</Label>
                    <select value={recStartMonth} onChange={e => setRecStartMonth(e.target.value)}
                      className="w-full rounded-md border bg-background px-2 py-2 text-sm" data-testid="select-adj-ovp-start-month">
                      {ADJ_RECORD_MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Start year</Label>
                    <Input type="number" min={2000} max={2100} value={recStartYear} onChange={e => setRecStartYear(e.target.value)} data-testid="input-adj-ovp-start-year" />
                  </div>
                </div>
              )}
              {recKind === "salary_credit" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Target month</Label>
                    <select value={recTargetMonth} onChange={e => setRecTargetMonth(e.target.value)}
                      className="w-full rounded-md border bg-background px-2 py-2 text-sm" data-testid="select-adj-target-month">
                      {ADJ_RECORD_MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Target year</Label>
                    <Input type="number" min={2000} max={2100} value={recTargetYear} onChange={e => setRecTargetYear(e.target.value)} data-testid="input-adj-target-year" />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Description / Context (optional)</Label>
                <Textarea value={recReason} onChange={e => setRecReason(e.target.value)} rows={2} placeholder="Why is this adjustment needed?" data-testid="input-adj-reason" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRecord(false)}>Cancel</Button>
              <Button
                disabled={
                  !recAmount || parseFloat(recAmount) <= 0 ||
                  (recKind === "advance" && (parseInt(recMonths, 10) <= 0 || !recStartMonth)) ||
                  (recKind === "overpayment" && (parseInt(recMonths, 10) <= 0 || !recStartMonth || !recStartYear)) ||
                  submitRecord.isPending
                }
                onClick={() => submitRecord.mutate()}
                data-testid="button-submit-adj">
                {recKind === "advance" ? "Record Advance" : "Submit for Approval"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function getPunchInOffsetLabel(punchIn: string, shiftStart: string): string {
  const punchDate = new Date(punchIn);
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const punchIST = new Date(punchDate.getTime() + IST_OFFSET_MS);
  const punchMin = punchIST.getUTCHours() * 60 + punchIST.getUTCMinutes();
  const [sh, sm] = shiftStart.split(":").map(Number);
  const shiftMin = sh * 60 + sm;
  const diff = punchMin - shiftMin;
  if (Math.abs(diff) < 5) return "On time";
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const label = h > 0
    ? (m > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`)
    : `${m} min`;
  return diff < 0 ? `Punched in ${label} early` : `Punched in ${label} late`;
}

function AttendanceTab({ records, onEdit, shiftTiming }: { records: AttendanceRecord[]; onEdit?: (record: AttendanceRecord) => void; shiftTiming?: ShiftTimingInfo | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" /> Recent Attendance (Last 90 days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">No attendance records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-left py-2 font-medium">Punch In</th>
                  <th className="text-left py-2 font-medium">Punch Out</th>
                  <th className="text-right py-2 font-medium">Hours</th>
                  {onEdit && <th className="text-right py-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2">{formatDate(r.date)}</td>
                    <td className="py-2">
                      <Badge className={statusColors[r.status] || ""} variant="secondary">
                        {r.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <div>
                        <span>{formatTime(r.punchIn)}</span>
                        {r.punchIn && shiftTiming?.istStart && (
                          <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-punch-offset-${r.id}`}>
                            {getPunchInOffsetLabel(r.punchIn, shiftTiming.istStart)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-2">{formatTime(r.punchOut)}</td>
                    <td className="text-right py-2">{r.totalHours ? parseFloat(r.totalHours).toFixed(1) : "—"}</td>
                    {onEdit && (
                      <td className="text-right py-2">
                        <Button data-testid={`button-edit-attendance-${r.id}`} variant="ghost" size="icon" onClick={() => onEdit(r)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HolidaysTab({
  holidays,
  regionalSelections,
  onAddHoliday,
  onRemoveHoliday,
}: {
  holidays: ResolvedHoliday[];
  regionalSelections: RegionalSelection[];
  onAddHoliday?: () => void;
  onRemoveHoliday?: (selectionId: string, note: string) => void;
}) {
  const [removeNote, setRemoveNote] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <TreePalm className="h-5 w-5" /> Holidays ({new Date().getFullYear()})
        </CardTitle>
        {onAddHoliday && (
          <Button data-testid="button-add-holiday" variant="outline" size="sm" onClick={onAddHoliday}>
            <Plus className="h-4 w-4 mr-1" /> Add Regional Holiday
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {holidays.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">No holidays found.</div>
        ) : (
          <div className="space-y-2">
            {holidays.map(h => {
              const selection = regionalSelections.find(s => s.holidayId === h.id);
              return (
                <div key={h.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium">{h.name}</div>
                    <div className="text-sm text-muted-foreground">{formatDate(h.date)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.isOptional && <Badge variant="outline">Regional</Badge>}
                    <Badge variant="secondary">{h.type}</Badge>
                    {selection && onRemoveHoliday && (
                      removingId === selection.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            className="h-8 w-40 text-xs"
                            placeholder="Reason..."
                            value={removeNote}
                            onChange={e => setRemoveNote(e.target.value)}
                            data-testid={`input-remove-holiday-reason-${h.id}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={!removeNote.trim()}
                            onClick={() => { onRemoveHoliday(selection.id, removeNote); setRemovingId(null); setRemoveNote(""); }}
                            data-testid={`button-confirm-remove-holiday-${h.id}`}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setRemovingId(null); setRemoveNote(""); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          data-testid={`button-remove-holiday-${h.id}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => setRemovingId(selection.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmergencyContactsTab({
  contacts,
  onAdd,
  onEdit,
  onDelete,
}: {
  contacts: EmergencyContact[];
  onAdd?: () => void;
  onEdit?: (contact: EmergencyContact) => void;
  onDelete?: (contactId: string, note: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteNote, setDeleteNote] = useState("");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="h-5 w-5" /> Emergency Contacts
        </CardTitle>
        {onAdd && (
          <Button data-testid="button-add-contact" variant="outline" size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Contact
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">No emergency contacts found.</div>
        ) : (
          <div className="space-y-3">
            {contacts.map(c => (
              <div key={c.id} className="border rounded-lg p-4 flex items-start justify-between" data-testid={`card-contact-${c.id}`}>
                <div className="space-y-1">
                  <div className="font-medium flex items-center gap-2">
                    {c.name}
                    {c.isPrimary && <Badge variant="default" className="text-xs">Primary</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">{c.relationship}</div>
                  <div className="text-sm">{c.phone}</div>
                  {c.email && <div className="text-sm text-muted-foreground">{c.email}</div>}
                  {c.address && <div className="text-sm text-muted-foreground">{c.address}</div>}
                </div>
                <div className="flex gap-1">
                  {onEdit && (
                    <Button data-testid={`button-edit-contact-${c.id}`} variant="ghost" size="icon" onClick={() => onEdit(c)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    deletingId === c.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-8 w-40 text-xs"
                          placeholder="Reason..."
                          value={deleteNote}
                          onChange={e => setDeleteNote(e.target.value)}
                          data-testid={`input-delete-contact-reason-${c.id}`}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={!deleteNote.trim()}
                          onClick={() => { onDelete(c.id, deleteNote); setDeletingId(null); setDeleteNote(""); }}
                          data-testid={`button-confirm-delete-contact-${c.id}`}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setDeletingId(null); setDeleteNote(""); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button data-testid={`button-delete-contact-${c.id}`} variant="ghost" size="icon" onClick={() => setDeletingId(c.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const REG_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pending",  cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  approved: { label: "Approved", cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const REG_TYPE_LABELS: Record<string, string> = {
  missed_punch_in:  "Missed Punch In",
  missed_punch_out: "Missed Punch Out",
  wrong_absent:     "Wrong Absent Mark",
  correction:       "Time Correction",
};

function TeamMemberRegularizations({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [comment, setComment] = useState("");

  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hr/attendance/regularization", { employeeId: userId }],
    queryFn: async () => {
      const res = await fetch(`/api/hr/attendance/regularization?employeeId=${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: policyConfig } = useQuery<{ employeeWindowDays: number; managerCutoffDay: number; policyVersion: string }>({
    queryKey: ["/api/hr/attendance/regularization/policy"],
  });
  const cutoffDay = policyConfig?.managerCutoffDay ?? 20;

  const reviewMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/hr/attendance/regularization/${reviewId}/review`, {
        status: decision,
        reviewerComment: comment,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/regularization", { employeeId: userId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/regularization/all"] });
      toast({ title: decision === "approved" ? "Request Approved" : "Request Rejected" });
      setReviewId(null);
      setComment("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to review", variant: "destructive" });
    },
  });

  const reviewing = requests?.find(r => r.id === reviewId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {!requests || requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No regularization requests for this employee
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Reason</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => {
                    const cfg = REG_STATUS_CFG[r.status] || { label: r.status, cls: "" };
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`team-reg-row-${r.id}`}>
                        <td className="py-2.5 px-4 font-mono">{r.attendanceDate}</td>
                        <td className="py-2.5 px-4">{REG_TYPE_LABELS[r.requestType] || r.requestType}</td>
                        <td className="py-2.5 px-4 text-muted-foreground max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                        <td className="py-2.5 px-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          {r.status === "pending" && (() => {
                            const reqDay = Number(r.attendanceDate?.split("-")[2] ?? 0);
                            const pastCutoff = reqDay > cutoffDay;
                            if (pastCutoff) {
                              return (
                                <span
                                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-md px-2 py-1"
                                  title={`Date is past manager cutoff (day ${cutoffDay}) — HR must handle this`}
                                  data-testid={`badge-refer-hr-${r.id}`}
                                >
                                  Refer to HR
                                </span>
                              );
                            }
                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setReviewId(r.id); setDecision("approved"); setComment(""); }}
                                data-testid={`button-team-review-${r.id}`}
                              >
                                Review
                              </Button>
                            );
                          })()}
                          {r.status !== "pending" && r.reviewerName && (
                            <span className="text-xs text-muted-foreground">By {r.reviewerName}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review dialog */}
      {reviewId && reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
            <h3 className="text-base font-bold">Review Regularization Request</h3>
            <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-1">
              <p><span className="text-muted-foreground">Date: </span><span className="font-mono">{reviewing.attendanceDate}</span></p>
              <p><span className="text-muted-foreground">Type: </span>{REG_TYPE_LABELS[reviewing.requestType] || reviewing.requestType}</p>
              <p><span className="text-muted-foreground">Reason: </span>{reviewing.reason}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Decision</label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={decision === "approved" ? "default" : "outline"}
                  onClick={() => setDecision("approved")}
                  data-testid="button-approve"
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant={decision === "rejected" ? "destructive" : "outline"}
                  onClick={() => setDecision("rejected")}
                  data-testid="button-reject"
                >
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Comment <span className="text-destructive">*</span></label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Reason for your decision..."
                data-testid="input-team-review-comment"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReviewId(null)}>Cancel</Button>
              <Button
                onClick={() => reviewMutation.mutate()}
                disabled={!comment.trim() || reviewMutation.isPending}
                data-testid="button-submit-team-review"
              >
                {reviewMutation.isPending ? "Submitting..." : "Submit Decision"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TicketsTab({
  tickets,
  onReview,
}: {
  tickets: TicketRecord[];
  onReview?: (ticket: TicketRecord) => void;
}) {
  const ticketStatusColors: Record<string, string> = {
    open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    in_review: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" /> Tickets
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">No tickets found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Type</th>
                  <th className="text-left py-2 font-medium">Reason</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  {onReview && <th className="text-right py-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} className="border-b last:border-0" data-testid={`row-ticket-${t.id}`}>
                    <td className="py-2">{formatDate(t.date)}</td>
                    <td className="py-2">{t.type.replace("_", " ")}</td>
                    <td className="py-2 max-w-[200px] truncate">{t.reason}</td>
                    <td className="py-2">
                      <Badge className={ticketStatusColors[t.status] || ""} variant="secondary">
                        {t.status.replace("_", " ")}
                      </Badge>
                    </td>
                    {onReview && (
                      <td className="text-right py-2">
                        {(t.status === "open" || t.status === "in_review") && (
                          <Button data-testid={`button-review-ticket-${t.id}`} variant="outline" size="sm" onClick={() => onReview(t)}>
                            Review
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChangeHistoryTab({ auditQuery }: { auditQuery: ReturnType<typeof useQuery<{ logs: AuditLogEntry[]; total: number }>> }) {
  if (auditQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  const logs = auditQuery.data?.logs || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" /> Change History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">No audit trail entries found.</div>
        ) : (
          <div className="space-y-3">
            {logs.map(log => (
              <div key={log.id} className="border rounded-lg p-3" data-testid={`audit-log-${log.id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-sm">{log.action.replace(/_/g, " ")}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      by {log.actorName} ({log.actorEmail})
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
                {log.changes && (
                  <div className="mt-2 text-xs bg-muted p-2 rounded">
                    {typeof log.changes === "object" ? (
                      <div className="space-y-1">
                        {Object.entries(log.changes).map(([key, val]) => (
                          <div key={key}><span className="font-medium">{key}:</span> {JSON.stringify(val)}</div>
                        ))}
                      </div>
                    ) : (
                      <span>{String(log.changes)}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeavesTab({
  balances,
  recentLeaves,
}: {
  balances: LeaveBalance[];
  recentLeaves: LeaveRequest[];
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Leave Balances ({new Date().getFullYear()})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No leave balances found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {balances.map(b => {
                const total = parseFloat(b.totalDays);
                const used = parseFloat(b.usedDays);
                const remaining = total - used;
                return (
                  <div key={b.id} className="border rounded-lg p-3">
                    <div className="font-medium text-sm">{b.leaveTypeName}</div>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-2xl font-mono font-bold">{remaining.toFixed(1)}</span>
                      <span className="text-sm text-muted-foreground mb-0.5">/ {total.toFixed(1)} days</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Used: {used.toFixed(1)}</div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${total > 0 ? Math.min((remaining / total) * 100, 100) : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLeaves.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No leave requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Type</th>
                    <th className="text-left py-2 font-medium">Dates</th>
                    <th className="text-right py-2 font-medium">Days</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeaves.map(l => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2">{l.leaveTypeName}</td>
                      <td className="py-2">{formatDate(l.startDate)} — {formatDate(l.endDate)}</td>
                      <td className="text-right py-2">{parseFloat(l.totalDays).toFixed(1)}</td>
                      <td className="py-2">
                        <Badge className={leaveStatusColors[l.status] || ""} variant="secondary">
                          {l.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LeaveTrackingTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(false);
  const [reviewData, setReviewData] = useState<{ id: string; action: string; comment: string } | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    totalDays: "1",
    reason: "",
    note: "",
  });

  const { data: leaveData, isLoading } = useQuery<EmployeeLeaveData>({
    queryKey: ["/api/admin/my-team", userId, "leaves"],
  });

  const applyLeaveMutation = useMutation({
    mutationFn: (data: typeof leaveForm) =>
      apiRequest("POST", `/api/admin/my-team/${userId}/apply-leave`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-team", userId, "leaves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-team", userId, "details"] });
      setApplyLeaveOpen(false);
      setLeaveForm({ leaveTypeId: "", startDate: "", endDate: "", totalDays: "1", reason: "", note: "" });
      toast({ title: "Leave Applied", description: "Leave has been applied and auto-approved on behalf of the employee." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to apply leave", variant: "destructive" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (data: { id: string; status: string; reviewComment: string }) =>
      apiRequest("PATCH", `/api/hr/leave-requests/${data.id}/review`, {
        status: data.status,
        reviewComment: data.reviewComment,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-team", userId, "leaves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-team", userId, "details"] });
      setReviewData(null);
      toast({ title: "Reviewed", description: "Leave request has been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to review", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!leaveData) {
    return <div className="text-center py-8 text-muted-foreground">Failed to load leave tracking data.</div>;
  }

  const getLeaveTypeName = (id: string) => leaveData.leaveTypes?.find(lt => lt.id === id)?.name || "Unknown";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Leave Tracking ({leaveData.year})</h3>
        <Button onClick={() => setApplyLeaveOpen(true)} data-testid="button-apply-leave-behalf">
          <CalendarPlus className="h-4 w-4 mr-2" />
          Apply Leave on Behalf
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-days-taken">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-mono font-bold">{leaveData.summary.totalDaysTaken}</p>
                <p className="text-sm text-muted-foreground">Days Taken ({leaveData.year})</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-pending-requests">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-mono font-bold">{leaveData.summary.pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-most-used-type">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-lg font-bold">{leaveData.summary.mostUsedLeaveType}</p>
                <p className="text-sm text-muted-foreground">Most Used Type</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave Balances ({leaveData.year})</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveData.balances.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {leaveData.balances.map((bal) => {
                const total = parseFloat(bal.totalDays || "0");
                const used = parseFloat(bal.usedDays || "0");
                const remaining = Math.max(0, total - used);
                const pct = total > 0 ? (used / total) * 100 : 0;
                return (
                  <div key={bal.id} className="border rounded-lg p-4 space-y-2" data-testid={`balance-card-${bal.id}`}>
                    <p className="font-medium">{getLeaveTypeName(bal.leaveTypeId)}</p>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Earned: {total}</span>
                      <span>Used: {used}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-sm font-semibold text-right">Remaining: {remaining}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No leave balances found for this year.</p>
          )}
        </CardContent>
      </Card>

      {leaveData.accruals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leave Accrual History ({leaveData.year})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Month</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Leave Type</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Accrued</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Hours Worked</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Qualified</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveData.accruals.map((acc) => (
                    <tr key={acc.id} className="border-b last:border-0" data-testid={`accrual-row-${acc.id}`}>
                      <td className="py-2 px-2">{monthNames[acc.month - 1] || acc.month}</td>
                      <td className="py-2 px-2">{getLeaveTypeName(acc.leaveTypeId)}</td>
                      <td className="py-2 px-2">{acc.accruedDays}</td>
                      <td className="py-2 px-2">{parseFloat(acc.hoursWorked).toFixed(1)}h</td>
                      <td className="py-2 px-2">
                        <Badge variant="secondary" className={acc.qualified ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}>
                          {acc.qualified ? "Yes" : "No"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave History ({leaveData.year})</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveData.requests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">From</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">To</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Days</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Reason</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveData.requests.map((lr) => (
                    <tr key={lr.id} className="border-b last:border-0" data-testid={`leave-row-${lr.id}`}>
                      <td className="py-2 px-2">{getLeaveTypeName(lr.leaveTypeId)}</td>
                      <td className="py-2 px-2">{lr.startDate}</td>
                      <td className="py-2 px-2">{lr.endDate}</td>
                      <td className="py-2 px-2">{lr.totalDays}</td>
                      <td className="py-2 px-2 max-w-[200px] truncate">{lr.reason || "-"}</td>
                      <td className="py-2 px-2">
                        <Badge variant="secondary" className={leaveStatusColors[lr.status] || ""}>
                          {lr.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        {lr.status === "pending" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setReviewData({ id: lr.id, action: "approved", comment: "" })}
                              data-testid={`button-approve-${lr.id}`}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setReviewData({ id: lr.id, action: "rejected", comment: "" })}
                              data-testid={`button-reject-${lr.id}`}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                        {lr.reviewComment && (
                          <span className="text-xs text-muted-foreground block mt-1 max-w-[150px] truncate" title={lr.reviewComment}>
                            {lr.reviewComment}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No leave requests for {leaveData.year}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={applyLeaveOpen} onOpenChange={setApplyLeaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Leave on Behalf</DialogTitle>
            <DialogDescription>
              Apply retroactive leave for {leaveData.employee.firstName} {leaveData.employee.lastName}. Only past dates are allowed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Leave Type *</Label>
              <Select value={leaveForm.leaveTypeId} onValueChange={(v) => setLeaveForm(f => ({ ...f, leaveTypeId: v }))}>
                <SelectTrigger data-testid="select-leave-type">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveData.leaveTypes.filter(lt => lt.isActive).map(lt => (
                    <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={leaveForm.startDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setLeaveForm(f => ({ ...f, startDate: e.target.value }))}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={leaveForm.endDate}
                  max={new Date().toISOString().split("T")[0]}
                  min={leaveForm.startDate}
                  onChange={(e) => setLeaveForm(f => ({ ...f, endDate: e.target.value }))}
                  data-testid="input-end-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Total Days *</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={leaveForm.totalDays}
                onChange={(e) => setLeaveForm(f => ({ ...f, totalDays: e.target.value }))}
                data-testid="input-total-days"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Leave reason..."
                data-testid="input-reason"
              />
            </div>
            <div className="space-y-2">
              <Label>Note (why applying on behalf) *</Label>
              <Textarea
                value={leaveForm.note}
                onChange={(e) => setLeaveForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Explain why this leave is being applied on behalf..."
                data-testid="input-note"
              />
            </div>
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-yellow-800 dark:text-yellow-200">
                This leave will be auto-approved and deducted from the employee's balance immediately.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyLeaveOpen(false)} data-testid="button-cancel-apply-leave">Cancel</Button>
            <Button
              onClick={() => applyLeaveMutation.mutate(leaveForm)}
              disabled={applyLeaveMutation.isPending || !leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.note}
              data-testid="button-confirm-apply-leave"
            >
              {applyLeaveMutation.isPending ? "Applying..." : "Apply Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewData} onOpenChange={() => setReviewData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewData?.action === "approved" ? "Approve" : "Reject"} Leave Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comment (optional)</Label>
              <Textarea
                value={reviewData?.comment || ""}
                onChange={(e) => setReviewData(prev => prev ? { ...prev, comment: e.target.value } : null)}
                placeholder="Add a comment..."
                data-testid="input-review-comment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewData(null)} data-testid="button-cancel-review">Cancel</Button>
            <Button
              variant={reviewData?.action === "approved" ? "default" : "destructive"}
              onClick={() => {
                if (reviewData) {
                  reviewMutation.mutate({
                    id: reviewData.id,
                    status: reviewData.action,
                    reviewComment: reviewData.comment,
                  });
                }
              }}
              disabled={reviewMutation.isPending}
              data-testid="button-confirm-review"
            >
              {reviewMutation.isPending ? "Processing..." : (reviewData?.action === "approved" ? "Approve" : "Reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// HEALTHCARE PLANS - TYPES & COMPONENTS
// ==========================================

interface TeamPlan {
  id: string;
  employee_id: string;
  manager_id: string | null;
  plan_type: "probation" | "growth" | "pip";
  department_scope: string;
  status: string;
  outcome: string | null;
  start_date: string;
  end_date: string;
  duration_days: number;
  acknowledged_at: string | null;
  created_by: string;
  created_at: string;
  employee_name: string | null;
  manager_name: string | null;
  manager_goal_escalated_at?: string | null;
}

interface PlanGoal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  progress: number;
  status: string;
  start_date: string | null;
  target_date: string | null;
  plan_id: string | null;
}

function computePlanPhases(
  planType: string,
  startDate: string,
  durationDays?: number | null,
): Array<{ label: string; startDay: number; endDay: number; startDate: string; endDate: string }> {
  const dur = durationDays ?? (planType === "pip" ? 30 : 90);
  const msPerDay = 86400000;
  const start = new Date(startDate).getTime();
  const phaseLen = Math.ceil(dur / 3);
  return Array.from({ length: 3 }, (_, i) => {
    const phaseStart = i * phaseLen + 1;
    const phaseEnd = Math.min((i + 1) * phaseLen, dur);
    return {
      label: `Day ${phaseStart}–${phaseEnd}`,
      startDay: phaseStart,
      endDay: phaseEnd,
      startDate: new Date(start + (phaseStart - 1) * msPerDay).toISOString().slice(0, 10),
      endDate: new Date(start + (phaseEnd - 1) * msPerDay).toISOString().slice(0, 10),
    };
  });
}

function goalPhaseIdx(
  goal: PlanGoal,
  planStartDate: string,
  phases: ReturnType<typeof computePlanPhases>,
): number {
  if (!goal.start_date) return 0;
  const msPerDay = 86400000;
  const offset = Math.floor((new Date(goal.start_date).getTime() - new Date(planStartDate).getTime()) / msPerDay);
  for (let i = 0; i < phases.length; i++) {
    if (offset < phases[i].endDay) return i;
  }
  return phases.length - 1;
}

interface PlanCheckIn {
  id: string;
  employee_id: string;
  manager_id: string | null;
  plan_id: string | null;
  check_in_type: string;
  scheduled_date: string;
  status: string;
  employee_notes: string | null;
  manager_notes: string | null;
  action_items: string | null;
  rating: number | null;
  review_scores: Record<string, number | string> | null;
  completed_at: string | null;
  created_at: string;
}

interface CoachingLogEntry {
  id: string;
  plan_id: string;
  author_id: string;
  author_name: string | null;
  entry_date: string;
  content: string;
  created_at: string;
}

interface PlanDetail {
  plan: TeamPlan;
  checkIns: PlanCheckIn[];
  goals: PlanGoal[];
  coachingLog?: CoachingLogEntry[];
}

interface PlanTemplate {
  id: string;
  plan_type: string;
  role_slug: string;
  goal_title: string;
  goal_description: string | null;
  target_metric: string | null;
  sort_order: number;
}

const PLAN_TYPE_LABELS: Record<string, string> = {
  probation: "Probation",
  growth: "Growth Plan",
  pip: "PIP",
};

const PLAN_TYPE_COLORS: Record<string, string> = {
  probation: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  growth: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pip: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const CHECK_IN_TYPE_LABELS: Record<string, string> = {
  milestone: "Milestone Review",
  weekly: "Weekly Check-In",
  pip_review: "PIP Weekly Review",
  weekly_update: "Weekly Self-Update",
};

function daysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function calcCompliance(checkIns: PlanCheckIn[]): { done: number; total: number } {
  const today = todayStr();
  const scheduled = checkIns.filter(ci => ci.check_in_type !== "weekly_update" && ci.scheduled_date <= today);
  const done = scheduled.filter(ci => ci.status === "completed").length;
  return { done, total: scheduled.length };
}

function overdueCount(checkIns: PlanCheckIn[]): number {
  const today = todayStr();
  return checkIns.filter(
    ci => ci.check_in_type !== "weekly_update" && ci.scheduled_date < today && ci.status !== "completed"
  ).length;
}

// ── Star rating picker ─────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-2xl transition-colors ${n <= value ? "text-yellow-400" : "text-muted-foreground/30"}`}
          data-testid={`star-${n}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ── Score slider/select ────────────────────────────────────────────────
function ScoreSelect({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className={`text-sm font-bold px-2 py-0.5 rounded ${value >= 4 ? "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30" : value >= 3 ? "text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30" : "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30"}`}>
          {value}/5
        </span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 h-8 rounded text-xs font-medium transition-colors border ${n <= value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
            data-testid={`score-${label.replace(/\s+/g, "-").toLowerCase()}-${n}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Complete Check-In Modal ────────────────────────────────────────────
function CompleteCheckInModal({
  checkIn,
  goals,
  planType,
  onClose,
  onSuccess,
}: {
  checkIn: PlanCheckIn;
  goals: PlanGoal[];
  planType: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const isPip = checkIn.check_in_type === "pip_review";

  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [goalNotes, setGoalNotes] = useState<Record<string, string>>({});
  const [activityScore, setActivityScore] = useState(0);
  const [qualityScore, setQualityScore] = useState(0);
  const [atsScore, setAtsScore] = useState(0);
  const [communicationScore, setCommunicationScore] = useState(0);
  const [ownershipScore, setOwnershipScore] = useState(0);
  const [observations, setObservations] = useState("");
  const [employeeResponse, setEmployeeResponse] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {
        status: "completed",
        managerNotes: isPip ? observations : notes,
        rating: isPip ? null : (rating || null),
      };
      if (isPip) {
        body.reviewScores = {
          activity: activityScore,
          quality: qualityScore,
          ats_hygiene: atsScore,
          communication: communicationScore,
          ownership: ownershipScore,
          employee_verbal_response: employeeResponse,
        };
      } else {
        body.goalProgressNotes = goalNotes;
      }
      await apiRequest("PATCH", `/api/hr/check-ins/${checkIn.id}`, body);
    },
    onSuccess: () => {
      // Optimistic cache update: mark this check-in as completed in the plan detail cache
      if (checkIn.plan_id) {
        queryClient.setQueryData<PlanDetail>(
          ["/api/hr/plans", checkIn.plan_id],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              checkIns: old.checkIns.map(ci =>
                ci.id === checkIn.id ? { ...ci, status: "completed" } : ci
              ),
            };
          }
        );
        // Also invalidate to sync fresh data in background
        queryClient.invalidateQueries({ queryKey: ["/api/hr/plans", checkIn.plan_id] });
      }
      toast({ title: "Check-in completed" });
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to complete check-in", description: err.message, variant: "destructive" });
    },
  });

  const pipValid = isPip && activityScore > 0 && qualityScore > 0 && atsScore > 0 && communicationScore > 0 && ownershipScore > 0 && observations.trim().length > 0;
  const standardValid = !isPip && rating > 0 && notes.trim().length > 0;
  const canSubmit = isPip ? pipValid : standardValid;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {isPip ? "PIP Weekly Review" : `Complete Check-In — ${CHECK_IN_TYPE_LABELS[checkIn.check_in_type] || checkIn.check_in_type}`}
          </DialogTitle>
          <DialogDescription>
            Scheduled: {formatDate(checkIn.scheduled_date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {isPip ? (
            <>
              <div className="space-y-4">
                <ScoreSelect label="Activity Score" value={activityScore} onChange={setActivityScore} />
                <ScoreSelect label="Submission Quality" value={qualityScore} onChange={setQualityScore} />
                <ScoreSelect label="ATS Hygiene" value={atsScore} onChange={setAtsScore} />
                <ScoreSelect label="Communication" value={communicationScore} onChange={setCommunicationScore} />
                <ScoreSelect label="Ownership" value={ownershipScore} onChange={setOwnershipScore} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Manager Observations <span className="text-destructive">*</span></label>
                <Textarea
                  data-testid="input-pip-observations"
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                  placeholder="Observations on performance this week..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Employee's response (verbal)</label>
                <Textarea
                  data-testid="input-pip-employee-response"
                  value={employeeResponse}
                  onChange={e => setEmployeeResponse(e.target.value)}
                  placeholder="What the employee said verbally during the review..."
                  className="min-h-[80px]"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">Overall Rating <span className="text-destructive">*</span></label>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Manager Notes <span className="text-destructive">*</span></label>
                <Textarea
                  data-testid="input-check-in-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Summary of the check-in discussion..."
                  className="min-h-[100px]"
                />
              </div>
              {goals.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">Goal Progress Notes (optional)</label>
                  {goals.map(g => (
                    <div key={g.id} className="border rounded-lg p-3 space-y-2">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {g.title}
                        <span className="ml-auto text-xs text-muted-foreground">{g.progress}%</span>
                      </div>
                      <Textarea
                        data-testid={`input-goal-note-${g.id}`}
                        value={goalNotes[g.id] || ""}
                        onChange={e => setGoalNotes(prev => ({ ...prev, [g.id]: e.target.value }))}
                        placeholder="Progress update for this goal..."
                        className="min-h-[60px] text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-checkin">Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
            data-testid="button-submit-checkin"
          >
            {mutation.isPending ? "Saving..." : "Mark Completed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Plan Detail Drawer ─────────────────────────────────────────────────
function PlanDetailPanel({
  planId,
  onClose,
  onRefresh,
}: {
  planId: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [completeCheckIn, setCompleteCheckIn] = useState<PlanCheckIn | null>(null);

  const { data, isLoading, refetch } = useQuery<PlanDetail>({
    queryKey: ["/api/hr/plans", planId],
    queryFn: async () => {
      const res = await fetch(`/api/hr/plans/${planId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load plan");
      return res.json();
    },
  });

  const today = todayStr();

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-4 py-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!data) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <div className="text-center py-8 text-muted-foreground">Failed to load plan details.</div>
        </DialogContent>
      </Dialog>
    );
  }

  const { plan, checkIns, goals, coachingLog = [] } = data;
  const remaining = daysRemaining(plan.end_date);
  const compliance = calcCompliance(checkIns);
  const overdue = overdueCount(checkIns);

  const managerCheckIns = checkIns.filter(ci => ci.check_in_type !== "weekly_update");
  const selfUpdates = checkIns.filter(ci => ci.check_in_type === "weekly_update");
  const completedCIs = [...managerCheckIns].filter(ci => ci.status === "completed").sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""));
  const pendingCIs = managerCheckIns.filter(ci => ci.status !== "completed").sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  const phases = computePlanPhases(plan.plan_type, plan.start_date, plan.duration_days ?? null);
  const currentPhaseIdx = phases.findIndex(p => p.startDate <= today && today <= p.endDate);
  const goalsByPhase: PlanGoal[][] = phases.map(() => []);
  for (const g of goals) {
    const idx = goalPhaseIdx(g, plan.start_date, phases);
    goalsByPhase[idx].push(g);
  }

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Badge className={PLAN_TYPE_COLORS[plan.plan_type]}>
                {PLAN_TYPE_LABELS[plan.plan_type] || plan.plan_type}
              </Badge>
              <span>{plan.employee_name || "Employee"}</span>
            </DialogTitle>
            <DialogDescription className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span><strong>Start:</strong> {formatDate(plan.start_date)}</span>
              <span><strong>End:</strong> {formatDate(plan.end_date)}</span>
              <span className={remaining < 0 ? "text-red-600 font-medium" : remaining <= 7 ? "text-amber-600 font-medium" : ""}>
                {remaining < 0 ? `${Math.abs(remaining)} days overdue` : `${remaining} days remaining`}
              </span>
              <span className="text-muted-foreground">
                Compliance: <strong>{compliance.done}/{compliance.total}</strong>
                {overdue > 0 && <span className="ml-2 text-red-600">({overdue} overdue)</span>}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Manager accountability banner */}
            {(() => {
              if (!plan.manager_goal_escalated_at) return null;
              const escalatedAt = new Date(plan.manager_goal_escalated_at);
              const now = new Date();
              const daysSinceEscalation = Math.floor((now.getTime() - escalatedAt.getTime()) / 86400000);
              if (daysSinceEscalation < 5) return null;
              const latestGoalUpdate = goals.reduce((max, g) => {
                const t = g.updated_at ? new Date(g.updated_at).getTime() : 0;
                return t > max ? t : max;
              }, 0);
              const latestCheckInAction = checkIns.reduce((max, ci) => {
                const t = ci.completed_at ? new Date(ci.completed_at).getTime() : 0;
                return t > max ? t : max;
              }, 0);
              const latestCoachingEntry = coachingLog.reduce((max, c) => {
                const t = c.created_at ? new Date(c.created_at).getTime() : 0;
                return t > max ? t : max;
              }, 0);
              const latestCoachingAction = Math.max(latestGoalUpdate, latestCheckInAction, latestCoachingEntry);
              if (latestCoachingAction > escalatedAt.getTime()) return null;
              return (
                <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 px-4 py-3 flex items-start gap-2" data-testid="banner-manager-action-required">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">Action Required</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                      This employee was escalated {daysSinceEscalation} days ago for overdue goals with no progress.
                      No coaching action (check-in, goal update, or milestone) has been recorded since. Please take action.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Phase Timeline */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ChevronRight className="h-4 w-4" /> Plan Timeline
              </h3>
              <div className="flex gap-2" data-testid="section-phase-timeline">
                {phases.map((phase, idx) => {
                  const isCurrentPhase = idx === currentPhaseIdx;
                  const isPastPhase = phase.endDate < today;
                  const isFuturePhase = phase.startDate > today;
                  return (
                    <div
                      key={idx}
                      data-testid={`phase-${idx}`}
                      className={`flex-1 rounded-md px-3 py-2 border text-center transition-colors ${
                        isCurrentPhase
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : isPastPhase
                          ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700"
                          : "border-muted bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      <div className="text-xs font-medium">{phase.label}</div>
                      <div className="text-[10px] mt-0.5">
                        {isPastPhase ? "✓ Done" : isCurrentPhase ? "In progress" : isFuturePhase ? "Upcoming" : ""}
                      </div>
                      <div className="text-[10px] mt-0.5 opacity-70">
                        {goalsByPhase[idx]?.length ?? 0} goal{(goalsByPhase[idx]?.length ?? 0) !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Goals grouped by phase */}
            {goals.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" /> Goals ({goals.length})
                </h3>
                <div className="space-y-4">
                  {phases.map((phase, idx) => {
                    const phaseGoals = goalsByPhase[idx];
                    if (phaseGoals.length === 0) return null;
                    const isCurrentPhase = idx === currentPhaseIdx;
                    return (
                      <div key={idx} data-testid={`phase-goals-${idx}`}>
                        <div className={`text-xs font-semibold mb-2 px-2 py-1 rounded-md inline-flex items-center gap-1.5 ${
                          isCurrentPhase ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {isCurrentPhase && <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />}
                          {phase.label}
                        </div>
                        <div className="space-y-2">
                          {phaseGoals.map(g => {
                            const isOverdue = g.target_date && g.target_date < today && !["completed", "cancelled"].includes(g.status);
                            return (
                              <div key={g.id} className={`border rounded-lg p-3 space-y-2 ${isOverdue ? "border-orange-300" : ""}`} data-testid={`plan-goal-${g.id}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium flex items-center gap-1.5">
                                      {g.title}
                                      {isOverdue && (
                                        <Badge className="text-[10px] h-4 bg-orange-100 text-orange-700 border-orange-200">
                                          Overdue
                                        </Badge>
                                      )}
                                    </div>
                                    {g.description && <div className="text-xs text-muted-foreground mt-0.5">{g.description}</div>}
                                    {g.target_date && <div className="text-[10px] text-muted-foreground mt-0.5">Due {formatDate(g.target_date)}</div>}
                                  </div>
                                  <span className="text-xs font-semibold shrink-0">{g.progress}%</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-1.5">
                                  <div
                                    className="bg-primary rounded-full h-1.5 transition-all"
                                    style={{ width: `${g.progress}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upcoming / Overdue Check-Ins */}
            {pendingCIs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Upcoming Check-Ins
                </h3>
                <div className="space-y-2">
                  {pendingCIs.map(ci => {
                    const isOverdue = ci.scheduled_date < today;
                    return (
                      <div key={ci.id} className={`border rounded-lg p-3 flex items-center justify-between gap-3 ${isOverdue ? "border-red-200 bg-red-50/50 dark:border-red-800/30 dark:bg-red-900/10" : ""}`} data-testid={`pending-ci-${ci.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium flex items-center gap-2">
                            {CHECK_IN_TYPE_LABELS[ci.check_in_type] || ci.check_in_type}
                            {isOverdue && <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">Overdue</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatDate(ci.scheduled_date)}</div>
                        </div>
                        <Button
                          size="sm"
                          variant={isOverdue ? "destructive" : "outline"}
                          onClick={() => setCompleteCheckIn(ci)}
                          data-testid={`button-complete-ci-${ci.id}`}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Complete
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Check-In History */}
            {completedCIs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <History className="h-4 w-4" /> Check-In History
                </h3>
                <div className="space-y-2">
                  {completedCIs.map(ci => {
                    const scores = ci.review_scores as Record<string, any> | null;
                    return (
                      <div key={ci.id} className="border rounded-lg p-3 space-y-2" data-testid={`completed-ci-${ci.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">{CHECK_IN_TYPE_LABELS[ci.check_in_type] || ci.check_in_type}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(ci.scheduled_date)} · Completed {ci.completed_at ? formatDate(ci.completed_at) : ""}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {ci.rating !== null && ci.rating !== undefined && (
                              <span className="text-sm font-semibold text-yellow-600">{ci.rating}/5 ★</span>
                            )}
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">Done</Badge>
                          </div>
                        </div>
                        {ci.manager_notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/40 rounded px-2 py-1">{ci.manager_notes}</p>
                        )}
                        {scores && ci.check_in_type === "pip_review" && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {scores.activity !== undefined && <span>Activity: <strong>{scores.activity}/5</strong></span>}
                            {scores.quality !== undefined && <span>Quality: <strong>{scores.quality}/5</strong></span>}
                            {scores.ats_hygiene !== undefined && <span>ATS: <strong>{scores.ats_hygiene}/5</strong></span>}
                            {scores.communication !== undefined && <span>Comm: <strong>{scores.communication}/5</strong></span>}
                            {scores.ownership !== undefined && <span>Ownership: <strong>{scores.ownership}/5</strong></span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Employee Self-Updates */}
            {selfUpdates.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clipboard className="h-4 w-4" /> Employee Weekly Self-Updates
                </h3>
                <div className="space-y-2">
                  {[...selfUpdates].sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date)).map(su => (
                    <div key={su.id} className="border rounded-lg p-3 space-y-1" data-testid={`self-update-${su.id}`}>
                      <div className="text-xs font-medium text-muted-foreground">{formatDate(su.scheduled_date)}</div>
                      {su.employee_notes && <p className="text-sm">{su.employee_notes}</p>}
                      {!su.employee_notes && <p className="text-sm text-muted-foreground italic">No notes submitted</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {goals.length === 0 && pendingCIs.length === 0 && completedCIs.length === 0 && selfUpdates.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No goals or check-ins scheduled yet.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {completeCheckIn && (
        <CompleteCheckInModal
          checkIn={completeCheckIn}
          goals={goals}
          planType={plan.plan_type}
          onClose={() => setCompleteCheckIn(null)}
          onSuccess={() => {
            refetch();
            onRefresh();
          }}
        />
      )}
    </>
  );
}

// ── New Plan Modal ─────────────────────────────────────────────────────
const ROLE_SLUG_LABELS: Record<string, string> = {
  healthcare_sourcer_intern: "Healthcare Sourcer (Intern)",
  healthcare_recruiter_l1: "Healthcare Recruiter L1",
  associate_manager: "Associate Manager",
  delivery_manager: "Delivery Manager",
  foundation_to_senior: "Foundation → Senior Recruiter",
};

function NewPlanModal({
  teamMembers,
  managerId,
  activePlans,
  onClose,
  onSuccess,
}: {
  teamMembers: TeamMember[];
  managerId: string;
  activePlans: TeamPlan[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [planType, setPlanType] = useState<"growth" | "pip">("growth");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [startDate, setStartDate] = useState(() => todayStr());
  const [durationDays, setDurationDays] = useState(90);
  // editedGoals: array of { title, description } — initialized from templates, editable before create
  const [editedGoals, setEditedGoals] = useState<{ title: string; description: string; category: string }[]>([]);

  const endDate = (() => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + durationDays);
    return d.toISOString().split("T")[0];
  })();

  const templatesQuery = useQuery<PlanTemplate[]>({
    queryKey: ["/api/hr/plan-templates", planType, roleSlug],
    queryFn: async () => {
      if (!planType || !roleSlug) return [];
      const res = await fetch(`/api/hr/plan-templates?plan_type=${planType}&role_slug=${roleSlug}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!roleSlug && step === 2,
  });

  // Seed editedGoals from templates once when they load in step 2
  const seededKeyRef = useRef<string>("__none__");
  const templatesKey = `${planType}:${roleSlug}`;
  useEffect(() => {
    if (
      step === 2 &&
      templatesQuery.data &&
      templatesQuery.data.length > 0 &&
      seededKeyRef.current !== templatesKey
    ) {
      seededKeyRef.current = templatesKey;
      setEditedGoals(templatesQuery.data.map(t => ({
        title: t.goal_title,
        description: t.goal_description || "",
        category: "individual",
      })));
    }
  }, [step, templatesQuery.data, templatesKey]);

  const updateGoal = (i: number, field: "title" | "description", value: string) => {
    setEditedGoals(prev => prev.map((g, idx) => idx === i ? { ...g, [field]: value } : g));
  };

  const addCustomGoal = () => {
    setEditedGoals(prev => [...prev, { title: "", description: "", category: "individual" }]);
  };

  const removeGoal = (i: number) => {
    setEditedGoals(prev => prev.filter((_, idx) => idx !== i));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/hr/plans", {
        employee_id: selectedEmployee,
        plan_type: planType,
        start_date: startDate,
        end_date: endDate,
        duration_days: durationDays,
        manager_id: managerId,
        role_slug: roleSlug,
        custom_goals: editedGoals.filter(g => g.title.trim()),
      });
    },
    onSuccess: () => {
      toast({ title: "Plan created successfully" });
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create plan", description: err.message, variant: "destructive" });
    },
  });

  // Filter: direct + active + no existing active plan of this type
  const activeEmployeeIds = new Set(activePlans.filter(p => p.plan_type === planType).map(p => p.employee_id));
  const eligibleMembers = teamMembers.filter(m => m.isDirect && m.isActive && !activeEmployeeIds.has(m.id));

  const handleNextStep = () => {
    if (!selectedEmployee || !roleSlug) {
      toast({ title: "Please select an employee and role", variant: "destructive" });
      return;
    }
    setEditedGoals([]);
    seededKeyRef.current = "__none__";
    setStep(2);
  };

  const selectedMember = eligibleMembers.find(m => m.id === selectedEmployee) ||
    teamMembers.find(m => m.id === selectedEmployee);
  const validGoals = editedGoals.filter(g => g.title.trim()).length;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {step === 1 ? "New Healthcare Plan — Step 1: Setup" : "New Healthcare Plan — Step 2: Edit Goals"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? "Choose plan type and employee" : "Edit or add goals for this plan before creating"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Plan Type <span className="text-destructive">*</span></label>
              <Select value={planType} onValueChange={v => { setPlanType(v as "growth" | "pip"); setSelectedEmployee(""); }}>
                <SelectTrigger data-testid="select-new-plan-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="growth">Growth Plan (90 days)</SelectItem>
                  <SelectItem value="pip">PIP — Performance Improvement Plan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Employee <span className="text-destructive">*</span></label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger data-testid="select-new-plan-employee">
                  <SelectValue placeholder="Select a direct report" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleMembers.length === 0 ? (
                    <SelectItem value="__none__" disabled>All eligible employees have an active {PLAN_TYPE_LABELS[planType]}</SelectItem>
                  ) : eligibleMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} {m.designation ? `— ${m.designation}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {eligibleMembers.length === 0 && (
                <p className="text-xs text-amber-600">All active direct reports already have a {PLAN_TYPE_LABELS[planType]}.</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Role / Goal Template <span className="text-destructive">*</span></label>
              <Select value={roleSlug} onValueChange={setRoleSlug}>
                <SelectTrigger data-testid="select-new-plan-role">
                  <SelectValue placeholder="Select role template" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_SLUG_LABELS).map(([slug, label]) => (
                    <SelectItem key={slug} value={slug}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                data-testid="input-new-plan-start-date"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Duration (days)</label>
              <Select value={String(durationDays)} onValueChange={v => setDurationDays(Number(v))}>
                <SelectTrigger data-testid="select-new-plan-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {planType === "pip" ? (
                    <>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="45">45 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="120">120 days</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">End date: {formatDate(endDate)}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {templatesQuery.isLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Goals from the <strong>{ROLE_SLUG_LABELS[roleSlug] || roleSlug}</strong> template — edit titles and descriptions, or add custom goals before creating.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {editedGoals.map((g, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2" data-testid={`editable-goal-${i}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-1.5">
                          <Input
                            data-testid={`input-goal-title-${i}`}
                            value={g.title}
                            onChange={e => updateGoal(i, "title", e.target.value)}
                            placeholder="Goal title"
                            className="text-sm h-8"
                          />
                          <Input
                            data-testid={`input-goal-desc-${i}`}
                            value={g.description}
                            onChange={e => updateGoal(i, "description", e.target.value)}
                            placeholder="Description (optional)"
                            className="text-sm h-8 text-muted-foreground"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removeGoal(i)}
                          data-testid={`button-remove-goal-${i}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomGoal}
                  data-testid="button-add-custom-goal"
                  className="w-full"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Custom Goal
                </Button>
                {validGoals === 0 && (
                  <p className="text-xs text-destructive">At least one goal with a title is required.</p>
                )}
              </>
            )}
            <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Employee:</span><strong>{selectedMember?.firstName} {selectedMember?.lastName}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Plan type:</span><strong>{PLAN_TYPE_LABELS[planType]}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Duration:</span><strong>{durationDays} days ({formatDate(startDate)} → {formatDate(endDate)})</strong></div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)} data-testid="button-new-plan-back">Back</Button>
          )}
          <Button variant="outline" onClick={onClose} data-testid="button-new-plan-cancel">Cancel</Button>
          {step === 1 ? (
            <Button
              onClick={handleNextStep}
              disabled={!selectedEmployee || !roleSlug || eligibleMembers.length === 0}
              data-testid="button-new-plan-next"
            >
              Next: Edit Goals
            </Button>
          ) : (
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || validGoals === 0 || templatesQuery.isLoading}
              data-testid="button-new-plan-create"
            >
              {createMutation.isPending ? "Creating..." : `Create Plan with ${validGoals} goal${validGoals !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Team Plans Tab ─────────────────────────────────────────────────────
function TeamPlansTab({ teamMembers }: { teamMembers: TeamMember[] }) {
  const { user } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showNewPlan, setShowNewPlan] = useState(false);

  const { data: plans, isLoading, refetch } = useQuery<TeamPlan[]>({
    queryKey: ["/api/hr/plans", { status: "active" }],
    queryFn: async () => {
      const res = await fetch("/api/hr/plans?status=active", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load team plans");
      return res.json();
    },
  });

  const today = todayStr();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <div className="text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No active plans</p>
            <p className="text-sm mt-1">Your team members don't have any active Healthcare plans.</p>
          </div>
          <Button onClick={() => setShowNewPlan(true)} data-testid="button-new-plan-empty">
            <Plus className="h-4 w-4 mr-1" /> Start a New Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">{plans.length} active plan{plans.length !== 1 ? "s" : ""}</div>
        <Button onClick={() => setShowNewPlan(true)} data-testid="button-new-plan" size="sm">
          <Plus className="h-4 w-4 mr-1" /> New Plan
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Days Left</TableHead>
              <TableHead>Compliance</TableHead>
              <TableHead>Overdue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map(plan => {
              const remaining = daysRemaining(plan.end_date);
              return (
                <TableRow
                  key={plan.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedPlanId(plan.id)}
                  data-testid={`plan-row-${plan.id}`}
                >
                  <TableCell>
                    <div className="font-medium">{plan.employee_name || plan.employee_id}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${PLAN_TYPE_COLORS[plan.plan_type]} text-xs`}>
                      {PLAN_TYPE_LABELS[plan.plan_type] || plan.plan_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(plan.start_date)} – {formatDate(plan.end_date)}
                  </TableCell>
                  <TableCell>
                    <span className={remaining < 0 ? "text-red-600 font-medium text-sm" : remaining <= 7 ? "text-amber-600 font-medium text-sm" : "text-sm"}>
                      {remaining < 0 ? `${Math.abs(remaining)}d overdue` : `${remaining}d`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <PlanComplianceCell planId={plan.id} />
                  </TableCell>
                  <TableCell>
                    <PlanOverdueCell planId={plan.id} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {selectedPlanId && (
        <PlanDetailPanel
          planId={selectedPlanId}
          onClose={() => setSelectedPlanId(null)}
          onRefresh={refetch}
        />
      )}

      {showNewPlan && user && (
        <NewPlanModal
          teamMembers={teamMembers}
          managerId={user.id}
          activePlans={plans ?? []}
          onClose={() => setShowNewPlan(false)}
          onSuccess={refetch}
        />
      )}
    </>
  );
}

// Lazy compliance cell — fetches plan detail once to calculate compliance
function PlanComplianceCell({ planId }: { planId: string }) {
  const { data } = useQuery<PlanDetail>({
    queryKey: ["/api/hr/plans", planId],
    queryFn: async () => {
      const res = await fetch(`/api/hr/plans/${planId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60000,
  });
  if (!data) return <span className="text-muted-foreground text-sm">—</span>;
  const c = calcCompliance(data.checkIns);
  return <span className="text-sm">{c.done}/{c.total}</span>;
}

function PlanOverdueCell({ planId }: { planId: string }) {
  const { data, isLoading } = useQuery<PlanDetail>({
    queryKey: ["/api/hr/plans", planId],
    queryFn: async () => {
      const res = await fetch(`/api/hr/plans/${planId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60000,
  });
  if (isLoading) return <span className="text-muted-foreground text-sm">…</span>;
  if (!data) return <span className="text-muted-foreground text-sm">—</span>;
  const count = overdueCount(data.checkIns);
  if (count === 0) return <Badge variant="outline" className="text-xs border-green-300 text-green-700">None</Badge>;
  return (
    <Badge className={`text-xs ${count >= 2 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
      {count} overdue
    </Badge>
  );
}

export default function MyTeam() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEditPayroll = can("payroll.employee.flags");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageTab, setPageTab] = useState<"team" | "plans" | "corrections" | "ceipal">(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t === "corrections" || t === "plans" || t === "ceipal") return t as any;
    } catch {}
    return "team";
  });

  const [editAttendanceOpen, setEditAttendanceOpen] = useState(false);
  const [editAttendanceRecord, setEditAttendanceRecord] = useState<AttendanceRecord | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [payrollConfigOpen, setPayrollConfigOpen] = useState(false);
  const [addHolidayOpen, setAddHolidayOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editContactRecord, setEditContactRecord] = useState<EmergencyContact | null>(null);
  const [reviewTicketOpen, setReviewTicketOpen] = useState(false);
  const [reviewTicketRecord, setReviewTicketRecord] = useState<TicketRecord | null>(null);

  const [formNote, setFormNote] = useState("");
  const [formPunchIn, setFormPunchIn] = useState("");
  const [formPunchOut, setFormPunchOut] = useState("");
  const [formStatus, setFormStatus] = useState("");
  const [formDesignation, setFormDesignation] = useState("");
  const [formDepartmentId, setFormDepartmentId] = useState("");
  const [formHierarchyLevel, setFormHierarchyLevel] = useState("");
  const [formGender, setFormGender] = useState("");
  const [formEmploymentType, setFormEmploymentType] = useState("");
  const [formAttendanceExempt, setFormAttendanceExempt] = useState(false);
  const [formTrainingExempt, setFormTrainingExempt] = useState(false);
  const [formMaternityLeaveEligible, setFormMaternityLeaveEligible] = useState(false);
  const [formEmployeeCategory, setFormEmployeeCategory] = useState("experienced");
  const [formHolidayId, setFormHolidayId] = useState("");
  const [formContactName, setFormContactName] = useState("");
  const [formContactRelationship, setFormContactRelationship] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formContactAddress, setFormContactAddress] = useState("");
  const [formContactIsPrimary, setFormContactIsPrimary] = useState(false);
  const [formTicketStatus, setFormTicketStatus] = useState("");
  const [formTicketComment, setFormTicketComment] = useState("");
  const [formSalaryStructureId, setFormSalaryStructureId] = useState("__none__");
  const [formPfExempt, setFormPfExempt] = useState(false);
  const [formPtState, setFormPtState] = useState("__none__");
  const [formEsiApplicable, setFormEsiApplicable] = useState(true);
  const [formEsiDisability, setFormEsiDisability] = useState(false);
  const [formEsiDailyWageExempt, setFormEsiDailyWageExempt] = useState(false);
  const [formPayrollNote, setFormPayrollNote] = useState("");

  const membersQuery = useQuery<TeamMember[]>({
    queryKey: ["/api/admin/my-team/members"],
  });

  const activePlansQuery = useQuery<TeamPlan[]>({
    queryKey: ["/api/hr/plans", { status: "active" }],
    queryFn: async () => {
      const res = await fetch("/api/hr/plans?status=active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
  });

  const pendingCorrectionsCount = usePendingRegularizationCount(true);

  const detailsQuery = useQuery<EmployeeDetails>({
    queryKey: ["/api/admin/my-team", selectedUserId, "details"],
    enabled: !!selectedUserId,
  });

  const departmentsQuery = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const holidaysQuery = useQuery<HolidayItem[]>({
    queryKey: ["/api/hr/holidays"],
  });

  const structuresQuery = useQuery<Array<{ id: string; name: string; isActive: boolean }>>({
    queryKey: ["/api/payroll/structures"],
  });

  const employeePayrollFlagsQuery = useQuery<{
    salaryStructureId: string | null;
    pfExempt: boolean;
    ptState: string | null;
    esiApplicable: boolean;
    esiDisability: boolean;
    esiDailyWageExempt: boolean;
  }>({
    queryKey: ["/api/payroll/employees", selectedUserId, "flags"],
    queryFn: async () => {
      const res = await fetch(`/api/payroll/employees/${selectedUserId}/flags`, { credentials: "include" });
      if (!res.ok) return { salaryStructureId: null, pfExempt: false, ptState: null, esiApplicable: true, esiDisability: false, esiDailyWageExempt: false };
      return res.json();
    },
    enabled: !!selectedUserId && payrollConfigOpen,
  });

  useEffect(() => {
    if (!payrollConfigOpen) return;
    const d = employeePayrollFlagsQuery.data;
    if (!d) return;
    setFormSalaryStructureId(d.salaryStructureId || "__none__");
    setFormPfExempt(d.pfExempt || false);
    setFormPtState(d.ptState || "__none__");
    setFormEsiApplicable(d.esiApplicable ?? true);
    setFormEsiDisability(d.esiDisability || false);
    setFormEsiDailyWageExempt(d.esiDailyWageExempt || false);
  }, [payrollConfigOpen, employeePayrollFlagsQuery.data]);

  const editAttendanceMutation = useMutation({
    mutationFn: async (data: { punchIn?: string; punchOut?: string; status?: string; note: string }) => {
      await apiRequest("PATCH", `/api/admin/my-team/${selectedUserId}/attendance/${editAttendanceRecord!.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Attendance updated successfully" });
      setEditAttendanceOpen(false);
      resetForm();
      invalidateDetails();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update attendance", description: err.message, variant: "destructive" });
    },
  });

  const editProfileMutation = useMutation({
    mutationFn: async (data: { designation?: string; departmentId?: string; hierarchyLevel?: string; gender?: string; employmentType?: string; attendanceExempt?: boolean; trainingExempt?: boolean; maternityLeaveEligible?: boolean; note: string }) => {
      await apiRequest("PATCH", `/api/admin/my-team/${selectedUserId}/profile`, data);
    },
    onSuccess: () => {
      toast({ title: "Profile updated successfully" });
      setEditProfileOpen(false);
      resetForm();
      invalidateDetails();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update profile", description: err.message, variant: "destructive" });
    },
  });

  const payrollFlagsMutation = useMutation({
    mutationFn: async (data: { salaryStructureId: string | null; pfExempt: boolean; esiApplicable: boolean; esiDisability: boolean; esiDailyWageExempt: boolean; ptState: string | null; note: string }) => {
      await apiRequest("PATCH", `/api/payroll/employees/${selectedUserId}/payroll-flags`, data);
    },
    onSuccess: () => {
      toast({ title: "Payroll config updated", description: "The employee's payroll configuration has been saved." });
      setPayrollConfigOpen(false);
      setFormPayrollNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/employees", selectedUserId, "flags"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update payroll config", description: err.message, variant: "destructive" });
    },
  });

  const addHolidayMutation = useMutation({
    mutationFn: async (data: { holidayId: string; note: string }) => {
      await apiRequest("POST", `/api/admin/my-team/${selectedUserId}/regional-holidays`, data);
    },
    onSuccess: () => {
      toast({ title: "Regional holiday added" });
      setAddHolidayOpen(false);
      resetForm();
      invalidateDetails();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add holiday", description: err.message, variant: "destructive" });
    },
  });

  const removeHolidayMutation = useMutation({
    mutationFn: async ({ selectionId, note }: { selectionId: string; note: string }) => {
      await apiRequest("DELETE", `/api/admin/my-team/${selectedUserId}/regional-holidays/${selectionId}`, { note });
    },
    onSuccess: () => {
      toast({ title: "Regional holiday removed" });
      invalidateDetails();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove holiday", description: err.message, variant: "destructive" });
    },
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/admin/my-team/${selectedUserId}/emergency-contacts`, data);
    },
    onSuccess: () => {
      toast({ title: "Emergency contact added" });
      setAddContactOpen(false);
      resetForm();
      invalidateDetails();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add contact", description: err.message, variant: "destructive" });
    },
  });

  const editContactMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/admin/my-team/${selectedUserId}/emergency-contacts/${editContactRecord!.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Emergency contact updated" });
      setEditContactOpen(false);
      resetForm();
      invalidateDetails();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update contact", description: err.message, variant: "destructive" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async ({ contactId, note }: { contactId: string; note: string }) => {
      await apiRequest("DELETE", `/api/admin/my-team/${selectedUserId}/emergency-contacts/${contactId}`, { note });
    },
    onSuccess: () => {
      toast({ title: "Emergency contact deleted" });
      invalidateDetails();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete contact", description: err.message, variant: "destructive" });
    },
  });

  const reviewTicketMutation = useMutation({
    mutationFn: async (data: { status: string; reviewComment?: string; note: string }) => {
      await apiRequest("PATCH", `/api/admin/my-team/${selectedUserId}/tickets/${reviewTicketRecord!.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Ticket reviewed successfully" });
      setReviewTicketOpen(false);
      resetForm();
      invalidateDetails();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to review ticket", description: err.message, variant: "destructive" });
    },
  });

  function invalidateDetails() {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/my-team", selectedUserId, "details"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/my-team", selectedUserId, "audit-log"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/my-team/members"] });
  }

  function resetForm() {
    setFormNote("");
    setFormPunchIn("");
    setFormPunchOut("");
    setFormStatus("");
    setFormDesignation("");
    setFormDepartmentId("");
    setFormHierarchyLevel("");
    setFormGender("");
    setFormEmploymentType("");
    setFormAttendanceExempt(false);
    setFormTrainingExempt(false);
    setFormMaternityLeaveEligible(false);
    setFormEmployeeCategory("experienced");
    setFormHolidayId("");
    setFormContactName("");
    setFormContactRelationship("");
    setFormContactPhone("");
    setFormContactEmail("");
    setFormContactAddress("");
    setFormContactIsPrimary(false);
    setFormTicketStatus("");
    setFormTicketComment("");
  }

  function openEditAttendance(record: AttendanceRecord) {
    setEditAttendanceRecord(record);
    setFormPunchIn(record.punchIn ? new Date(record.punchIn).toISOString().slice(0, 16) : "");
    setFormPunchOut(record.punchOut ? new Date(record.punchOut).toISOString().slice(0, 16) : "");
    setFormStatus(record.status);
    setFormNote("");
    setEditAttendanceOpen(true);
  }

  function openPayrollConfig() {
    const d = employeePayrollFlagsQuery.data;
    setFormSalaryStructureId(d?.salaryStructureId || "__none__");
    setFormPfExempt(d?.pfExempt || false);
    setFormPtState(d?.ptState || "__none__");
    setFormEsiApplicable(d?.esiApplicable ?? true);
    setFormEsiDisability(d?.esiDisability || false);
    setFormEsiDailyWageExempt(d?.esiDailyWageExempt || false);
    setFormPayrollNote("");
    setPayrollConfigOpen(true);
  }

  function openEditProfile() {
    const user = detailsQuery.data?.user;
    if (!user) return;
    setFormDesignation(user.designation || "");
    setFormDepartmentId(user.departmentId || "");
    setFormHierarchyLevel(user.hierarchyLevel || "");
    setFormGender((user as any).gender || "");
    setFormEmploymentType((user as any).employmentType || "");
    setFormAttendanceExempt((user as any).attendanceExempt ?? false);
    setFormTrainingExempt((user as any).trainingExempt ?? false);
    setFormMaternityLeaveEligible((user as any).maternityLeaveEligible ?? false);
    setFormEmployeeCategory(user.employeeCategory || "experienced");
    setFormNote("");
    setEditProfileOpen(true);
  }

  function openEditContact(contact: EmergencyContact) {
    setEditContactRecord(contact);
    setFormContactName(contact.name);
    setFormContactRelationship(contact.relationship);
    setFormContactPhone(contact.phone);
    setFormContactEmail(contact.email || "");
    setFormContactAddress(contact.address || "");
    setFormContactIsPrimary(contact.isPrimary);
    setFormNote("");
    setEditContactOpen(true);
  }

  function openReviewTicket(ticket: TicketRecord) {
    setReviewTicketRecord(ticket);
    setFormTicketStatus("");
    setFormTicketComment("");
    setFormNote("");
    setReviewTicketOpen(true);
  }

  const filteredMembers = (membersQuery.data || []).filter(m => {
    const term = searchTerm.toLowerCase();
    return (
      m.firstName.toLowerCase().includes(term) ||
      m.lastName.toLowerCase().includes(term) ||
      m.email.toLowerCase().includes(term) ||
      (m.employeeId || "").toLowerCase().includes(term)
    );
  });

  if (selectedUserId) {
    return (
      <AdminLayout>
        <EmployeeDetailView
          userId={selectedUserId}
          onBack={() => setSelectedUserId(null)}
          onEditProfile={openEditProfile}
          onEditPayroll={canEditPayroll ? openPayrollConfig : undefined}
          onEditAttendance={openEditAttendance}
          onAddHoliday={() => { setFormNote(""); setFormHolidayId(""); setAddHolidayOpen(true); }}
          onRemoveHoliday={(selectionId, note) => removeHolidayMutation.mutate({ selectionId, note })}
          onAddContact={() => { resetForm(); setAddContactOpen(true); }}
          onEditContact={openEditContact}
          onDeleteContact={(contactId, note) => deleteContactMutation.mutate({ contactId, note })}
          onReviewTicket={openReviewTicket}
        />

        <Dialog open={editAttendanceOpen} onOpenChange={setEditAttendanceOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Attendance - {editAttendanceRecord?.date}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Punch In</label>
                <Input data-testid="input-punch-in" type="datetime-local" value={formPunchIn} onChange={e => setFormPunchIn(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Punch Out</label>
                <Input data-testid="input-punch-out" type="datetime-local" value={formPunchOut} onChange={e => setFormPunchOut(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Reason for change *</label>
                <Textarea data-testid="input-reason" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Why are you making this change?" />
                {!formNote.trim() && <p className="text-sm text-red-500 mt-1">Required</p>}
              </div>
            </div>
            <DialogFooter>
              <Button data-testid="button-cancel-attendance" variant="outline" onClick={() => setEditAttendanceOpen(false)}>Cancel</Button>
              <Button
                data-testid="button-save-attendance"
                disabled={!formNote.trim() || editAttendanceMutation.isPending}
                onClick={() => {
                  editAttendanceMutation.mutate({
                    punchIn: formPunchIn || undefined,
                    punchOut: formPunchOut || undefined,
                    status: formStatus || undefined,
                    note: formNote,
                  });
                }}
              >
                {editAttendanceMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Designation</label>
                <Input data-testid="input-designation" value={formDesignation} onChange={e => setFormDesignation(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Department</label>
                <Select value={formDepartmentId} onValueChange={setFormDepartmentId}>
                  <SelectTrigger data-testid="select-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {(departmentsQuery.data || []).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Hierarchy Level</label>
                <Select value={formHierarchyLevel} onValueChange={setFormHierarchyLevel}>
                  <SelectTrigger data-testid="select-hierarchy">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ceo">CEO</SelectItem>
                    <SelectItem value="vp">VP</SelectItem>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="team_lead">Team Lead</SelectItem>
                    <SelectItem value="delivery_manager">Delivery Manager</SelectItem>
                    <SelectItem value="team_member">Team Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Gender</label>
                <Select value={formGender} onValueChange={v => {
                  setFormGender(v);
                  if (v === "Female") setFormMaternityLeaveEligible(true);
                }}>
                  <SelectTrigger data-testid="select-profile-gender">
                    <SelectValue placeholder="Select gender..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Employment Type</label>
                <Select value={formEmploymentType} onValueChange={setFormEmploymentType}>
                  <SelectTrigger data-testid="select-profile-employment-type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time / Regular">Full-time / Regular</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Employee Category</label>
                <Select value={formEmployeeCategory} onValueChange={setFormEmployeeCategory}>
                  <SelectTrigger data-testid="select-profile-employee-category">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="experienced">Experienced</SelectItem>
                    <SelectItem value="fresher">Fresher</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="border rounded-lg p-3 space-y-3">
                <label className="text-sm font-medium">Exemption Flags</label>
                <div className="flex items-center justify-between" data-testid="check-profile-attendance-exempt">
                  <div>
                    <p className="text-sm font-medium">Attendance Exempt</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Exempt from punch in/out requirements.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formAttendanceExempt}
                    onClick={() => setFormAttendanceExempt(v => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${formAttendanceExempt ? "bg-primary" : "bg-input"}`}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${formAttendanceExempt ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between" data-testid="check-profile-training-exempt">
                  <div>
                    <p className="text-sm font-medium">Training Exempt</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Exempt from training compliance lock.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formTrainingExempt}
                    onClick={() => setFormTrainingExempt(v => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${formTrainingExempt ? "bg-primary" : "bg-input"}`}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${formTrainingExempt ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between" data-testid="check-profile-maternity-eligible">
                  <div>
                    <p className="text-sm font-medium">Maternity Leave Eligible</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Can apply for maternity leave.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formMaternityLeaveEligible}
                    onClick={() => setFormMaternityLeaveEligible(v => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${formMaternityLeaveEligible ? "bg-primary" : "bg-input"}`}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${formMaternityLeaveEligible ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Reason for change *</label>
                <Textarea data-testid="input-profile-reason" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Why are you making this change?" />
                {!formNote.trim() && <p className="text-sm text-red-500 mt-1">Required</p>}
              </div>
            </div>
            <DialogFooter>
              <Button data-testid="button-cancel-profile" variant="outline" onClick={() => setEditProfileOpen(false)}>Cancel</Button>
              <Button
                data-testid="button-save-profile"
                disabled={!formNote.trim() || editProfileMutation.isPending}
                onClick={() => {
                  editProfileMutation.mutate({
                    designation: formDesignation || undefined,
                    departmentId: formDepartmentId || undefined,
                    hierarchyLevel: formHierarchyLevel || undefined,
                    gender: formGender || undefined,
                    employmentType: formEmploymentType || undefined,
                    employeeCategory: formEmployeeCategory || undefined,
                    attendanceExempt: formAttendanceExempt,
                    trainingExempt: formTrainingExempt,
                    maternityLeaveEligible: formMaternityLeaveEligible,
                    note: formNote,
                  });
                }}
              >
                {editProfileMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={payrollConfigOpen} onOpenChange={setPayrollConfigOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Payroll Configuration</DialogTitle>
              <DialogDescription>Assign a salary structure and configure statutory flags for this employee.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Salary Structure</label>
                <Select value={formSalaryStructureId} onValueChange={setFormSalaryStructureId}>
                  <SelectTrigger data-testid="select-salary-structure">
                    <SelectValue placeholder="Select a structure" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Unassigned —</SelectItem>
                    {(structuresQuery.data || []).filter(s => s.isActive).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">PT State</label>
                <Select value={formPtState} onValueChange={setFormPtState}>
                  <SelectTrigger data-testid="select-pt-state">
                    <SelectValue placeholder="Select state for Professional Tax" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {INDIA_PT_STATES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" data-testid="checkbox-pf-exempt" checked={formPfExempt} onChange={e => setFormPfExempt(e.target.checked)} className="rounded" />
                  <span className="text-sm">PF Exempt</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" data-testid="checkbox-esi-applicable" checked={formEsiApplicable} onChange={e => setFormEsiApplicable(e.target.checked)} className="rounded" />
                  <span className="text-sm">ESI Applicable</span>
                </label>
                {formEsiApplicable && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" data-testid="checkbox-esi-disability" checked={formEsiDisability} onChange={e => setFormEsiDisability(e.target.checked)} className="rounded" />
                      <span className="text-sm">ESI Disability</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" data-testid="checkbox-esi-daily-wage" checked={formEsiDailyWageExempt} onChange={e => setFormEsiDailyWageExempt(e.target.checked)} className="rounded" />
                      <span className="text-sm">ESI Daily Wage Exempt</span>
                    </label>
                  </>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Reason *</label>
                <Textarea data-testid="input-payroll-note" value={formPayrollNote} onChange={e => setFormPayrollNote(e.target.value)} placeholder="Why are you updating this configuration?" />
                {!formPayrollNote.trim() && <p className="text-sm text-red-500 mt-1">Required</p>}
              </div>
            </div>
            <DialogFooter>
              <Button data-testid="button-cancel-payroll" variant="outline" onClick={() => setPayrollConfigOpen(false)}>Cancel</Button>
              <Button
                data-testid="button-save-payroll"
                disabled={!formPayrollNote.trim() || payrollFlagsMutation.isPending}
                onClick={() => payrollFlagsMutation.mutate({
                  salaryStructureId: formSalaryStructureId === "__none__" ? null : formSalaryStructureId,
                  pfExempt: formPfExempt,
                  esiApplicable: formEsiApplicable,
                  esiDisability: formEsiDisability,
                  esiDailyWageExempt: formEsiDailyWageExempt,
                  ptState: formPtState === "__none__" ? null : formPtState,
                  note: formPayrollNote,
                })}
              >
                {payrollFlagsMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addHolidayOpen} onOpenChange={setAddHolidayOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Regional Holiday</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Regional Holiday</label>
                <Select value={formHolidayId} onValueChange={setFormHolidayId}>
                  <SelectTrigger data-testid="select-holiday">
                    <SelectValue placeholder="Select a regional holiday" />
                  </SelectTrigger>
                  <SelectContent>
                    {(holidaysQuery.data || [])
                      .filter(h => h.type === "regional")
                      .map(h => (
                        <SelectItem key={h.id} value={h.id}>{h.name} ({h.date})</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Reason *</label>
                <Textarea data-testid="input-holiday-reason" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Why are you adding this holiday?" />
                {!formNote.trim() && <p className="text-sm text-red-500 mt-1">Required</p>}
              </div>
            </div>
            <DialogFooter>
              <Button data-testid="button-cancel-holiday" variant="outline" onClick={() => setAddHolidayOpen(false)}>Cancel</Button>
              <Button
                data-testid="button-save-holiday"
                disabled={!formNote.trim() || !formHolidayId || addHolidayMutation.isPending}
                onClick={() => addHolidayMutation.mutate({ holidayId: formHolidayId, note: formNote })}
              >
                {addHolidayMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Emergency Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input data-testid="input-contact-name" value={formContactName} onChange={e => setFormContactName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Relationship *</label>
                <Input data-testid="input-contact-relationship" value={formContactRelationship} onChange={e => setFormContactRelationship(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Phone *</label>
                <Input data-testid="input-contact-phone" value={formContactPhone} onChange={e => setFormContactPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input data-testid="input-contact-email" value={formContactEmail} onChange={e => setFormContactEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Address</label>
                <Textarea data-testid="input-contact-address" value={formContactAddress} onChange={e => setFormContactAddress(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Reason *</label>
                <Textarea data-testid="input-contact-reason" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Why are you adding this contact?" />
                {!formNote.trim() && <p className="text-sm text-red-500 mt-1">Required</p>}
              </div>
            </div>
            <DialogFooter>
              <Button data-testid="button-cancel-add-contact" variant="outline" onClick={() => setAddContactOpen(false)}>Cancel</Button>
              <Button
                data-testid="button-save-add-contact"
                disabled={!formNote.trim() || !formContactName || !formContactRelationship || !formContactPhone || addContactMutation.isPending}
                onClick={() => addContactMutation.mutate({
                  name: formContactName,
                  relationship: formContactRelationship,
                  phone: formContactPhone,
                  email: formContactEmail || undefined,
                  address: formContactAddress || undefined,
                  isPrimary: formContactIsPrimary,
                  note: formNote,
                })}
              >
                {addContactMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editContactOpen} onOpenChange={setEditContactOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Emergency Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input data-testid="input-edit-contact-name" value={formContactName} onChange={e => setFormContactName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Relationship *</label>
                <Input data-testid="input-edit-contact-relationship" value={formContactRelationship} onChange={e => setFormContactRelationship(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Phone *</label>
                <Input data-testid="input-edit-contact-phone" value={formContactPhone} onChange={e => setFormContactPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input data-testid="input-edit-contact-email" value={formContactEmail} onChange={e => setFormContactEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Address</label>
                <Textarea data-testid="input-edit-contact-address" value={formContactAddress} onChange={e => setFormContactAddress(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Reason *</label>
                <Textarea data-testid="input-edit-contact-reason" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Why are you editing this contact?" />
                {!formNote.trim() && <p className="text-sm text-red-500 mt-1">Required</p>}
              </div>
            </div>
            <DialogFooter>
              <Button data-testid="button-cancel-edit-contact" variant="outline" onClick={() => setEditContactOpen(false)}>Cancel</Button>
              <Button
                data-testid="button-save-edit-contact"
                disabled={!formNote.trim() || !formContactName || !formContactRelationship || !formContactPhone || editContactMutation.isPending}
                onClick={() => editContactMutation.mutate({
                  name: formContactName,
                  relationship: formContactRelationship,
                  phone: formContactPhone,
                  email: formContactEmail || undefined,
                  address: formContactAddress || undefined,
                  isPrimary: formContactIsPrimary,
                  note: formNote,
                })}
              >
                {editContactMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={reviewTicketOpen} onOpenChange={setReviewTicketOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Ticket</DialogTitle>
            </DialogHeader>
            {reviewTicketRecord && (
              <div className="space-y-4">
                <div className="bg-muted p-3 rounded text-sm">
                  <p><strong>Date:</strong> {reviewTicketRecord.date}</p>
                  <p><strong>Type:</strong> {reviewTicketRecord.type}</p>
                  <p><strong>Reason:</strong> {reviewTicketRecord.reason}</p>
                  {reviewTicketRecord.requestedPunchIn && (
                    <p><strong>Requested Punch In:</strong> {new Date(reviewTicketRecord.requestedPunchIn).toLocaleString()}</p>
                  )}
                  {reviewTicketRecord.requestedPunchOut && (
                    <p><strong>Requested Punch Out:</strong> {new Date(reviewTicketRecord.requestedPunchOut).toLocaleString()}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Decision</label>
                  <Select value={formTicketStatus} onValueChange={setFormTicketStatus}>
                    <SelectTrigger data-testid="select-ticket-status">
                      <SelectValue placeholder="Select decision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="resolved">Resolve</SelectItem>
                      <SelectItem value="rejected">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Review Comment</label>
                  <Textarea data-testid="input-ticket-comment" value={formTicketComment} onChange={e => setFormTicketComment(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Reason for action *</label>
                  <Textarea data-testid="input-ticket-reason" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Why are you taking this action?" />
                  {!formNote.trim() && <p className="text-sm text-red-500 mt-1">Required</p>}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button data-testid="button-cancel-ticket" variant="outline" onClick={() => setReviewTicketOpen(false)}>Cancel</Button>
              <Button
                data-testid="button-save-ticket"
                disabled={!formNote.trim() || !formTicketStatus || reviewTicketMutation.isPending}
                onClick={() => reviewTicketMutation.mutate({
                  status: formTicketStatus,
                  reviewComment: formTicketComment || undefined,
                  note: formNote,
                })}
              >
                {reviewTicketMutation.isPending ? "Saving..." : "Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Users className="h-6 w-6" />
              My Team
            </h1>
            <p className="text-muted-foreground mt-1">View and manage employee data for your team members</p>
          </div>
        </div>

        <Tabs value={pageTab} onValueChange={v => setPageTab(v as any)}>
          <TabsList data-testid="tabs-page-level">
            <TabsTrigger value="team" data-testid="tab-team">
              <Users className="h-4 w-4 mr-1.5" />
              Team
            </TabsTrigger>
            <TabsTrigger value="corrections" data-testid="tab-corrections">
              <ClipboardList className="h-4 w-4 mr-1.5" />
              Corrections
              {pendingCorrectionsCount > 0 && (
                <span className="ml-1.5 rounded-full bg-orange-500 text-white px-1.5 py-0.5 text-xs font-medium" data-testid="badge-corrections-count">
                  {pendingCorrectionsCount > 9 ? "9+" : pendingCorrectionsCount}
                </span>
              )}
            </TabsTrigger>
            {(activePlansQuery.isLoading || (activePlansQuery.data?.length ?? 0) > 0) && (
              <TabsTrigger value="plans" data-testid="tab-plans">
                <Activity className="h-4 w-4 mr-1.5" />
                Plans
                {(activePlansQuery.data?.length ?? 0) > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-xs font-medium">
                    {activePlansQuery.data!.length}
                  </span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="ceipal" data-testid="tab-ceipal-compliance">
              <ShieldCheck className="h-4 w-4 mr-1.5" />
              Ceipal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="mt-4 space-y-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="input-search"
                placeholder="Search by name, email, or employee ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {pendingCorrectionsCount > 0 && (
              <button
                type="button"
                onClick={() => setPageTab("corrections")}
                className="w-full flex items-center gap-2 text-sm text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg p-3 hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors text-left"
                data-testid="banner-go-to-corrections"
              >
                <ClipboardList className="h-4 w-4 shrink-0" />
                <span>
                  <span className="font-semibold">{pendingCorrectionsCount}</span> pending attendance{" "}
                  {pendingCorrectionsCount === 1 ? "correction" : "corrections"} awaiting your review
                </span>
                <span className="ml-auto font-medium">Go to Corrections →</span>
              </button>
            )}

            {membersQuery.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {searchTerm ? "No team members match your search" : "No team members found"}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMembers.map(member => (
                  <Card
                    key={member.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    data-testid={`card-member-${member.id}`}
                    onClick={() => setSelectedUserId(member.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" data-testid={`text-member-name-${member.id}`}>
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                        </div>
                        <Badge variant={member.isActive ? "default" : "secondary"} className="shrink-0">
                          {member.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {member.designation && <span>{member.designation}</span>}
                        {member.departmentName && <span>| {member.departmentName}</span>}
                        {member.employeeId && <span>| {member.employeeId}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="corrections" className="mt-4 space-y-6">
            <RegularizationsPanel />
          </TabsContent>

          <TabsContent value="plans" className="mt-4">
            <TeamPlansTab teamMembers={membersQuery.data || []} />
          </TabsContent>

          <TabsContent value="ceipal" className="mt-4">
            <CeipalTeamComplianceView />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

// ── Ceipal Team Compliance View ──────────────────────────────────────────────

interface CeipalMemberSummary {
  userId: string;
  name: string;
  email: string;
  promptEnabled: boolean;
  workingDays: number;
  confirmedDays: number;
  missedDays: number;
  rate: number;
  flagged: boolean;
  recentLogs: Array<{ date: string; status: string }>;
}

interface CeipalTeamData {
  members: CeipalMemberSummary[];
  summary?: { total: number; avgRate: number; belowThreshold: number; exempted: number };
  avgRate?: number;
  belowThreshold?: number;
  totalRecruiters?: number;
}

const CEIPAL_DOT_COLORS: Record<string, string> = {
  confirmed: "bg-green-500",
  confirmed_unverified: "bg-blue-400",
  confirmed_no_evidence: "bg-amber-400",
  deferred: "bg-amber-500",
  skipped: "bg-gray-400",
};

function CeipalTeamComplianceView() {
  const { data, isLoading } = useQuery<CeipalTeamData>({
    queryKey: ["/api/ceipal/team-compliance"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  const members = data?.members ?? [];
  const avgRate = data?.summary?.avgRate ?? data?.avgRate ?? 0;
  const belowThreshold = data?.summary?.belowThreshold ?? data?.belowThreshold ?? 0;

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No recruiters on your team, or none have the Ceipal check-in enabled.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="ceipal-team-compliance-view">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Team Avg Rate</p>
            <p className={`text-2xl font-bold mt-1 ${avgRate >= 80 ? "text-green-600 dark:text-green-400" : avgRate >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{avgRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Recruiters</p>
            <p className="text-2xl font-bold mt-1">{members.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Below 70%</p>
            <p className={`text-2xl font-bold mt-1 ${belowThreshold > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{belowThreshold}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {members.map(member => {
              const rateColor = member.rate >= 80 ? "text-green-600 dark:text-green-400"
                : member.rate >= 60 ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400";
              return (
                <div key={member.userId} className="flex items-center gap-4 px-4 py-3" data-testid={`ceipal-row-${member.userId}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                    {!member.promptEnabled && (
                      <Badge variant="secondary" className="text-xs mt-0.5">Checkpoint off</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {member.recentLogs.slice(-7).map((log, idx) => (
                      <div
                        key={idx}
                        className={`h-2.5 w-2.5 rounded-full ${CEIPAL_DOT_COLORS[log.status] ?? "bg-gray-300"}`}
                        title={`${log.date}: ${log.status}`}
                      />
                    ))}
                  </div>
                  <div className={`text-sm font-semibold w-10 text-right shrink-0 ${member.promptEnabled ? rateColor : "text-muted-foreground"}`}>
                    {member.promptEnabled ? `${member.rate}%` : "—"}
                  </div>
                  {member.flagged && (
                    <Badge variant="destructive" className="text-xs shrink-0">5+ misses</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Dots = last 7 days. Green: confirmed, blue: logged (API unavailable), amber: pending or no evidence, grey: skipped.
        Members with 2+ consecutive misses trigger a manager notification. 5+ misses in 30 days shows a flag.
      </p>
    </div>
  );
}
