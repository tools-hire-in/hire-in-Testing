import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, CalendarDays, CalendarCheck, TrendingUp, LogIn, LogOut as LogOutIcon, Globe, Lock, Check, GraduationCap, AlertTriangle } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DashboardStats {
  todayStatus: "not_punched" | "punched_in" | "completed";
  punchInTime: string | null;
  punchOutTime: string | null;
  presentDaysThisMonth: number;
  totalHoursThisMonth: string;
  pendingLeaveRequests: number;
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
}

export default function HRDashboard() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-hr-dashboard-title">HR Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.firstName || "Employee"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Attendance</CardTitle>
              <Clock className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge
                      variant={stats?.todayStatus === "completed" ? "default" : stats?.todayStatus === "punched_in" ? "secondary" : "outline"}
                      data-testid="badge-attendance-status"
                    >
                      {stats?.todayStatus === "completed" ? "Day Complete" : stats?.todayStatus === "punched_in" ? "Working" : "Not Started"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">In</span>
                    <span className="text-sm font-medium" data-testid="text-punch-in-time">{formatTime(stats?.punchInTime || null)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Out</span>
                    <span className="text-sm font-medium" data-testid="text-punch-out-time">{formatTime(stats?.punchOutTime || null)}</span>
                  </div>
                  <div className="pt-2">
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
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <div className="text-center">
                    <div className="text-4xl font-bold" data-testid="text-present-days">{stats?.presentDaysThisMonth || 0}</div>
                    <p className="text-sm text-muted-foreground">Days Present</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Hours</span>
                    <span className="text-sm font-medium">{stats?.totalHoursThisMonth || "0"} hrs</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Working Days</span>
                    <span className="text-sm font-medium">{currentDay} / {daysInMonth}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Leave Requests</CardTitle>
              <CalendarCheck className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <div className="text-center">
                    <div className="text-4xl font-bold" data-testid="text-pending-leaves">{stats?.pendingLeaveRequests || 0}</div>
                    <p className="text-sm text-muted-foreground">Pending Requests</p>
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <a href="/admin/hr/leaves" data-testid="link-view-leaves">View My Leaves</a>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {(trainingAlerts?.total ?? 0) > 0 && (
          <div
            className={`flex items-center justify-between gap-4 p-4 rounded-lg border-l-4 ${(trainingAlerts?.overdue ?? 0) > 0 ? "bg-red-50 border-l-red-500 dark:bg-red-950/30" : "bg-amber-50 border-l-amber-500 dark:bg-amber-950/30"}`}
            data-testid="dashboard-training-alert"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-5 w-5 shrink-0 ${(trainingAlerts?.overdue ?? 0) > 0 ? "text-red-600" : "text-amber-600"}`} />
              <div>
                <p className={`font-semibold text-sm ${(trainingAlerts?.overdue ?? 0) > 0 ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
                  Training Reminder
                </p>
                <p className={`text-xs ${(trainingAlerts?.overdue ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {(trainingAlerts?.overdue ?? 0) > 0 && (
                    <span>{trainingAlerts!.overdue} overdue{(trainingAlerts?.dueSoon ?? 0) > 0 ? `, ${trainingAlerts!.dueSoon} due soon` : ""}</span>
                  )}
                  {(trainingAlerts?.overdue ?? 0) === 0 && (trainingAlerts?.dueSoon ?? 0) > 0 && (
                    <span>{trainingAlerts!.dueSoon} {trainingAlerts!.dueSoon === 1 ? "track" : "tracks"} due within 3 days</span>
                  )}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className={(trainingAlerts?.overdue ?? 0) > 0 ? "border-red-300 text-red-700 hover:bg-red-100" : "border-amber-300 text-amber-700 hover:bg-amber-100"}
              asChild
            >
              <a href="/admin/hr/my-training" data-testid="link-go-to-training">
                <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
                Go to My Training
              </a>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    const remaining = total - used;
                    const percent = total > 0 ? (used / total) * 100 : 0;
                    return (
                      <div key={bal.id} data-testid={`leave-balance-${bal.leaveTypeId}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{getLeaveTypeName(bal.leaveTypeId)}</span>
                          <span className="text-sm text-muted-foreground">{remaining} / {total} days</span>
                        </div>
                        <div className="w-full bg-muted rounded-md h-2">
                          <div
                            className="bg-primary rounded-md h-2 transition-all"
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
                        </div>
                      </div>
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
              {regionalSelectionCount > 0 && (
                <p className="text-xs text-muted-foreground mt-4">
                  Contact HR or Super Admin to change your selections.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
