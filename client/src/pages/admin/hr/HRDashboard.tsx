import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, CalendarDays, CalendarCheck, TrendingUp, LogIn, LogOut as LogOutIcon } from "lucide-react";
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

  const { data: leaveTypes } = useQuery<LeaveType[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated,
  });

  const { data: holidays } = useQuery<Array<{ id: string; name: string; date: string }>>({
    queryKey: ["/api/hr/holidays", { year: new Date().getFullYear() }],
    enabled: isAuthenticated,
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

  const upcomingHolidays = holidays
    ?.filter(h => h.date >= new Date().toISOString().split("T")[0])
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
                    <div key={h.id} className="flex items-center justify-between" data-testid={`holiday-${h.id}`}>
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{h.name}</span>
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
      </div>
    </AdminLayout>
  );
}
