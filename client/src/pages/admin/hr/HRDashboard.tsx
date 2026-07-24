import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Clock,
  CalendarDays,
  CalendarCheck,
  TrendingUp,
  LogIn,
  LogOut as LogOutIcon,
  Globe,
  Lock,
  Check,
  GraduationCap,
  AlertTriangle,
  Users,
  FileCheck,
  Coffee,
  Sun,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatCard } from "@/components/ui/stat-card";
import { LeaveBalanceCard } from "@/components/hr/leave-balance-card";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BreakWidget } from "@/components/admin/BreakWidget";
import { usePendingRegularizationCount } from "@/hooks/use-pending-regularizations";
import PendingSopAuditsCard from "@/components/admin/sops/PendingSopAuditsCard";
import GovernanceObligationsCard from "@/components/admin/governance/GovernanceObligationsCard";
import { SopComplianceWidgetEmployee, SopComplianceWidgetManager } from "@/components/admin/SopComplianceWidget";

interface DashboardStats {
  todayStatus: "not_punched" | "punched_in" | "completed";
  punchInTime: string | null;
  punchOutTime: string | null;
  presentDaysThisMonth: number;
  totalHoursThisMonth: string;
  pendingLeaveRequests: number;
  productiveHoursToday: string | null;
  correctionsThisMonth: number;
  leaveBalances: Array<{
    id: string;
    leaveTypeId: string;
    totalDays: string;
    usedDays: string;
  }>;
}

interface MyShift {
  id: string;
  name: string;
  displayLabel: string;
  usCoverage: string;
  istStart: string;
  istEnd: string;
  isDst: boolean;
  scheduledHours: number;
  dstTransition: { date: string; newStart: string; newEnd: string } | null;
}

interface BreakStatusForDashboard {
  lunchCount: number;
  teaCount: number;
}

function formatHHMMShift(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
}

export default function HRDashboard() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();
  const [lunchReminderDismissed, setLunchReminderDismissed] = useState(false);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/hr/dashboard-stats"],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: trainingAlerts } = useQuery<{ overdue: number; dueSoon: number; total: number }>({
    queryKey: ["/api/onboarding/my-training-alerts"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/my-training-alerts", { credentials: "include" });
        if (!res.ok) return { overdue: 0, dueSoon: 0, total: 0 };
        return res.json();
      } catch {
        return { overdue: 0, dueSoon: 0, total: 0 };
      }
    },
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const { data: leaveTypes } = useQuery<LeaveType[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated,
  });

  const { data: pinnedBadges = [] } = useQuery<Array<{
    id: string; message: string; createdAt: string; giverName: string;
    badgeType: { id: string; name: string; emoji: string; color: string } | null;
  }>>({
    queryKey: ["/api/praise/pinned", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/praise/pinned/${user.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!user?.id,
  });

  const isManagerOrAbove = user && ["super_admin", "admin", "hr", "manager", "operations"].includes(user.role);
  const todayStr = new Date().toISOString().split("T")[0];
  const monthStart = todayStr.substring(0, 7) + "-01";
  const { data: corrSummaryHR } = useQuery<{ totalCorrections: number; affectedCount: number; perEmployee: Array<{ name: string; email: string; correctedDays: number }> }>({
    queryKey: ["/api/hr/attendance/corrections-summary", monthStart, todayStr],
    queryFn: () => fetch(`/api/hr/attendance/corrections-summary?startDate=${monthStart}&endDate=${todayStr}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!(isAuthenticated && isManagerOrAbove),
  });

  const currentYear = new Date().getFullYear();

  const { data: holidays } = useQuery<Array<{ id: string; name: string; date: string; type: string; isOptional: boolean }>>({
    queryKey: ["/api/hr/holidays", { year: currentYear }],
    enabled: isAuthenticated,
  });

  const { data: regionalSelections } = useQuery<Array<{ id: string; userId: string; holidayId: string; year: number }>>({
    queryKey: ["/api/hr/regional-holiday-selections", { year: currentYear }],
    enabled: isAuthenticated,
  });

  const selectRegionalMutation = useMutation({
    mutationFn: (holidayId: string) => apiRequest("POST", "/api/hr/regional-holiday-selections", { holidayId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/regional-holiday-selections"] });
      toast({ title: "Selected", description: "Regional holiday selected. This selection is now locked." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to select holiday", variant: "destructive" });
    },
  });

  const punchInMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/attendance/punch-in"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard-stats"] });
      toast({ title: "Punched In", description: "Your attendance has been recorded." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to punch in", variant: "destructive" });
    },
  });

  const punchOutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/attendance/punch-out"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard-stats"] });
      toast({ title: "Punched Out", description: "Your attendance has been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to punch out", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const getLeaveTypeName = (typeId: string) => {
    return leaveTypes?.find(lt => lt.id === typeId)?.name || "Unknown";
  };

  const selectedRegionalIds = new Set(regionalSelections?.map(s => s.holidayId) || []);
  const regionalSelectionCount = regionalSelections?.length || 0;
  const regionalHolidays = holidays?.filter(h => h.type === "regional") || [];

  const upcomingHolidays = holidays
    ?.filter(h => {
      if (h.date < new Date().toISOString().split("T")[0]) return false;
      if (h.type === "regional") return selectedRegionalIds.has(h.id);
      return true;
    })
    .slice(0, 5) || [];

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentDay = today.getDate();

  const punchedIn = stats?.todayStatus === "punched_in";
  const dayComplete = stats?.todayStatus === "completed";

  const isManagerRole = ["manager", "hr", "admin", "super_admin", "operations"].includes(user?.role || "");
  const isEmployeeOnly = !isManagerRole;

  const pendingCorrectionsCount = usePendingRegularizationCount(isAuthenticated && isManagerRole);

  const { data: myShift } = useQuery<MyShift | null>({
    queryKey: ["/api/hr/my-shift"],
    enabled: isAuthenticated && isEmployeeOnly,
    staleTime: 5 * 60 * 1000,
  });

  const { data: breakStatusForDash } = useQuery<BreakStatusForDashboard>({
    queryKey: ["/api/hr/attendance/breaks/today"],
    enabled: isAuthenticated && punchedIn,
    refetchInterval: 60000,
    select: (d: any) => ({ lunchCount: d.lunchCount ?? 0, teaCount: d.teaCount ?? 0 }),
  });

  const hoursWorked = stats?.punchInTime
    ? (Date.now() - new Date(stats.punchInTime).getTime()) / (1000 * 60 * 60)
    : 0;
  const showLunchReminder = punchedIn && !lunchReminderDismissed && hoursWorked >= 5 && (breakStatusForDash?.lunchCount ?? 0) === 0;

  const { data: teamTodayData } = useQuery<{
    presentCount: number; absentCount: number; onLeaveCount: number; totalCount: number;
  }>({
    queryKey: ["/api/hr/attendance/my-team/today-summary"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/hr/attendance/my-team?date=" + today.toISOString().split("T")[0], { credentials: "include" });
        if (!res.ok) return { presentCount: 0, absentCount: 0, onLeaveCount: 0, totalCount: 0 };
        const data = await res.json();
        const members = data.members || [];
        const attendance = data.attendance || [];
        const getStatus = (userId: string) => {
          const att = attendance.find((a: any) => a.userId === userId);
          if (!att) return "absent";
          if (att.status === "on_leave") return "on_leave";
          if (att.punchIn && att.punchOut) return "present";
          if (att.punchIn) return "working";
          return "absent";
        };
        const present = members.filter((m: any) => ["present", "working"].includes(getStatus(m.id))).length;
        const absent = members.filter((m: any) => getStatus(m.id) === "absent").length;
        const onLeave = members.filter((m: any) => getStatus(m.id) === "on_leave").length;
        return { presentCount: present, absentCount: absent, onLeaveCount: onLeave, totalCount: members.length };
      } catch { return { presentCount: 0, absentCount: 0, onLeaveCount: 0, totalCount: 0 }; }
    },
    enabled: isAuthenticated && isManagerRole,
    refetchInterval: 60000,
  });

  const { data: pendingLeaveApprovalsCount } = useQuery<number>({
    queryKey: ["/api/hr/leave-requests/my-team", "pending"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/hr/leave-requests/my-team?status=pending", { credentials: "include" });
        if (!res.ok) return 0;
        const data = await res.json();
        return Array.isArray(data) ? data.length : 0;
      } catch { return 0; }
    },
    enabled: isAuthenticated && isManagerRole,
    refetchInterval: 60000,
  });

  const { enabled: newLook } = useNewLook();

  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={Sun}
            eyebrow="My Work"
            title={`Good ${today.getHours() < 12 ? "morning" : today.getHours() < 17 ? "afternoon" : "evening"}, ${user?.firstName || "there"} 👋`}
            subtitle={today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            testId="text-hr-dashboard-title"
            actions={pinnedBadges.length > 0 ? (
              <div className="flex flex-wrap gap-1.5" data-testid="dashboard-pinned-badges">
                {pinnedBadges.map((post) => (
                  <span
                    key={post.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white"
                    title={`${post.badgeType?.name} from ${post.giverName}`}
                    data-testid={`dashboard-pinned-badge-${post.id}`}
                  >
                    {post.badgeType?.emoji} {post.badgeType?.name}
                  </span>
                ))}
              </div>
            ) : undefined}
          />
        ) : (
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-hr-dashboard-title">
              Good {today.getHours() < 12 ? "morning" : today.getHours() < 17 ? "afternoon" : "evening"}, {user?.firstName || "there"} 👋
            </h1>
            <p className="text-sm text-muted-foreground">
              {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            {pinnedBadges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2" data-testid="dashboard-pinned-badges">
                {pinnedBadges.map((post) => (
                  <span
                    key={post.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: post.badgeType ? `${post.badgeType.color}20` : "#f3f4f6",
                      color: post.badgeType?.color ?? "#374151",
                    }}
                    title={`${post.badgeType?.name} from ${post.giverName}`}
                    data-testid={`dashboard-pinned-badge-${post.id}`}
                  >
                    {post.badgeType?.emoji} {post.badgeType?.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5-hour lunch reminder banner */}
        {showLunchReminder && (
          <Alert className="flex items-center justify-between gap-4 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700" data-testid="banner-lunch-reminder">
            <div className="flex items-center gap-3">
              <Coffee className="h-5 w-5 shrink-0 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                You've been working for {Math.floor(hoursWorked)}+ hours — time for your 30-min lunch break.
              </AlertDescription>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-amber-700 hover:text-amber-900"
              onClick={() => setLunchReminderDismissed(true)}
              data-testid="button-dismiss-lunch-reminder"
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        )}

        {/* Training alert banner */}
        {(trainingAlerts?.total ?? 0) > 0 && (
          <Alert
            variant={(trainingAlerts?.overdue ?? 0) > 0 ? "destructive" : "warning"}
            className="flex items-center justify-between gap-4"
            data-testid="dashboard-training-alert"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <AlertDescription>
                <p className="font-semibold text-sm">Training Reminder</p>
                <p className="text-xs mt-0.5">
                  {(trainingAlerts?.overdue ?? 0) > 0 && (
                    <span>{trainingAlerts!.overdue} overdue{(trainingAlerts?.dueSoon ?? 0) > 0 ? `, ${trainingAlerts!.dueSoon} due soon` : ""}</span>
                  )}
                  {(trainingAlerts?.overdue ?? 0) === 0 && (trainingAlerts?.dueSoon ?? 0) > 0 && (
                    <span>{trainingAlerts!.dueSoon} {trainingAlerts!.dueSoon === 1 ? "track" : "tracks"} due within 3 days</span>
                  )}
                </p>
              </AlertDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLocation("/admin/growth")}
              data-testid="link-go-to-training"
            >
              <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
              Go to My Growth
            </Button>
          </Alert>
        )}

        {/* Manager / Admin: Team Pulse section */}
        {isManagerRole && teamTodayData && teamTodayData.totalCount > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">Your Team Today</CardTitle>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setLocation("/admin/hr/my-team")}>
                  View Team →
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-2 rounded-lg bg-background border" data-testid="team-present-count">
                  <p className="text-xl font-mono font-bold text-green-600">{teamTodayData.presentCount}</p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background border" data-testid="team-absent-count">
                  <p className="text-xl font-mono font-bold text-red-600">{teamTodayData.absentCount}</p>
                  <p className="text-xs text-muted-foreground">Absent</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background border" data-testid="team-leave-count">
                  <p className="text-xl font-mono font-bold text-blue-600">{teamTodayData.onLeaveCount}</p>
                  <p className="text-xs text-muted-foreground">On Leave</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background border" data-testid="team-approvals-count">
                  <p className="text-xl font-mono font-bold text-amber-600">{pendingLeaveApprovalsCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Pending Leaves</p>
                </div>
              </div>
              {(pendingLeaveApprovalsCount ?? 0) > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2">
                  <FileCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>{pendingLeaveApprovalsCount} leave {pendingLeaveApprovalsCount === 1 ? "request" : "requests"} awaiting your approval</span>
                  <Button size="sm" variant="link" className="h-auto p-0 text-xs ml-auto text-amber-700 dark:text-amber-400" onClick={() => setLocation("/admin/hr/my-team?tab=leave-approvals")}>
                    Review →
                  </Button>
                </div>
              )}
              {pendingCorrectionsCount > 0 && (
                <button
                  type="button"
                  className="mt-2 w-full flex items-center gap-2 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 rounded-lg p-2 hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors text-left"
                  onClick={() => setLocation("/admin/hr/my-team?tab=corrections")}
                  data-testid="card-pending-corrections"
                >
                  <FileCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="font-semibold">{pendingCorrectionsCount}</span> attendance{" "}
                    {pendingCorrectionsCount === 1 ? "correction" : "corrections"} awaiting your review
                  </span>
                  <span className="ml-auto font-medium" data-testid="link-review-corrections">Review →</span>
                </button>
              )}
              {corrSummaryHR !== undefined && (
                <button
                  type="button"
                  className="mt-2 w-full flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors text-left"
                  onClick={() => setLocation("/admin/hr/my-team?tab=attendance")}
                  data-testid="text-team-corrections-this-month"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <span>Corrections this month: <span className="font-semibold">{corrSummaryHR.totalCorrections}</span></span>
                  <span className="ml-auto">→</span>
                </button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pending SOP Audits — managers/audit-owners only (gated server-side) */}
        {isManagerRole && <PendingSopAuditsCard enabled={isManagerRole} />}

        {/* SOP Compliance Health — manager/HR view with team data (new_look only) */}
        {isManagerRole && newLook && <SopComplianceWidgetManager />}

        {/* Governance Obligations — visible to all employees with active controls */}
        <GovernanceObligationsCard />

        {/* SOP Compliance Health — employee personal view (new_look only) */}
        {isEmployeeOnly && newLook && <SopComplianceWidgetEmployee />}

        {/* My Shift card — employee only */}
        {isEmployeeOnly && myShift && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20" data-testid="card-my-shift">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-100" data-testid="text-shift-name">{myShift.name}</span>
                  </div>
                  <p className="text-base font-mono font-bold text-foreground ml-6" data-testid="text-shift-timing">
                    {formatHHMMShift(myShift.istStart)} – {formatHHMMShift(myShift.istEnd)} IST
                  </p>
                  {myShift.usCoverage && (
                    <p className="text-xs text-muted-foreground ml-6 flex items-center gap-1.5" data-testid="text-shift-us-coverage">
                      <span>{myShift.usCoverage}</span>
                      <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                        {myShift.isDst ? "Summer schedule" : "Winter schedule"} · active
                      </span>
                    </p>
                  )}
                  {myShift.dstTransition && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 ml-6 flex items-center gap-1" data-testid="text-shift-dst-notice">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Timing changes to {formatHHMMShift(myShift.dstTransition.newStart)} on{" "}
                      {new Date(myShift.dstTransition.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top row: Attendance card (with break widget) + Month + Leave */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Attendance + Breaks */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
              <Clock className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <>
                  {/* Status + times */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge
                        variant={dayComplete ? "default" : punchedIn ? "secondary" : "outline"}
                        data-testid="badge-attendance-status"
                      >
                        {dayComplete ? "Day Complete" : punchedIn ? "Working" : "Not Started"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">In</span>
                      <span className="text-sm font-medium font-mono" data-testid="text-punch-in-time">{formatTime(stats?.punchInTime || null)}</span>
                    </div>
                    {dayComplete && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Out</span>
                        <span className="text-sm font-medium font-mono" data-testid="text-punch-out-time">{formatTime(stats?.punchOutTime || null)}</span>
                      </div>
                    )}
                    {(punchedIn || dayComplete) && stats?.productiveHoursToday && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          Productive
                        </span>
                        <span className="text-sm font-medium font-mono text-green-600 dark:text-green-400" data-testid="text-productive-hours">{stats.productiveHoursToday}</span>
                      </div>
                    )}
                  </div>

                  {/* Punch actions */}
                  <div>
                    {stats?.todayStatus === "not_punched" && (
                      <Button
                        className="w-full"
                        onClick={() => punchInMutation.mutate()}
                        disabled={punchInMutation.isPending}
                        data-testid="button-punch-in"
                      >
                        <LogIn className="h-4 w-4 mr-2" />
                        {punchInMutation.isPending ? "Punching In..." : "Punch In"}
                      </Button>
                    )}
                    {stats?.todayStatus === "punched_in" && (
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={() => punchOutMutation.mutate()}
                        disabled={punchOutMutation.isPending}
                        data-testid="button-punch-out"
                      >
                        <LogOutIcon className="h-4 w-4 mr-2" />
                        {punchOutMutation.isPending ? "Punching Out..." : "Punch Out"}
                      </Button>
                    )}
                    {stats?.todayStatus === "completed" && (
                      <p className="text-center text-sm text-muted-foreground">
                        Attendance recorded for today
                      </p>
                    )}
                  </div>

                  {/* Break widget — only visible when punched in */}
                  {punchedIn && (
                    <>
                      <Separator />
                      <BreakWidget punchedIn={punchedIn} />
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* This Month */}
          {isLoading ? (
            <Card><CardContent className="p-5"><Skeleton className="h-28 w-full" /></CardContent></Card>
          ) : (
            <StatCard
              label="This Month"
              value={stats?.presentDaysThisMonth || 0}
              subvalue={`${stats?.totalHoursThisMonth || "0"} hrs · ${currentDay}/${daysInMonth} days`}
              icon={<TrendingUp className="h-5 w-5" />}
              accentColour="text-green-600"
              data-testid="text-present-days"
            />
          )}

          {/* Leave Requests */}
          {isLoading ? (
            <Card><CardContent className="p-5"><Skeleton className="h-28 w-full" /></CardContent></Card>
          ) : (
            <div className="flex flex-col gap-3">
              <StatCard
                label="Leave Requests"
                value={stats?.pendingLeaveRequests || 0}
                subvalue="Pending this month"
                icon={<CalendarCheck className="h-5 w-5" />}
                accentColour="text-orange-600"
                data-testid="text-pending-leaves"
              />
              <Button variant="outline" className="w-full" onClick={() => setLocation("/admin/hr?tab=leaves")} data-testid="link-view-leaves">
                View My Leaves
              </Button>
            </div>
          )}
        </div>

        {/* Leave balances + Upcoming holidays */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leave Balances</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : stats?.leaveBalances && stats.leaveBalances.length > 0 ? (
                <div className="space-y-3">
                  {stats.leaveBalances.map((bal) => {
                    const total = parseFloat(bal.totalDays);
                    const used = parseFloat(bal.usedDays);
                    const available = Math.max(0, total - used);
                    const name = getLeaveTypeName(bal.leaveTypeId);
                    const lt = leaveTypes?.find(l => l.id === bal.leaveTypeId);
                    const isEL = lt?.isConditional && (lt.carryForwardCap || 0) > 0;
                    const isCompOff = /comp.?off|compensatory/i.test(name);
                    const isSL = lt && !lt.isConditional && !/lwp|loss.?of.?pay/i.test(name) && !isCompOff;
                    const type: "el" | "sl" | "co" | "default" = isEL ? "el" : isSL ? "sl" : isCompOff ? "co" : "default";
                    return (
                      <LeaveBalanceCard
                        key={bal.id}
                        type={type}
                        label={name}
                        balance={available}
                        total={total}
                        used={used}
                        data-testid={`leave-balance-${bal.leaveTypeId}`}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No leave balances available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Holidays</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingHolidays.length > 0 ? (
                <div className="space-y-3">
                  {upcomingHolidays.map((h) => (
                    <div key={h.id} className="flex items-center justify-between flex-wrap gap-1" data-testid={`holiday-${h.id}`}>
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{h.name}</span>
                        {h.type === "regional" && <Badge variant="secondary" className="text-xs">Regional</Badge>}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(h.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming holidays</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Regional Holiday Selection */}
        {regionalHolidays.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Regional Holiday Selection</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose up to 2 regional holidays for {currentYear}. Once selected, choices are locked.
                </p>
              </div>
              <Badge variant={regionalSelectionCount >= 2 ? "default" : "outline"} data-testid="badge-regional-count">
                {regionalSelectionCount}/2
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {regionalHolidays.map((h) => {
                  const isSelected = selectedRegionalIds.has(h.id);
                  return (
                    <div key={h.id} className="flex items-center justify-between flex-wrap gap-2" data-testid={`regional-holiday-${h.id}`}>
                      <div className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm">{h.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {new Date(h.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                      {isSelected ? (
                        <Badge variant="default" data-testid={`badge-selected-${h.id}`}>
                          <Lock className="h-3 w-3 mr-1" />
                          Selected
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={regionalSelectionCount >= 2 || selectRegionalMutation.isPending}
                          onClick={() => selectRegionalMutation.mutate(h.id)}
                          data-testid={`button-select-regional-${h.id}`}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Select
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
