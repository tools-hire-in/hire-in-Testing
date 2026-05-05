import { useEffect, useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LogIn,
  LogOut as LogOutIcon,
  CheckCircle2,
  Coffee,
  AlertCircle,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { BreakWidget } from "@/components/admin/BreakWidget";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TicketsContent } from "./Tickets";
import { PillTabs, PillTabsContent, PillTabsList, PillTabsTrigger } from "@/components/ui/pill-tabs";

interface DashboardStats {
  todayStatus: "not_punched" | "punched_in" | "completed";
  punchInTime: string | null;
  punchOutTime: string | null;
  presentDaysThisMonth: number;
  totalHoursThisMonth: string;
  pendingLeaveRequests: number;
  productiveHoursToday: string | null;
  correctionsThisMonth: number;
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
}

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

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  present:   { label: "Present",   cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  absent:    { label: "Absent",    cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  half_day:  { label: "Half Day",  cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  late:      { label: "Late",      cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  on_leave:  { label: "On Leave",  cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  holiday:   { label: "Holiday",   cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  weekend:   { label: "Weekend",   cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  corrected: { label: "Corrected", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
};

function StatusBadge({ status, isCorrect }: { status: string; isCorrect?: boolean }) {
  const key = isCorrect && status === "present" ? "corrected" : (status || "absent");
  const cfg = STATUS_STYLE[key] || { label: status, cls: "" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export default function Attendance() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [liveMs, setLiveMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("tab");
  const [activeTab, setActiveTab] = useState(requestedTab === "tickets" ? "tickets" : "attendance");

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/hr/dashboard-stats"],
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const { data: myShift } = useQuery<{ id: string; name: string } | null>({
    queryKey: ["/api/hr/my-shift"],
    enabled: isAuthenticated,
  });

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: records } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/hr/attendance/my", { startDate: monthStart, endDate: todayStr }],
    enabled: isAuthenticated,
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

  const punchInMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/attendance/punch-in"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/my"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/my"] });
      toast({ title: "Punched Out", description: "See you next shift!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to punch out", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === "attendance") url.searchParams.delete("tab");
    else url.searchParams.set("tab", value);
    window.history.replaceState({}, "", url.toString());
  };

  const punchedIn = stats?.todayStatus === "punched_in";
  const dayComplete = stats?.todayStatus === "completed";
  const progressPct = Math.min(100, (liveMs / (TARGET_HOURS * 3600000)) * 100);
  const todayDate = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const recentRecords = [...(records || [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PillTabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-attendance">
          <PillTabsList>
            <PillTabsTrigger value="attendance" data-testid="tab-attendance">My Attendance</PillTabsTrigger>
            <PillTabsTrigger value="tickets" data-testid="tab-tickets">Regularization</PillTabsTrigger>
          </PillTabsList>

          <PillTabsContent value="attendance">
            <div className="space-y-4 max-w-xl">

              {/* ── NO SHIFT BANNER ── */}
              {myShift === null && !isLoading && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      No shift selected
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">
                      You need to select a shift before attendance tracking can work correctly. Go to{" "}
                      <Link
                        href="/admin/profile"
                        className="underline underline-offset-2 font-medium hover:text-amber-900 dark:hover:text-amber-100"
                      >
                        My Profile → My Shift
                      </Link>{" "}
                      to choose your shift.
                    </p>
                  </div>
                </div>
              )}

              {/* ── TODAY'S TIME CARD ── */}
              <Card className="overflow-hidden border-2 border-border">
                <CardContent className="p-0">

                  {/* Header */}
                  <div className="flex items-start justify-between px-5 pt-5 pb-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        {todayDate}
                      </p>
                      <p className="text-sm font-semibold mt-0.5 text-foreground">Today's Time Card</p>
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-6 w-20" />
                    ) : (
                      <Badge
                        variant={dayComplete ? "default" : punchedIn ? "secondary" : "outline"}
                        className="text-xs"
                        data-testid="badge-attendance-status"
                      >
                        {dayComplete ? "Day Complete" : punchedIn ? "● Working" : "Not Started"}
                      </Badge>
                    )}
                  </div>

                  {/* Live hours + progress */}
                  <div className="px-5 pb-4 space-y-2">
                    {isLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : (
                      <>
                        <div className="flex items-end justify-between">
                          <span
                            className={`text-4xl font-mono font-bold tracking-tight ${punchedIn ? "text-foreground" : "text-muted-foreground"}`}
                            data-testid="text-hours-worked"
                          >
                            {(punchedIn || dayComplete) ? formatElapsed(liveMs) : "—h ——m"}
                          </span>
                          <span className="text-sm text-muted-foreground mb-1">of {TARGET_HOURS}h target</span>
                        </div>
                        {(punchedIn || dayComplete) && (
                          <Progress value={progressPct} className="h-2.5" data-testid="progress-hours" />
                        )}
                      </>
                    )}
                  </div>

                  {/* In / Out times */}
                  <div className="grid grid-cols-2 gap-px bg-border mx-5 rounded-lg overflow-hidden">
                    <div className="bg-muted/40 p-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Punch In</p>
                      <p className="text-base font-semibold font-mono" data-testid="text-punch-in-time">
                        {formatTime(stats?.punchInTime || null)}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Punch Out</p>
                      <p className="text-base font-semibold font-mono" data-testid="text-punch-out-time">
                        {formatTime(stats?.punchOutTime || null)}
                      </p>
                    </div>
                  </div>

                  {/* Main action button */}
                  <div className="px-5 py-4">
                    {isLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : stats?.todayStatus === "not_punched" ? (
                      <Button
                        className="w-full h-12 text-base font-semibold gap-2"
                        onClick={() => punchInMutation.mutate()}
                        disabled={punchInMutation.isPending}
                        data-testid="button-punch-in"
                      >
                        <LogIn className="h-5 w-5" />
                        {punchInMutation.isPending ? "Starting your day…" : "Punch In"}
                      </Button>
                    ) : stats?.todayStatus === "punched_in" ? (
                      <Button
                        className="w-full h-12 text-base font-semibold gap-2"
                        variant="secondary"
                        onClick={() => punchOutMutation.mutate()}
                        disabled={punchOutMutation.isPending}
                        data-testid="button-punch-out"
                      >
                        <LogOutIcon className="h-5 w-5" />
                        {punchOutMutation.isPending ? "Wrapping up…" : "Punch Out"}
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-2 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-medium">
                          {stats?.productiveHoursToday
                            ? `${stats.productiveHoursToday} productive — great work!`
                            : "Attendance recorded for today"}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ── BREAKS (only when punched in) ── */}
              {punchedIn && (
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Coffee className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Breaks</span>
                    </div>
                    <BreakWidget punchedIn={punchedIn} />
                  </CardContent>
                </Card>
              )}

              {/* ── MONTH SUMMARY ── */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-mono font-bold" data-testid="text-days-present">
                      {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (stats?.presentDaysThisMonth ?? 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Days Present</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-mono font-bold">
                      {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (stats?.totalHoursThisMonth ?? "0")}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Hours This Month</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-mono font-bold">
                      {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (
                        stats?.presentDaysThisMonth && stats.totalHoursThisMonth
                          ? (parseFloat(stats.totalHoursThisMonth) / stats.presentDaysThisMonth).toFixed(1)
                          : "0"
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Avg Hrs / Day</p>
                  </CardContent>
                </Card>
              </div>

              {/* ── RECENT RECORDS ── */}
              <Card>
                <CardContent className="p-0">
                  <div className="px-5 py-3.5 border-b">
                    <h3 className="text-sm font-semibold">Recent Records</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">In</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Out</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Hours</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentRecords.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                              No records this month yet
                            </td>
                          </tr>
                        ) : recentRecords.map((r) => {
                          const d = new Date(r.date + "T12:00:00");
                          const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
                          const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                          const isToday = r.date === todayStr;
                          return (
                            <tr
                              key={r.date}
                              className={`border-b last:border-0 transition-colors ${isToday ? "bg-primary/5 font-medium" : "hover:bg-muted/30"}`}
                              data-testid={`attendance-row-${r.date}`}
                            >
                              <td className="py-3 px-4">
                                <span className="font-medium">{dateLabel}</span>
                                <span className="text-xs text-muted-foreground ml-1.5">{dayName}</span>
                              </td>
                              <td className="py-3 px-4 font-mono text-sm">{formatTime(r.punchIn)}</td>
                              <td className="py-3 px-4 font-mono text-sm">{formatTime(r.punchOut)}</td>
                              <td className="py-3 px-4 font-mono text-sm">
                                {r.totalHours ? `${parseFloat(r.totalHours).toFixed(1)}h` : "—"}
                              </td>
                              <td className="py-3 px-4">
                                <StatusBadge status={r.status} isCorrect={r.isCorrect} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

            </div>
          </PillTabsContent>

          <PillTabsContent value="tickets">
            <TicketsContent />
          </PillTabsContent>
        </PillTabs>
      </div>
    </AdminLayout>
  );
}
