import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LogIn,
  LogOut as LogOutIcon,
  GraduationCap,
  AlertTriangle,
  Users,
  FileCheck,
  CalendarDays,
  Coffee,
  X,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BreakWidget } from "@/components/admin/BreakWidget";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const TARGET_HOURS = 8;

function formatElapsed(ms: number): string {
  if (ms <= 0) return "0h 00m";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatTime(ts: string | null): string {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

interface DashboardStats {
  todayStatus: "not_punched" | "punched_in" | "completed" | "exempt";
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

interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  isConditional: boolean;
  carryForwardCap: number | null;
  occurrenceBased: boolean;
}

export default function CommandCenter() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [liveMs, setLiveMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lunchReminderDismissed, setLunchReminderDismissed] = useState(false);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/hr/dashboard-stats"],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: leaveTypes } = useQuery<LeaveType[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated,
  });

  const { data: trainingAlerts } = useQuery<{ overdue: number; dueSoon: number; total: number }>({
    queryKey: ["/api/onboarding/my-training-alerts"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/my-training-alerts", { credentials: "include" });
        if (!res.ok) return { overdue: 0, dueSoon: 0, total: 0 };
        return res.json();
      } catch { return { overdue: 0, dueSoon: 0, total: 0 }; }
    },
    enabled: isAuthenticated,
    refetchInterval: 60000,
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

  const isManagerRole = ["manager", "hr", "admin", "super_admin", "operations"].includes(user?.role || "");
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const { data: teamTodayData } = useQuery<{
    presentCount: number; absentCount: number; onLeaveCount: number; totalCount: number;
  }>({
    queryKey: ["/api/hr/attendance/my-team/today-summary"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/hr/attendance/my-team?date=" + todayStr, { credentials: "include" });
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
      toast({ title: "Punched Out", description: "See you next shift!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to punch out", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (stats?.punchInTime && stats.todayStatus === "punched_in") {
      const tick = () => setLiveMs(Date.now() - new Date(stats.punchInTime!).getTime());
      tick();
      timerRef.current = setInterval(tick, 30000);
    } else if (stats?.punchInTime && stats?.punchOutTime) {
      setLiveMs(new Date(stats.punchOutTime).getTime() - new Date(stats.punchInTime).getTime());
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      setLiveMs(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stats?.punchInTime, stats?.punchOutTime, stats?.todayStatus]);

  const punchedIn = stats?.todayStatus === "punched_in";
  const dayComplete = stats?.todayStatus === "completed";
  const progressPct = Math.min(100, (liveMs / (TARGET_HOURS * 3600000)) * 100);
  const hoursWorked = liveMs / 3600000;

  const progressColor = hoursWorked >= 9
    ? "bg-amber-500"
    : hoursWorked >= TARGET_HOURS
    ? "bg-green-500"
    : "bg-blue-500";

  const showLunchReminder = punchedIn && !lunchReminderDismissed && hoursWorked >= 5;

  const selectedRegionalIds = new Set(regionalSelections?.map(s => s.holidayId) || []);
  const upcomingHolidays = holidays
    ?.filter(h => {
      if (h.date < todayStr) return false;
      if (h.type === "regional") return selectedRegionalIds.has(h.id);
      return true;
    })
    .slice(0, 3) || [];

  const getLeaveTypeName = (typeId: string) => leaveTypes?.find(lt => lt.id === typeId)?.name || "Leave";

  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4" data-testid="command-center-bento">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-semibold" data-testid="text-cc-greeting">
          {greeting}, {user?.firstName || "there"} 👋
        </h2>
        <p className="text-sm text-muted-foreground">
          {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Training alert */}
      {(trainingAlerts?.total ?? 0) > 0 && (
        <Alert
          className={`flex items-center justify-between gap-4 ${(trainingAlerts?.overdue ?? 0) > 0 ? "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800" : "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700"}`}
          data-testid="cc-training-alert"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className={`h-5 w-5 shrink-0 ${(trainingAlerts?.overdue ?? 0) > 0 ? "text-red-600" : "text-amber-600"}`} />
            <AlertDescription className={`${(trainingAlerts?.overdue ?? 0) > 0 ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200"}`}>
              {(trainingAlerts?.overdue ?? 0) > 0
                ? `⚠ Training overdue — ${trainingAlerts!.overdue} track${trainingAlerts!.overdue === 1 ? "" : "s"} past deadline`
                : `${trainingAlerts!.dueSoon} training track${trainingAlerts!.dueSoon === 1 ? "" : "s"} due soon`}
            </AlertDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLocation("/admin/growth")}
            className="shrink-0"
            data-testid="cc-link-go-training"
          >
            <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
            My Growth
          </Button>
        </Alert>
      )}

      {/* Lunch reminder */}
      {showLunchReminder && (
        <Alert className="flex items-center justify-between gap-4 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700" data-testid="cc-lunch-reminder">
          <div className="flex items-center gap-3">
            <Coffee className="h-5 w-5 shrink-0 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              You've been working for {Math.floor(hoursWorked)}+ hours — time for your lunch break.
            </AlertDescription>
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-700" onClick={() => setLunchReminderDismissed(true)} data-testid="cc-dismiss-lunch">
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}

      {/* Bento grid: hero (3/5) + right column (2/5) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Left hero: Punch status */}
        <Card className="md:col-span-3 border-2" data-testid="cc-punch-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Card — Today
              </CardTitle>
              {!isLoading && (
                <Badge
                  variant={dayComplete ? "default" : punchedIn ? "secondary" : "outline"}
                  data-testid="cc-punch-status-badge"
                >
                  {dayComplete ? "Day Complete" : punchedIn ? "● Working" : "Not Started"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                {/* Live hours counter */}
                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <span
                      className={`text-5xl font-mono font-bold tracking-tight ${punchedIn ? "text-foreground" : "text-muted-foreground"}`}
                      data-testid="cc-hours-worked"
                    >
                      {(punchedIn || dayComplete) ? formatElapsed(liveMs) : "—h ——m"}
                    </span>
                    <span className="text-sm text-muted-foreground mb-2">{TARGET_HOURS}h target</span>
                  </div>
                  {(punchedIn || dayComplete) && (
                    <div className="space-y-1">
                      <div className={`h-3 w-full rounded-full overflow-hidden bg-muted`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                          style={{ width: `${progressPct}%` }}
                          data-testid="cc-progress-bar"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        {stats?.punchInTime && <span>In: {formatTime(stats.punchInTime)}</span>}
                        {dayComplete && stats?.punchOutTime && <span>Out: {formatTime(stats.punchOutTime)}</span>}
                        {punchedIn && <span className="text-green-600 dark:text-green-400">{Math.round(progressPct)}%</span>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Punch action — compact, not full-width */}
                <div className="flex items-center gap-3">
                  {stats?.todayStatus === "not_punched" && (
                    <Button
                      size="sm"
                      className="h-8 px-5 text-sm font-semibold"
                      onClick={() => punchInMutation.mutate()}
                      disabled={punchInMutation.isPending}
                      data-testid="cc-button-punch-in"
                    >
                      <LogIn className="h-4 w-4 mr-1.5" />
                      {punchInMutation.isPending ? "Punching In…" : "Punch In"}
                    </Button>
                  )}
                  {stats?.todayStatus === "punched_in" && (
                    <Button
                      size="sm"
                      className="h-8 px-5 text-sm font-semibold"
                      variant="secondary"
                      onClick={() => punchOutMutation.mutate()}
                      disabled={punchOutMutation.isPending}
                      data-testid="cc-button-punch-out"
                    >
                      <LogOutIcon className="h-4 w-4 mr-1.5" />
                      {punchOutMutation.isPending ? "Punching Out…" : "Punch Out"}
                    </Button>
                  )}
                  {stats?.todayStatus === "completed" && (
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                      ✓ Attendance recorded
                    </p>
                  )}
                </div>

                {/* Break widget */}
                {punchedIn && (
                  <div className="pt-1 border-t">
                    <BreakWidget punchedIn={punchedIn} />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Right column: leave balance + open requests */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Leave balance card */}
          <Card data-testid="cc-leave-balance-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Leave Balance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : stats?.leaveBalances && stats.leaveBalances.length > 0 ? (
                stats.leaveBalances.slice(0, 3).map((bal) => {
                  const total = parseFloat(bal.totalDays);
                  const used = parseFloat(bal.usedDays);
                  const available = Math.max(0, total - used);
                  const pct = total > 0 ? Math.min(100, (available / total) * 100) : 0;
                  const name = getLeaveTypeName(bal.leaveTypeId);
                  return (
                    <div key={bal.id} className="space-y-1" data-testid={`cc-leave-bal-${bal.leaveTypeId}`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium truncate mr-2">{name}</span>
                        <span className="font-semibold text-foreground shrink-0">{available}d left</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct > 50 ? "bg-green-500" : pct > 25 ? "bg-amber-500" : "bg-red-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No leave data available</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs h-7 mt-1"
                onClick={() => setLocation("/admin/my-desk?tab=time-off")}
                data-testid="cc-link-view-leaves"
              >
                Time Off →
              </Button>
            </CardContent>
          </Card>

          {/* Open requests card */}
          <Card data-testid="cc-open-requests-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Pending leaves</span>
                    <span
                      className={`text-lg font-bold font-mono ${(stats?.pendingLeaveRequests ?? 0) > 0 ? "text-amber-600" : "text-muted-foreground"}`}
                      data-testid="cc-pending-leaves-count"
                    >
                      {stats?.pendingLeaveRequests ?? 0}
                    </span>
                  </div>
                  {(stats?.pendingLeaveRequests ?? 0) > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs h-7"
                      onClick={() => setLocation("/admin/my-desk?tab=time-off")}
                      data-testid="cc-link-view-requests"
                    >
                      View requests →
                    </Button>
                  )}
                  {(stats?.pendingLeaveRequests ?? 0) === 0 && (
                    <p className="text-xs text-muted-foreground text-center">No open requests ✓</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upcoming holidays strip */}
      {upcomingHolidays.length > 0 && (
        <Card data-testid="cc-holidays-strip">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 shrink-0">
                <CalendarDays className="h-3.5 w-3.5" />
                Upcoming
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {upcomingHolidays.map((h, i) => (
                  <span key={h.id} className="text-xs text-muted-foreground flex items-center gap-1.5" data-testid={`cc-holiday-${h.id}`}>
                    {i > 0 && <span className="text-muted-foreground/30">•</span>}
                    <span className="font-medium text-foreground">{new Date(h.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <span>{h.name}</span>
                    {h.type === "regional" && <Badge variant="outline" className="text-[10px] px-1 h-4">Regional</Badge>}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Pulse — manager/HR/admin only */}
      {isManagerRole && teamTodayData && teamTodayData.totalCount > 0 && (
        <Card className="border-primary/20 bg-primary/5" data-testid="cc-team-pulse">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Your Team Today</CardTitle>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setLocation("/admin/hr/my-team")} data-testid="cc-link-view-team">
                View Team →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-lg bg-background border" data-testid="cc-team-present">
                <p className="text-xl font-mono font-bold text-green-600">{teamTodayData.presentCount}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-background border" data-testid="cc-team-absent">
                <p className="text-xl font-mono font-bold text-red-600">{teamTodayData.absentCount}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-background border" data-testid="cc-team-leave">
                <p className="text-xl font-mono font-bold text-blue-600">{teamTodayData.onLeaveCount}</p>
                <p className="text-xs text-muted-foreground">On Leave</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-background border" data-testid="cc-team-pending">
                <p className="text-xl font-mono font-bold text-amber-600">{pendingLeaveApprovalsCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
