import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, ChevronLeft, ChevronRight, Download, X, ArrowLeft, Coffee, UtensilsCrossed, Pencil, AlertTriangle, CheckCircle, ThumbsUp } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string | null;
  departmentId: string | null;
  shiftName: string | null;
  expectedStart: string | null;
  attendanceExempt?: boolean;
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
  isCorrect?: boolean;
  correctionNote?: string | null;
  correctedByName?: string | null;
  updatedAt?: string | null;
}

interface TeamAttendanceResponse {
  members: TeamMember[];
  attendance: AttendanceRecord[];
  noTeamAssigned?: boolean;
}

interface MemberAttendanceResponse {
  member: TeamMember | null;
  attendance: AttendanceRecord[];
}

interface TeamBreakStatus {
  [userId: string]: {
    activeBreak: { breakType: "lunch" | "tea"; startedAt: string } | null;
    totalMinutes: number;
  };
}

const statusColors: Record<string, string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  absent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  on_lunch: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  on_tea: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  half_day: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  short_day: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  late: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  on_leave: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  holiday: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  weekend: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const statusDotColors: Record<string, string> = {
  present: "bg-green-500",
  absent: "bg-red-500",
  half_day: "bg-yellow-500",
  short_day: "bg-amber-500",
  late: "bg-orange-500",
  on_leave: "bg-blue-500",
  holiday: "bg-purple-500",
  weekend: "bg-gray-400",
  corrected: "bg-amber-500",
};

const statusLabels: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half Day",
  short_day: "Short Day",
  late: "Late",
  on_leave: "On Leave",
  holiday: "Holiday",
  weekend: "Weekend",
  on_lunch: "On Lunch",
  on_tea: "Tea Break",
  corrected: "Corrected",
};

interface AttendanceException {
  id: string;
  attendanceDate: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  exceptionType: string;
  status: string;
  workedHours: number;
  standardHours: number;
  shortfall: number;
  managerComment: string | null;
  resolverName: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export default function TeamAttendance({ view }: { view?: "attendance" | "exceptions" | "overtime" } = {}) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const currentView: "attendance" | "exceptions" | "overtime" =
    view ?? (activeTab === "exceptions" ? "exceptions" : activeTab === "overtime" ? "overtime" : "attendance");
  // When embedded (view set), only the attendance view shows the date header + summary cards.
  const showHeader = view ? view === "attendance" : true;
  const tabsValue = view ? (view === "attendance" ? "overview" : view) : activeTab;
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberMonth, setMemberMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [downloadMonth, setDownloadMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showDownload, setShowDownload] = useState(false);
  const [excStatusFilter, setExcStatusFilter] = useState("all");
  const [resolvingExc, setResolvingExc] = useState<AttendanceException | null>(null);
  const [resolveForm, setResolveForm] = useState({ disposition: "approved_exception", comment: "" });

  const { data, isLoading } = useQuery<TeamAttendanceResponse>({
    queryKey: ["/api/hr/attendance/my-team", { date: selectedDate }],
    enabled: isAuthenticated && showHeader,
  });

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const { data: teamBreakStatus } = useQuery<TeamBreakStatus>({
    queryKey: ["/api/hr/attendance/breaks/team-status"],
    enabled: isAuthenticated && isToday && showHeader,
    refetchInterval: 30000,
  });

  const [mYear, mMonth] = memberMonth.split("-").map(Number);
  const mLastDay = new Date(mYear, mMonth, 0).getDate();
  const memberStartDate = `${memberMonth}-01`;
  const memberEndDate = `${memberMonth}-${mLastDay}`;

  const { data: memberData, isLoading: memberLoading } = useQuery<MemberAttendanceResponse>({
    queryKey: ["/api/hr/attendance/member", selectedMember?.id, "range", { startDate: memberStartDate, endDate: memberEndDate }],
    queryFn: async () => {
      const res = await fetch(`/api/hr/attendance/member/${selectedMember!.id}/range?startDate=${memberStartDate}&endDate=${memberEndDate}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isAuthenticated && !!selectedMember,
  });

  const { data: excCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/attendance/exceptions/count"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/attendance/exceptions/count", { credentials: "include" });
        if (!res.ok) return { count: 0 };
        return res.json();
      } catch { return { count: 0 }; }
    },
    refetchInterval: 60000,
    enabled: isAuthenticated,
  });
  const pendingExcCount = excCountData?.count ?? 0;

  const excQueryParams = new URLSearchParams();
  if (excStatusFilter !== "all") excQueryParams.set("status", excStatusFilter);
  const { data: exceptions, isLoading: excLoading } = useQuery<AttendanceException[]>({
    queryKey: ["/api/attendance/exceptions", excStatusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/attendance/exceptions?${excQueryParams}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && currentView === "exceptions",
  });

  const { data: overtimeAlerts } = useQuery<Array<{ id: string; message: string; metadata: any; createdAt: string; isRead: boolean }>>({
    queryKey: ["/api/attendance/overtime-alerts"],
    queryFn: async () => {
      const res = await fetch("/api/attendance/overtime-alerts", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60000,
    enabled: isAuthenticated && currentView === "overtime",
  });

  const [praisingAlert, setPraisingAlert] = useState<{ id: string; employeeId: string; employeeName: string } | null>(null);
  const [praiseNote, setPraiseNote] = useState("");

  const resolveMutation = useMutation({
    mutationFn: async ({ id, disposition, comment }: { id: string; disposition: string; comment: string }) => {
      const res = await apiRequest("POST", `/api/attendance/exceptions/${id}/resolve`, { disposition, comment });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error || "Failed to resolve");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/exceptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/exceptions/count"] });
      setResolvingExc(null);
      setResolveForm({ disposition: "approved_exception", comment: "" });
      toast({ title: "Resolved", description: "Exception resolved." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const praiseMutation = useMutation({
    mutationFn: async ({ employeeId, praiseNote, notificationId }: { employeeId: string; praiseNote: string; notificationId: string }) => {
      const res = await apiRequest("POST", "/api/attendance/overtime-alerts/praise", { employeeId, praiseNote, notificationId });
      if (!res.ok) throw new Error("Failed to send praise");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/overtime-alerts"] });
      setPraisingAlert(null);
      setPraiseNote("");
      toast({ title: "Praise Sent!", description: "Your message has been sent to the employee." });
    },
    onError: () => toast({ title: "Error", description: "Failed to send praise", variant: "destructive" }),
  });

  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const canDownload = user && ["super_admin", "admin", "hr", "manager", "operations"].includes(user.role);
  const canCorrect = user && ["super_admin", "admin", "hr", "manager"].includes(user.role);

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (hours: string | null) => {
    if (!hours) return "-";
    const h = parseFloat(hours);
    const wholeHours = Math.floor(h);
    const minutes = Math.round((h - wholeHours) * 60);
    if (wholeHours === 0 && minutes === 0) return "-";
    if (wholeHours === 0) return `${minutes}m`;
    if (minutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h ${minutes}m`;
  };

  const getEffectiveStatus = (att: AttendanceRecord | undefined, userId?: string) => {
    if (!att) return "absent";
    if (att.status === "on_leave" || att.status === "holiday") return att.status;
    if (att.punchIn && att.punchOut && att.totalHours) {
      const hours = parseFloat(att.totalHours);
      return hours >= 8 ? "present" : "absent";
    }
    if (att.punchIn && !att.punchOut) {
      if (userId && teamBreakStatus?.[userId]?.activeBreak) {
        const breakType = teamBreakStatus[userId].activeBreak!.breakType;
        return breakType === "lunch" ? "on_lunch" : "on_tea";
      }
      return "working";
    }
    return att.status || "absent";
  };

  const todayStr = new Date().toISOString().split("T")[0];

  const members = data?.members || [];
  const attendanceRecords = data?.attendance || [];
  const getMemberAttendance = (id: string) => attendanceRecords.find(a => a.userId === id);

  const nonExemptMembers = members.filter(m => !m.attendanceExempt);
  const presentCount = nonExemptMembers.filter(m => {
    const eff = getEffectiveStatus(getMemberAttendance(m.id), m.id);
    return eff === "present" || eff === "working" || eff === "on_lunch" || eff === "on_tea";
  }).length;
  const absentCount = nonExemptMembers.filter(m => {
    const eff = getEffectiveStatus(getMemberAttendance(m.id), m.id);
    return eff === "absent";
  }).length;
  const onLeaveCount = nonExemptMembers.filter(m => {
    const eff = getEffectiveStatus(getMemberAttendance(m.id), m.id);
    return eff === "on_leave";
  }).length;
  const onBreakCount = nonExemptMembers.filter(m => {
    const eff = getEffectiveStatus(getMemberAttendance(m.id), m.id);
    return eff === "on_lunch" || eff === "on_tea";
  }).length;

  const handleDownload = () => {
    const [dy, dm] = downloadMonth.split("-").map(Number);
    const dlDay = new Date(dy, dm, 0).getDate();
    const ds = `${downloadMonth}-01`;
    const de = `${downloadMonth}-${dlDay}`;
    window.open(`/api/hr/attendance/download?startDate=${ds}&endDate=${de}`, "_blank");
    setShowDownload(false);
  };

  const handleMemberClick = (member: TeamMember) => {
    setSelectedMember(member);
    setMemberMonth(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {showHeader && (
        <>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-team-attendance-title">Team Attendance</h1>
            <p className="text-muted-foreground">View your team's attendance records</p>
          </div>
          <div className="flex items-center gap-2">
            {canDownload && (
              <Button variant="outline" size="sm" onClick={() => setShowDownload(true)} data-testid="button-download-report">
                <Download className="h-4 w-4 mr-1" />
                Download Report
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={() => changeDate(-1)} data-testid="button-prev-date">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm bg-background"
              data-testid="input-date-picker"
            />
            <Button variant="outline" size="icon" onClick={() => changeDate(1)} data-testid="button-next-date">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(todayStr)} data-testid="button-today">
              Today
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <span className="text-green-700 dark:text-green-300 font-bold">{presentCount}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Present</p>
                <p className="text-base font-semibold" data-testid="text-present-count">{presentCount} / {nonExemptMembers.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-red-100 dark:bg-red-900 flex items-center justify-center shrink-0">
                <span className="text-red-700 dark:text-red-300 font-bold">{absentCount}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Absent</p>
                <p className="text-base font-semibold" data-testid="text-absent-count">{absentCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                <span className="text-blue-700 dark:text-blue-300 font-bold">{onLeaveCount}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">On Leave</p>
                <p className="text-base font-semibold" data-testid="text-leave-count">{onLeaveCount}</p>
              </div>
            </CardContent>
          </Card>
          {isToday && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                  <span className="text-amber-700 dark:text-amber-300 font-bold">{onBreakCount}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">On Break</p>
                  <p className="text-base font-semibold" data-testid="text-break-count">{onBreakCount}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        </>
        )}

        <Tabs value={tabsValue} onValueChange={setActiveTab} className="w-full">
          {!view && (
          <TabsList className="h-auto flex flex-wrap gap-1 mb-4">
            <TabsTrigger value="overview" data-testid="tab-team-overview">Team Attendance</TabsTrigger>
            <TabsTrigger value="exceptions" data-testid="tab-exception-review">
              Exception Review
              {pendingExcCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                  {pendingExcCount > 99 ? "99+" : pendingExcCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="overtime" data-testid="tab-overtime-alerts">
              Overtime Alerts
            </TabsTrigger>
          </TabsList>
          )}

          {/* Tab 1: Today's Attendance */}
          <TabsContent value="overview">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Attendance for {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : members.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Employee</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Designation</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Shift</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Punch In</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Punch Out</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Duration</th>
                      {isToday && <th className="text-left py-3 px-2 font-medium text-muted-foreground">Break</th>}
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const att = getMemberAttendance(member.id);
                      const effectiveStatus = getEffectiveStatus(att, member.id);
                      const isWorking = effectiveStatus === "working" || effectiveStatus === "on_lunch" || effectiveStatus === "on_tea";
                      const isExempt = member.attendanceExempt === true;
                      return (
                        <tr
                          key={member.id}
                          className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleMemberClick(member)}
                          data-testid={`attendance-row-${member.id}`}
                        >
                          <td className="py-2 px-2">
                            <div>
                              <p className="font-medium text-primary hover:underline">{member.firstName} {member.lastName}</p>
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-muted-foreground">{member.designation || "-"}</td>
                          <td className="py-2 px-2">
                            {member.shiftName ? (
                              <div>
                                <span className="text-xs font-medium" data-testid={`text-shift-name-${member.id}`}>{member.shiftName}</span>
                                {member.expectedStart && (
                                  <p className="text-xs text-muted-foreground">{member.expectedStart.slice(0, 5)}</p>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="py-2 px-2">
                            {isExempt ? <span className="text-muted-foreground text-xs">—</span> : att?.punchIn ? (
                              <span className="text-green-600 dark:text-green-400 font-medium">{formatTime(att.punchIn)}</span>
                            ) : "-"}
                          </td>
                          <td className="py-2 px-2">
                            {isExempt ? <span className="text-muted-foreground text-xs">—</span> : att?.punchOut ? (
                              <span className="text-orange-600 dark:text-orange-400 font-medium">{formatTime(att.punchOut)}</span>
                            ) : isWorking ? (
                              <span className="text-xs text-muted-foreground italic">Working...</span>
                            ) : "-"}
                          </td>
                          <td className="py-2 px-2">
                            {!isExempt && att?.totalHours ? (
                              <span className="font-medium">{formatDuration(att.totalHours)}</span>
                            ) : "-"}
                          </td>
                          {isToday && (
                            <td className="py-2 px-2">
                              {isExempt ? <span className="text-muted-foreground text-xs">—</span> : (() => {
                                const memberBreak = teamBreakStatus?.[member.id];
                                if (!memberBreak) return <span className="text-muted-foreground text-xs">—</span>;
                                const activeBreak = memberBreak.activeBreak;
                                const totalMin = memberBreak.totalMinutes;
                                if (activeBreak) {
                                  const elapsedMin = Math.floor((Date.now() - new Date(activeBreak.startedAt).getTime()) / 60000);
                                  return (
                                    <div className="flex flex-col">
                                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{elapsedMin}m active</span>
                                      {totalMin > 0 && <span className="text-xs text-muted-foreground">{Math.round(totalMin)}m total</span>}
                                    </div>
                                  );
                                }
                                if (totalMin > 0) return <span className="text-xs text-muted-foreground">{Math.round(totalMin)}m taken</span>;
                                return <span className="text-muted-foreground text-xs">—</span>;
                              })()}
                            </td>
                          )}
                          <td className="py-2 px-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1">
                              {isExempt ? (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" data-testid={`badge-exempt-${member.id}`}>
                                  Exempt
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className={statusColors[effectiveStatus === "working" ? "present" : effectiveStatus] || ""}>
                                  {effectiveStatus === "working" && "Working"}
                                  {effectiveStatus === "on_lunch" && <span className="flex items-center gap-1"><UtensilsCrossed className="h-3 w-3" /> On Lunch</span>}
                                  {effectiveStatus === "on_tea" && <span className="flex items-center gap-1"><Coffee className="h-3 w-3" /> Tea Break</span>}
                                  {effectiveStatus !== "working" && effectiveStatus !== "on_lunch" && effectiveStatus !== "on_tea" && (statusLabels[effectiveStatus] || effectiveStatus)}
                                </Badge>
                              )}
                              {att?.isCorrect && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]" data-testid={`badge-corrected-${member.id}`}>
                                  Corrected
                                </Badge>
                              )}
                              </div>
                              {!isExempt && isToday && effectiveStatus === "absent" && member.expectedStart && !att?.punchIn && (() => {
                                const [h, m] = member.expectedStart.split(":").map(Number);
                                const expectedMins = h * 60 + m;
                                const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
                                if (nowMins > expectedMins) {
                                  const hr12 = h % 12 || 12;
                                  const period = h >= 12 ? "PM" : "AM";
                                  return (
                                    <p className="text-xs text-amber-600 dark:text-amber-400" data-testid={`text-expected-at-${member.id}`}>
                                      Expected at {hr12}:{String(m).padStart(2,"0")} {period}
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                {data?.noTeamAssigned ? (
                  <>
                    <p className="text-muted-foreground" data-testid="text-no-team-assigned">No direct reports assigned</p>
                    <p className="text-xs text-muted-foreground mt-1">Ask an admin to assign employees to your team to see their attendance here</p>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground" data-testid="text-no-members">No team members found</p>
                    <p className="text-xs text-muted-foreground mt-1">No active employees are registered in the system</p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* Tab 2: Exception Review */}
          <TabsContent value="exceptions" className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">Status:</span>
              <Select value={excStatusFilter} onValueChange={setExcStatusFilter}>
                <SelectTrigger className="w-44 h-8 text-sm" data-testid="select-exc-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved_exception">Exception Approved</SelectItem>
                  <SelectItem value="marked_half_day">Marked Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card>
              <CardContent className="p-0">
                {excLoading ? (
                  <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : !exceptions || exceptions.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-10 w-10 mx-auto text-green-400 mb-3" />
                    <p className="text-muted-foreground font-medium">No exceptions in your team</p>
                    <p className="text-xs text-muted-foreground mt-1">Short-day exceptions will appear here for review</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-3 px-3 font-medium text-muted-foreground">Employee</th>
                          <th className="text-left py-3 px-3 font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-3 px-3 font-medium text-muted-foreground">Hours / Shortfall</th>
                          <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                          <th className="text-left py-3 px-3 font-medium text-muted-foreground">Comment</th>
                          <th className="text-right py-3 px-3 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exceptions.map(exc => (
                          <tr key={exc.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`exc-row-${exc.id}`}>
                            <td className="py-2.5 px-3">
                              <p className="font-medium">{exc.employeeName}</p>
                              <p className="text-xs text-muted-foreground">{exc.departmentName || "—"}</p>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{exc.attendanceDate}</td>
                            <td className="py-2.5 px-3">
                              <p className="font-medium">{exc.workedHours.toFixed(1)}h</p>
                              <p className="text-xs text-red-600">−{exc.shortfall.toFixed(1)}h short</p>
                            </td>
                            <td className="py-2.5 px-3">
                              {exc.status === "pending" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Pending</Badge>}
                              {exc.status === "approved_exception" && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Approved</Badge>}
                              {exc.status === "marked_half_day" && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Half Day</Badge>}
                            </td>
                            <td className="py-2.5 px-3 text-xs text-muted-foreground">
                              <div className="max-w-44">
                                <p className="truncate">{exc.managerComment || (exc.resolverName ? `Resolved by ${exc.resolverName}` : "—")}</p>
                                {exc.resolvedAt && (
                                  <p className="text-muted-foreground/60">{new Date(exc.resolvedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {exc.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setResolvingExc(exc); setResolveForm({ disposition: "approved_exception", comment: "" }); }}
                                  data-testid={`button-resolve-${exc.id}`}
                                >
                                  Resolve
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Overtime Alerts & Praise */}
          <TabsContent value="overtime">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-blue-500" />
                  Overtime Recognition Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!overtimeAlerts || overtimeAlerts.length === 0 ? (
                  <div className="text-center py-12 px-6">
                    <ThumbsUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground font-medium">No overtime alerts this week</p>
                    <p className="text-xs text-muted-foreground mt-1">When a team member works {`>`}standard hours on 3+ days in a week, you'll see an alert here to recognise their effort.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {overtimeAlerts.map(alert => (
                      <div key={alert.id} className={`p-4 flex items-start justify-between gap-3 ${alert.isRead ? "opacity-60" : ""}`} data-testid={`overtime-alert-${alert.id}`}>
                        <div className="space-y-1 flex-1">
                          <p className="text-sm font-medium">{alert.message}</p>
                          <p className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleDateString()}</p>
                        </div>
                        {!alert.isRead && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-blue-700 border-blue-200 hover:bg-blue-50"
                            onClick={() => {
                              const meta = alert.metadata;
                              setPraisingAlert({ id: alert.id, employeeId: meta?.employeeId, employeeName: meta?.employeeName });
                              setPraiseNote("");
                            }}
                            data-testid={`button-praise-${alert.id}`}
                          >
                            <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                            Send Praise
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-member-calendar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedMember?.firstName} {selectedMember?.lastName} - Monthly Attendance</span>
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <MemberMonthlyCalendar
              member={selectedMember}
              records={memberData?.attendance || []}
              isLoading={memberLoading}
              month={memberMonth}
              onMonthChange={setMemberMonth}
              canCorrect={!!canCorrect}
              memberQueryKey={["/api/hr/attendance/member", selectedMember?.id, "range", { startDate: memberStartDate, endDate: memberEndDate }]}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDownload} onOpenChange={setShowDownload}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-download-report">
          <DialogHeader>
            <DialogTitle>Download Attendance Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Select Month</label>
              <input
                type="month"
                value={downloadMonth}
                onChange={(e) => setDownloadMonth(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-background w-full"
                data-testid="input-download-month"
              />
            </div>
            <Button onClick={handleDownload} className="w-full" data-testid="button-confirm-download">
              <Download className="h-4 w-4 mr-2" />
              Download Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resolve Exception Dialog */}
      <Dialog open={!!resolvingExc} onOpenChange={(open) => { if (!open) setResolvingExc(null); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-resolve-exception">
          <DialogHeader>
            <DialogTitle>Resolve Short-Day Exception</DialogTitle>
          </DialogHeader>
          {resolvingExc && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
                <p><span className="font-medium">Employee:</span> {resolvingExc.employeeName}</p>
                <p><span className="font-medium">Date:</span> {resolvingExc.attendanceDate}</p>
                <p><span className="font-medium">Hours worked:</span> {resolvingExc.workedHours.toFixed(2)}h (shortfall: {resolvingExc.shortfall.toFixed(2)}h)</p>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Resolution</Label>
                <Select value={resolveForm.disposition} onValueChange={(v) => setResolveForm(f => ({ ...f, disposition: v }))}>
                  <SelectTrigger data-testid="select-resolve-disposition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved_exception">Approve as Exception (no leave deduction)</SelectItem>
                    <SelectItem value="marked_half_day">Mark as Half Day (deduct 0.5 leave day)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Manager Comment{resolveForm.disposition === "approved_exception" ? " *" : ""}
                </Label>
                <Textarea
                  rows={3}
                  value={resolveForm.comment}
                  onChange={(e) => setResolveForm(f => ({ ...f, comment: e.target.value }))}
                  placeholder={resolveForm.disposition === "approved_exception" ? "Reason for exception (required)" : "Optional note"}
                  data-testid="textarea-resolve-comment"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolvingExc(null)} data-testid="button-cancel-resolve">Cancel</Button>
            <Button
              onClick={() => {
                if (!resolvingExc) return;
                if (resolveForm.disposition === "approved_exception" && !resolveForm.comment.trim()) {
                  toast({ title: "Comment required", description: "Please provide a reason for the exception.", variant: "destructive" });
                  return;
                }
                resolveMutation.mutate({ id: resolvingExc.id, disposition: resolveForm.disposition, comment: resolveForm.comment });
              }}
              disabled={resolveMutation.isPending}
              data-testid="button-confirm-resolve"
            >
              {resolveMutation.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Praise Modal */}
      <Dialog open={!!praisingAlert} onOpenChange={(open) => { if (!open) setPraisingAlert(null); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-praise">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-blue-500" />
              Send Overtime Praise
            </DialogTitle>
          </DialogHeader>
          {praisingAlert && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Recognise <span className="font-semibold text-foreground">{praisingAlert.employeeName}</span>'s extra effort this week with a personal note.
              </p>
              <div>
                <Label className="text-sm font-medium mb-2 block">Praise Note</Label>
                <Textarea
                  rows={3}
                  value={praiseNote}
                  onChange={(e) => setPraiseNote(e.target.value)}
                  placeholder="e.g. Great effort this week — your dedication made a difference!"
                  data-testid="textarea-praise-note"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPraisingAlert(null)} data-testid="button-cancel-praise">Cancel</Button>
            <Button
              onClick={() => {
                if (!praisingAlert) return;
                praiseMutation.mutate({ employeeId: praisingAlert.employeeId, praiseNote, notificationId: praisingAlert.id });
              }}
              disabled={praiseMutation.isPending}
              data-testid="button-send-praise"
            >
              {praiseMutation.isPending ? "Sending..." : "Send Praise"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function MemberMonthlyCalendar({
  member,
  records,
  isLoading,
  month,
  onMonthChange,
  canCorrect,
  memberQueryKey,
}: {
  member: TeamMember;
  records: AttendanceRecord[];
  isLoading: boolean;
  month: string;
  onMonthChange: (m: string) => void;
  canCorrect: boolean;
  memberQueryKey: unknown[];
}) {
  const { toast } = useToast();
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const firstDayOfWeek = new Date(year, mon - 1, 1).getDay();
  const todayStr = new Date().toISOString().split("T")[0];
  const monthName = new Date(year, mon - 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [editAbsentDate, setEditAbsentDate] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editPunchIn, setEditPunchIn] = useState("");
  const [editPunchOut, setEditPunchOut] = useState("");
  const [editTotalHours, setEditTotalHours] = useState("");
  const [editComment, setEditComment] = useState("");

  const correctMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      userId?: string;
      date?: string;
      punchIn?: string | null;
      punchOut?: string | null;
      totalHours?: string | null;
      correctionComment?: string;
      correctionNote?: string;
    }) => {
      if (payload.id) {
        const { id, ...body } = payload;
        return apiRequest("PATCH", `/api/hr/attendance/${id}`, { ...body, correctionComment: body.correctionComment });
      } else {
        return apiRequest("POST", `/api/hr/attendance/admin-correction`, {
          userId: payload.userId,
          date: payload.date,
          punchIn: payload.punchIn ? payload.punchIn.substring(11, 16) : null,
          punchOut: payload.punchOut ? payload.punchOut.substring(11, 16) : null,
          totalHours: payload.totalHours,
          correctionNote: payload.correctionNote,
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Attendance corrected", description: "The record has been updated and logged." });
      queryClient.invalidateQueries({ queryKey: memberQueryKey });
      setEditRecord(null);
      setEditAbsentDate(null);
      setSelectedDay(null);
    },
    onError: (err: Error) => {
      const message = err?.message || "Failed to update attendance record";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const prevMonth = () => {
    const d = new Date(year, mon - 2, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const d = new Date(year, mon, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const getEffectiveStatus = (record: AttendanceRecord | undefined, isWeekend: boolean) => {
    if (!record) return isWeekend ? "weekend" : "absent";
    if (record.status === "on_leave" || record.status === "holiday") return record.status;
    if (record.punchIn && record.punchOut && record.totalHours) {
      return parseFloat(record.totalHours) >= 8 ? "present" : "absent";
    }
    return record.status || "absent";
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "--:--";
    return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (hours: string | null) => {
    if (!hours) return "-";
    const h = parseFloat(hours);
    const wh = Math.floor(h);
    const mins = Math.round((h - wh) * 60);
    if (wh === 0 && mins === 0) return "-";
    if (wh === 0) return `${mins}m`;
    if (mins === 0) return `${wh}h`;
    return `${wh}h ${mins}m`;
  };

  const toLocalTimeInput = (ts: string | null): string => {
    if (!ts) return "";
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const buildTimestamp = (dateStr: string, timeStr: string): string | null => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date(`${dateStr}T00:00:00`);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const openEdit = (record: AttendanceRecord | null, dateStr: string) => {
    if (record) {
      setEditRecord(record);
      setEditAbsentDate(null);
    } else {
      setEditRecord(null);
      setEditAbsentDate(dateStr);
    }
    setEditDate(dateStr);
    setEditPunchIn(record ? toLocalTimeInput(record.punchIn) : "");
    setEditPunchOut(record ? toLocalTimeInput(record.punchOut) : "");
    setEditTotalHours(record?.totalHours || "");
    setEditComment("");
  };

  const handleSave = () => {
    if (!editComment.trim()) return;
    if (editRecord) {
      correctMutation.mutate({
        id: editRecord.id,
        punchIn: editPunchIn ? buildTimestamp(editDate, editPunchIn) : null,
        punchOut: editPunchOut ? buildTimestamp(editDate, editPunchOut) : null,
        totalHours: editTotalHours || null,
        correctionComment: editComment.trim(),
      });
    } else {
      correctMutation.mutate({
        userId: member.id,
        date: editDate,
        punchIn: editPunchIn ? buildTimestamp(editDate, editPunchIn) : null,
        punchOut: editPunchOut ? buildTimestamp(editDate, editPunchOut) : null,
        totalHours: editTotalHours || null,
        correctionNote: editComment.trim(),
      });
    }
  };

  const allDays = Array.from({ length: lastDay }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${month}-${String(dayNum).padStart(2, "0")}`;
    const dayOfWeek = new Date(year, mon - 1, dayNum).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFuture = dateStr > todayStr;
    const record = records.find(r => r.date === dateStr);
    const status = isFuture ? "" : getEffectiveStatus(record, isWeekend);
    const isRecordCorrected = !!(record?.isCorrect);
    return { dayNum, dateStr, dayOfWeek, isWeekend, isFuture, record, status, isRecordCorrected };
  });

  const totalPresent = allDays.filter(d => d.status === "present").length;
  const totalAbsent = allDays.filter(d => d.status === "absent").length;
  const totalLeave = allDays.filter(d => d.status === "on_leave").length;
  const totalHours = records.reduce((sum, r) => sum + parseFloat(r.totalHours || "0"), 0);

  const [selectedDay, setSelectedDay] = useState<typeof allDays[0] | null>(null);

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">{monthName}</span>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="bg-green-50 dark:bg-green-950 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-green-700 dark:text-green-300">{totalPresent}</p>
          <p className="text-[10px] text-green-600 dark:text-green-400">Present</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-red-700 dark:text-red-300">{totalAbsent}</p>
          <p className="text-[10px] text-red-600 dark:text-red-400">Absent</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{totalLeave}</p>
          <p className="text-[10px] text-blue-600 dark:text-blue-400">On Leave</p>
        </div>
        <div className="bg-muted rounded-lg p-2 text-center">
          <p className="text-lg font-bold">{totalHours.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground">Total Hours</p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={`${d}-${i}`} className="text-center text-xs font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {allDays.map((day) => {
          const isToday = day.dateStr === todayStr;
          const dotColor = day.isRecordCorrected ? "bg-amber-500" : (day.status ? (statusDotColors[day.status] || "") : "");

          return (
            <button
              key={day.dateStr}
              onClick={() => !day.isFuture && setSelectedDay(day)}
              disabled={day.isFuture}
              className={`
                aspect-square rounded-md border flex flex-col items-center justify-center gap-0.5
                text-xs transition-all
                ${day.isFuture ? "opacity-25 cursor-not-allowed" : "cursor-pointer hover:border-primary hover:shadow-sm"}
                ${isToday ? "border-primary border-2 font-bold" : "border-border"}
                ${day.isWeekend && !day.isFuture ? "bg-muted/40" : ""}
                ${selectedDay?.dateStr === day.dateStr ? "ring-2 ring-primary" : ""}
              `}
              data-testid={`member-cal-day-${day.dateStr}`}
            >
              <span className={`text-[11px] ${isToday ? "text-primary" : ""}`}>{day.dayNum}</span>
              {!day.isFuture && dotColor && (
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 pt-2 border-t">
        {Object.entries(statusLabels).filter(([key]) => !["on_lunch", "on_tea", "corrected"].includes(key)).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${statusDotColors[key]}`} />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Corrected
        </div>
      </div>

      {selectedDay && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3" data-testid="member-day-detail">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {new Date(selectedDay.dateStr + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric"
              })}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={statusColors[selectedDay.status] || ""}>
                {statusLabels[selectedDay.status] || selectedDay.status || "N/A"}
              </Badge>
              {selectedDay.isRecordCorrected && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" data-testid="badge-corrected-status">
                  Corrected
                </Badge>
              )}
              {canCorrect && !selectedDay.isWeekend && !selectedDay.isFuture && selectedDay.status !== "on_leave" && selectedDay.status !== "holiday" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(selectedDay.record || null, selectedDay.dateStr)}
                  data-testid="button-correct-attendance"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Correct
                </Button>
              )}
            </div>
          </div>
          {selectedDay.isRecordCorrected && selectedDay.record && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-200" data-testid="banner-corrected-day">
              <span className="font-semibold">Corrected</span>
              {selectedDay.record.correctedByName && ` by ${selectedDay.record.correctedByName}`}
              {selectedDay.record.updatedAt && ` on ${new Date(selectedDay.record.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
              {selectedDay.record.correctionNote && (
                <p className="mt-1 text-amber-700 dark:text-amber-300">{selectedDay.record.correctionNote}</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Punch In</p>
              <p className="text-sm font-medium" data-testid="text-member-punch-in">{formatTime(selectedDay.record?.punchIn || null)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Punch Out</p>
              <p className="text-sm font-medium" data-testid="text-member-punch-out">{formatTime(selectedDay.record?.punchOut || null)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Duration</p>
              <p className="text-sm font-medium" data-testid="text-member-duration">{formatDuration(selectedDay.record?.totalHours || null)}</p>
            </div>
          </div>
          {selectedDay.record?.notes && (
            <p className="text-xs text-muted-foreground border-t pt-2">{selectedDay.record.notes}</p>
          )}
        </div>
      )}

      <Dialog open={!!(editRecord || editAbsentDate)} onOpenChange={(open) => { if (!open) { setEditRecord(null); setEditAbsentDate(null); } }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-correct-attendance">
          <DialogHeader>
            <DialogTitle>Correct Attendance Hours</DialogTitle>
          </DialogHeader>
          {(editRecord || editAbsentDate) && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {editAbsentDate ? "Adding attendance record for " : "Editing record for "}
                <span className="font-medium text-foreground">{member.firstName} {member.lastName}</span> on{" "}
                <span className="font-medium text-foreground">
                  {new Date(editDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </span>
                {editAbsentDate && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">(absent day)</span>
                )}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-punch-in">Punch In</Label>
                  <Input
                    id="edit-punch-in"
                    type="time"
                    value={editPunchIn}
                    onChange={(e) => setEditPunchIn(e.target.value)}
                    data-testid="input-edit-punch-in"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-punch-out">Punch Out</Label>
                  <Input
                    id="edit-punch-out"
                    type="time"
                    value={editPunchOut}
                    onChange={(e) => setEditPunchOut(e.target.value)}
                    data-testid="input-edit-punch-out"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-total-hours">Total Hours (decimal)</Label>
                <Input
                  id="edit-total-hours"
                  type="number"
                  step="0.01"
                  min="0"
                  max="24"
                  placeholder="e.g. 8.5"
                  value={editTotalHours}
                  onChange={(e) => setEditTotalHours(e.target.value)}
                  data-testid="input-edit-total-hours"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-comment">
                  Reason for Correction <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="edit-comment"
                  placeholder="Explain why this record is being corrected..."
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  rows={3}
                  data-testid="textarea-correction-comment"
                />
                {!editComment.trim() && (
                  <p className="text-xs text-muted-foreground">A reason is required before saving.</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditRecord(null); setEditAbsentDate(null); }} data-testid="button-cancel-correction">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!editComment.trim() || correctMutation.isPending}
              data-testid="button-save-correction"
            >
              {correctMutation.isPending ? "Saving..." : "Save Correction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
