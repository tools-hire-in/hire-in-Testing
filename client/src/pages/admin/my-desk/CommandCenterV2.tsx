import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LogIn,
  LogOut as LogOutIcon,
  Clock,
  CalendarDays,
  CalendarOff,
  Target,
  ListChecks,
  Award,
  Users,
  FileCheck,
  GraduationCap,
  ShieldCheck,
  LifeBuoy,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePendingRegularizationCount } from "@/hooks/use-pending-regularizations";
import { BreakChips, type BreakStatus } from "./CommandCenter";

const TARGET_HOURS = 9;
const NAVY = "#1F3A6E";

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
  leaveBalances: Array<{ id: string; leaveTypeId: string; totalDays: string; usedDays: string }>;
}

interface LeaveType {
  id: string;
  name: string;
}

interface MyShift {
  id: string;
  name: string;
  displayLabel: string;
  usCoverage: string | null;
  istStart: string;
  istEnd: string;
  isDst: boolean;
  scheduledHours: number;
  dstTransition: { date: string; newStart: string; newEnd: string } | null;
}

interface Goal {
  id: string;
  title: string;
  progress: number;
  status: string;
  weight: number;
  targetDate: string | null;
}

interface PolicyRequest {
  requestId: string;
  status: string;
  policyTitle: string;
}

interface MyReview {
  id: string;
  type: string;
  status: string;
}

interface TrainingAssignment {
  id: string;
  status: string;
  progressPct: number;
}

interface PraisePost {
  id: string;
  giverName?: string;
  recipientName?: string;
  message: string;
  badgeType?: { name: string; emoji: string; color: string } | null;
}

async function safeJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/* ── A single small vital-sign stat tile ── */
function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  onClick,
  testId,
  loading,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "amber" | "green" | "navy";
  onClick?: () => void;
  testId?: string;
  loading?: boolean;
}) {
  const toneRing =
    tone === "amber"
      ? "border-[#F47C20]/50"
      : tone === "green"
      ? "border-[#1F3A6E]/40"
      : "border-border";
  return (
    <Card
      className={`shadow-sm ${toneRing} ${onClick ? "cursor-pointer hover-elevate active-elevate-2" : ""}`}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" style={{ color: NAVY }} />
          <span className="truncate">{label}</span>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-20 mt-2" />
        ) : (
          <div className="mt-1.5 text-2xl font-bold font-mono leading-none text-foreground">{value}</div>
        )}
        {hint && !loading && <p className="mt-1 text-[11px] text-muted-foreground truncate">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function CommandCenterV2() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [liveMs, setLiveMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isManagerRole = ["manager", "hr", "admin", "super_admin", "operations"].includes(user?.role || "");
  const isResolverRole = ["super_admin", "admin", "hr", "operations"].includes(user?.role || "");

  const pendingRegularizationCount = usePendingRegularizationCount(isAuthenticated && isManagerRole);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const currentYear = today.getFullYear();

  /* ── Core vital-sign queries ── */
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/hr/dashboard-stats"],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: leaveTypes } = useQuery<LeaveType[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated,
  });

  const { data: myShift, isLoading: shiftLoading } = useQuery<MyShift | null>({
    queryKey: ["/api/hr/my-shift"],
    queryFn: () => safeJson<MyShift | null>("/api/hr/my-shift", null),
    enabled: isAuthenticated,
  });

  const { data: openTickets } = useQuery<{ count: number }>({
    queryKey: ["/api/help-desk/open-count"],
    queryFn: () => safeJson("/api/help-desk/open-count", { count: 0 }),
    enabled: isAuthenticated && isResolverRole,
    refetchInterval: 60000,
  });

  const { data: trainingAlerts } = useQuery<{ overdue: number; dueSoon: number; total: number }>({
    queryKey: ["/api/onboarding/my-training-alerts"],
    queryFn: () => safeJson("/api/onboarding/my-training-alerts", { overdue: 0, dueSoon: 0, total: 0 }),
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const { data: pendingAddendums } = useQuery<{ id: string; token: string; addendumType: string; candidateName: string; effectiveDate: string | null }[]>({
    queryKey: ["/api/hr/tools/addendums/my-pending"],
    queryFn: () => safeJson("/api/hr/tools/addendums/my-pending", []),
    enabled: isAuthenticated,
    refetchInterval: 120000,
  });

  const { data: assignments } = useQuery<TrainingAssignment[]>({
    queryKey: ["/api/onboarding/my-assignments"],
    queryFn: () => safeJson<TrainingAssignment[]>("/api/onboarding/my-assignments", []),
    enabled: isAuthenticated,
  });

  const { data: goals, isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ["/api/performance/goals"],
    queryFn: () => safeJson<Goal[]>("/api/performance/goals", []),
    enabled: isAuthenticated,
  });

  const { data: policyRequests } = useQuery<PolicyRequest[]>({
    queryKey: ["/api/hr/my-policy-requests"],
    queryFn: () => safeJson<PolicyRequest[]>("/api/hr/my-policy-requests", []),
    enabled: isAuthenticated,
  });

  const { data: myReviews } = useQuery<MyReview[]>({
    queryKey: ["/api/performance/reviews/my"],
    queryFn: () => safeJson<MyReview[]>("/api/performance/reviews/my", []),
    enabled: isAuthenticated,
  });

  const { data: praiseBoard, isLoading: praiseLoading } = useQuery<{ posts: PraisePost[]; total: number }>({
    queryKey: ["/api/praise/board", { page: 1 }],
    queryFn: () => safeJson("/api/praise/board?page=1", { posts: [], total: 0 }),
    enabled: isAuthenticated,
  });

  const { data: myBadges } = useQuery<{ posts: PraisePost[] }>({
    queryKey: ["/api/praise/my-badges"],
    queryFn: () => safeJson("/api/praise/my-badges", { posts: [] }),
    enabled: isAuthenticated,
  });

  const { data: holidays } = useQuery<Array<{ id: string; name: string; date: string; type: string; isOptional: boolean }>>({
    queryKey: ["/api/hr/holidays", { year: currentYear }],
    enabled: isAuthenticated,
  });

  const { data: regionalSelections } = useQuery<Array<{ id: string; holidayId: string }>>({
    queryKey: ["/api/hr/regional-holiday-selections", { year: currentYear }],
    enabled: isAuthenticated,
  });

  const { data: teamTodayData } = useQuery<{
    presentCount: number; absentCount: number; onLeaveCount: number; totalCount: number;
  }>({
    queryKey: ["/api/hr/attendance/my-team/today-summary"],
    queryFn: async () => {
      const data = await safeJson<any>("/api/hr/attendance/my-team?date=" + todayStr, null);
      if (!data) return { presentCount: 0, absentCount: 0, onLeaveCount: 0, totalCount: 0 };
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
    },
    enabled: isAuthenticated && isManagerRole,
    refetchInterval: 60000,
  });

  const { data: pendingLeaveApprovalsCount } = useQuery<number>({
    queryKey: ["/api/hr/leave-requests/my-team", "pending"],
    queryFn: async () => {
      const data = await safeJson<any[]>("/api/hr/leave-requests/my-team?status=pending", []);
      return Array.isArray(data) ? data.length : 0;
    },
    enabled: isAuthenticated && isManagerRole,
    refetchInterval: 60000,
  });

  const { data: breakStatus } = useQuery<BreakStatus>({
    queryKey: ["/api/hr/attendance/breaks/today"],
    enabled: isAuthenticated && stats?.todayStatus === "punched_in",
    refetchInterval: 30000,
  });

  /* ── Mutations ── */
  const punchInMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/attendance/punch-in"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard-stats"] });
      toast({ title: "Punched In", description: "Your attendance has been recorded." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to punch in", variant: "destructive" }),
  });

  const punchOutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/attendance/punch-out"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard-stats"] });
      toast({ title: "Punched Out", description: "See you next shift!" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to punch out", variant: "destructive" }),
  });

  /* ── Live timer ── */
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

  /* ── Derived ── */
  const punchedIn = stats?.todayStatus === "punched_in";
  const dayComplete = stats?.todayStatus === "completed";
  const progressPct = Math.min(100, (liveMs / (TARGET_HOURS * 3600000)) * 100);

  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 17 ? "Good afternoon" : "Good evening";

  const getLeaveTypeName = (typeId: string) => leaveTypes?.find((lt) => lt.id === typeId)?.name || "Leave";
  const totalLeaveAvailable = (stats?.leaveBalances || []).reduce(
    (sum, b) => sum + Math.max(0, parseFloat(b.totalDays) - parseFloat(b.usedDays)),
    0,
  );

  // Training compliance %
  const trainingPct = (() => {
    const list = assignments || [];
    if (list.length === 0) return null;
    const sum = list.reduce((s, a) => s + (a.status === "completed" ? 100 : a.progressPct || 0), 0);
    return Math.round(sum / list.length);
  })();

  const pendingPolicies = (policyRequests || []).filter((p) => p.status === "pending");
  const pendingReviews = (myReviews || []).filter((r) => r.status === "pending");

  const activeGoals = (goals || [])
    .filter((g) => g.status === "not_started" || g.status === "in_progress")
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, 4);

  // Upcoming holidays (next 7 days)
  const selectedRegionalIds = new Set(regionalSelections?.map((s) => s.holidayId) || []);
  const in7DaysStr = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  })();
  const upcomingHolidays = (holidays || [])
    .filter((h) => {
      if (h.date < todayStr || h.date > in7DaysStr) return false;
      if (h.type === "regional") return selectedRegionalIds.has(h.id);
      return true;
    })
    .slice(0, 4);

  // Follow-up items aggregation
  type FollowUp = { id: string; label: string; tone: "red" | "amber" | "navy"; onClick: () => void };
  const followUps: FollowUp[] = [];
  if ((trainingAlerts?.overdue ?? 0) > 0) {
    followUps.push({
      id: "training-overdue",
      label: `${trainingAlerts!.overdue} training track${trainingAlerts!.overdue === 1 ? "" : "s"} overdue`,
      tone: "red",
      onClick: () => setLocation("/admin/growth?tab=training"),
    });
  }
  if ((trainingAlerts?.dueSoon ?? 0) > 0) {
    followUps.push({
      id: "training-due",
      label: `${trainingAlerts!.dueSoon} training track${trainingAlerts!.dueSoon === 1 ? "" : "s"} due soon`,
      tone: "amber",
      onClick: () => setLocation("/admin/growth?tab=training"),
    });
  }
  pendingPolicies.forEach((p) => {
    followUps.push({
      id: `policy-${p.requestId}`,
      label: `Sign policy: ${p.policyTitle}`,
      tone: "amber",
      onClick: () => setLocation(`/admin/hr/documents/policy/${p.requestId}`),
    });
  });
  if (pendingReviews.length > 0) {
    followUps.push({
      id: "reviews",
      label: `${pendingReviews.length} performance review${pendingReviews.length === 1 ? "" : "s"} to complete`,
      tone: "navy",
      onClick: () => setLocation("/admin/performance/reviews"),
    });
  }
  (pendingAddendums || []).forEach((a) => {
    const typeLabel = a.addendumType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    followUps.push({
      id: `addendum-${a.id}`,
      label: `Amendment letter awaiting your acceptance: ${typeLabel}`,
      tone: "amber",
      onClick: () => window.open(`/addendum/${a.token}`, "_blank"),
    });
  });

  const recentPraise = (praiseBoard?.posts || []).slice(0, 4);
  const myBadgeCount = myBadges?.posts?.length ?? 0;

  return (
    <div className="space-y-5" data-testid="command-center-v2">
      {/* ── Hero banner ── */}
      <div
        className="relative overflow-hidden rounded-2xl px-6 py-5 text-white shadow-sm"
        style={{ background: `linear-gradient(120deg, ${NAVY} 0%, #16294d 55%, #F47C20 160%)` }}
        data-testid="ccv2-hero"
      >
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-white/70">Command Center</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight" data-testid="ccv2-greeting">
              {greeting}, {user?.firstName || "there"}
            </h1>
            <p className="mt-0.5 text-sm text-white/80">
              {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <Badge
              className="border-0 text-white"
              style={{ backgroundColor: dayComplete ? NAVY : punchedIn ? "#F47C20" : "rgba(255,255,255,0.2)" }}
              data-testid="ccv2-status-badge"
            >
              {dayComplete ? "✓ Day complete" : punchedIn ? "● On the clock" : "Not punched in"}
            </Badge>
            {(punchedIn || dayComplete) && (
              <span className="font-mono text-sm text-white/90">{formatElapsed(liveMs)}</span>
            )}
          </div>
        </div>
        <Sparkles className="absolute -right-4 -top-4 h-28 w-28 text-white/10" />
      </div>

      {/* ── Vital signs row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="ccv2-vitals">
        {/* Punch / attendance — prominent */}
        <Card className="col-span-2 shadow-sm border-border" data-testid="ccv2-punch-card">
          <CardContent className="p-4">
            {statsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex flex-col justify-center min-w-[110px]">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" style={{ color: NAVY }} />
                    Today
                  </span>
                  <span className="mt-1 text-3xl font-mono font-bold leading-none text-foreground" data-testid="ccv2-hours">
                    {(punchedIn || dayComplete) ? formatElapsed(liveMs) : "—h ——m"}
                  </span>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    {stats?.punchInTime
                      ? `In ${formatTime(stats.punchInTime)}${dayComplete && stats.punchOutTime ? ` · Out ${formatTime(stats.punchOutTime)}` : ""}`
                      : "Not punched in"}
                  </span>
                </div>
                <div className="flex-1 hidden sm:block">
                  <Progress value={(punchedIn || dayComplete) ? progressPct : 0} className="h-2" />
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>0h</span>
                    <span className={punchedIn ? "font-medium text-foreground" : ""}>
                      {(punchedIn || dayComplete) ? `${Math.round(progressPct)}% of ${TARGET_HOURS}h` : `${TARGET_HOURS}h target`}
                    </span>
                    <span>{TARGET_HOURS}h</span>
                  </div>
                </div>
                <div className="shrink-0">
                  {stats?.todayStatus === "not_punched" && (
                    <Button
                      className="h-10 px-5 font-semibold text-white"
                      style={{ backgroundColor: "#F47C20" }}
                      onClick={() => punchInMutation.mutate()}
                      disabled={punchInMutation.isPending}
                      data-testid="ccv2-button-punch-in"
                    >
                      <LogIn className="h-4 w-4 mr-1.5" />
                      {punchInMutation.isPending ? "Starting…" : "Punch In"}
                    </Button>
                  )}
                  {punchedIn && (
                    <Button
                      variant="secondary"
                      className="h-10 px-5 font-semibold"
                      onClick={() => punchOutMutation.mutate()}
                      disabled={punchOutMutation.isPending}
                      data-testid="ccv2-button-punch-out"
                    >
                      <LogOutIcon className="h-4 w-4 mr-1.5" />
                      {punchOutMutation.isPending ? "Wrapping up…" : "Punch Out"}
                    </Button>
                  )}
                  {dayComplete && (
                    <span className="text-sm font-medium" style={{ color: NAVY }}>✓ Recorded</span>
                  )}
                </div>
              </div>
            )}
            {punchedIn && (
              <div className="mt-3 border-t pt-3">
                <BreakChips breakStatus={breakStatus ?? null} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shift */}
        <StatTile
          icon={CalendarDays}
          label="My Shift"
          loading={shiftLoading}
          value={myShift ? myShift.displayLabel || myShift.name : "—"}
          hint={myShift ? `${myShift.istStart}–${myShift.istEnd} IST · ${myShift.scheduledHours}h` : "No shift assigned"}
          tone="navy"
          testId="ccv2-shift"
        />

        {/* Leave balance */}
        <StatTile
          icon={CalendarOff}
          label="Leave Balance"
          loading={statsLoading}
          value={`${totalLeaveAvailable}`}
          hint={
            stats?.leaveBalances && stats.leaveBalances.length > 0
              ? stats.leaveBalances
                  .slice(0, 3)
                  .map((b) => `${getLeaveTypeName(b.leaveTypeId).replace(/\s+leave$/i, "").slice(0, 2).toUpperCase()} ${Math.max(0, parseFloat(b.totalDays) - parseFloat(b.usedDays))}`)
                  .join(" · ")
              : "days available"
          }
          onClick={() => setLocation("/admin/my-desk?tab=leave-balance")}
          testId="ccv2-leave"
        />

        {/* Pending approvals (manager) or my pending requests (employee) */}
        {isManagerRole ? (
          <StatTile
            icon={FileCheck}
            label="Approvals"
            value={`${pendingLeaveApprovalsCount ?? 0}`}
            hint={(pendingLeaveApprovalsCount ?? 0) > 0 ? "leave requests to review" : "all clear"}
            tone={(pendingLeaveApprovalsCount ?? 0) > 0 ? "amber" : "default"}
            onClick={() => setLocation("/admin/hr/my-team?tab=leave-approvals")}
            testId="ccv2-approvals"
          />
        ) : null}

        {/* Pending attendance regularizations (manager/HR) */}
        {isManagerRole && (
          <StatTile
            icon={ClipboardList}
            label="Regularizations"
            value={`${pendingRegularizationCount ?? 0}`}
            hint={(pendingRegularizationCount ?? 0) > 0 ? "corrections to review" : "all clear"}
            tone={(pendingRegularizationCount ?? 0) > 0 ? "amber" : "default"}
            onClick={() => setLocation("/admin/hr/my-team?tab=corrections")}
            testId="ccv2-regularizations"
          />
        )}

        {!isManagerRole && (
          <StatTile
            icon={FileCheck}
            label="My Requests"
            loading={statsLoading}
            value={`${stats?.pendingLeaveRequests ?? 0}`}
            hint={(stats?.pendingLeaveRequests ?? 0) > 0 ? "leave requests pending" : "all clear"}
            tone={(stats?.pendingLeaveRequests ?? 0) > 0 ? "amber" : "default"}
            onClick={() => setLocation("/admin/my-desk?tab=leave-history")}
            testId="ccv2-my-requests"
          />
        )}

        {/* Training compliance */}
        <StatTile
          icon={GraduationCap}
          label="Training"
          value={trainingPct === null ? "—" : `${trainingPct}%`}
          hint={
            trainingPct === null
              ? "no tracks assigned"
              : (trainingAlerts?.overdue ?? 0) > 0
              ? `${trainingAlerts!.overdue} overdue`
              : "complete"
          }
          tone={(trainingAlerts?.overdue ?? 0) > 0 ? "amber" : "green"}
          onClick={() => setLocation("/admin/growth?tab=training")}
          testId="ccv2-training"
        />

        {/* Open tickets (resolver roles only) */}
        {isResolverRole && (
          <StatTile
            icon={LifeBuoy}
            label="Open Tickets"
            value={`${openTickets?.count ?? 0}`}
            hint="service desk"
            tone={(openTickets?.count ?? 0) > 0 ? "amber" : "default"}
            onClick={() => setLocation("/admin/service-desk")}
            testId="ccv2-tickets"
          />
        )}
      </div>

      {/* ── Working row: Goals + Follow-ups ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Productivity & Goals */}
        <Card className="lg:col-span-2 shadow-sm" data-testid="ccv2-goals-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Target className="h-4 w-4" style={{ color: NAVY }} />
                Productivity &amp; Goals
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLocation("/admin/performance/goals")} data-testid="ccv2-link-goals">
                View all <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {goalsLoading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : activeGoals.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground" data-testid="ccv2-goals-empty">
                <Target className="mx-auto mb-2 h-7 w-7 opacity-30" />
                No active goals yet.
              </div>
            ) : (
              activeGoals.map((g) => (
                <div key={g.id} className="space-y-1" data-testid={`ccv2-goal-${g.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground truncate">{g.title}</span>
                    <span className="shrink-0 text-xs font-mono text-muted-foreground">{g.progress ?? 0}%</span>
                  </div>
                  <Progress value={g.progress ?? 0} className="h-1.5" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Needs your review / follow-ups */}
        <Card className="shadow-sm" data-testid="ccv2-followups-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4" style={{ color: NAVY }} />
              Needs Your Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {followUps.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground" data-testid="ccv2-followups-empty">
                <ShieldCheck className="mx-auto mb-2 h-7 w-7 opacity-30" />
                You're all caught up.
              </div>
            ) : (
              followUps.map((f) => (
                <button
                  key={f.id}
                  onClick={f.onClick}
                  className="flex w-full items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-colors hover-elevate active-elevate-2"
                  data-testid={`ccv2-followup-${f.id}`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: f.tone === "red" ? "#F96D3E" : f.tone === "amber" ? "#F47C20" : NAVY }}
                  />
                  <span className="flex-1 text-foreground">{f.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Team Praise + (manager pulse / awareness) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Team Praise */}
        <Card className="lg:col-span-2 shadow-sm" data-testid="ccv2-praise-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Award className="h-4 w-4" style={{ color: NAVY }} />
                Team Praise
                {myBadgeCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px]" data-testid="ccv2-my-badge-count">
                    {myBadgeCount} received
                  </Badge>
                )}
              </CardTitle>
              <Button
                size="sm"
                className="h-7 text-xs text-white"
                style={{ backgroundColor: "#F47C20" }}
                onClick={() => setLocation("/admin/growth?tab=praise")}
                data-testid="ccv2-button-give-praise"
              >
                Give Praise
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {praiseLoading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : recentPraise.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground" data-testid="ccv2-praise-empty">
                <Award className="mx-auto mb-2 h-7 w-7 opacity-30" />
                No recognition yet — be the first to give praise.
              </div>
            ) : (
              recentPraise.map((p) => (
                <div key={p.id} className="flex items-start gap-3 rounded-lg border p-2.5" data-testid={`ccv2-praise-${p.id}`}>
                  <span className="text-lg leading-none" aria-hidden>{p.badgeType?.emoji || "🏅"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground">
                      <span className="font-semibold">{p.giverName || "Someone"}</span>
                      {" → "}
                      <span className="font-semibold">{p.recipientName || "a teammate"}</span>
                      {p.badgeType?.name && <span className="text-muted-foreground"> · {p.badgeType.name}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.message}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right column: manager team pulse OR awareness */}
        <div className="space-y-4">
          {isManagerRole && (teamTodayData?.totalCount ?? 0) > 0 && (
            <Card className="shadow-sm" style={{ borderColor: `${NAVY}40` }} data-testid="ccv2-team-pulse">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4" style={{ color: NAVY }} />
                    Your Team Today
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLocation("/admin/hr/my-team")} data-testid="ccv2-link-team">
                    Team <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg border bg-background p-2 text-center" data-testid="ccv2-team-present">
                    <p className="font-mono text-xl font-bold" style={{ color: NAVY }}>{teamTodayData!.presentCount}</p>
                    <p className="text-[10px] text-muted-foreground">Present</p>
                  </div>
                  <div className="rounded-lg border bg-background p-2 text-center" data-testid="ccv2-team-absent">
                    <p className="font-mono text-xl font-bold" style={{ color: "#F96D3E" }}>{teamTodayData!.absentCount}</p>
                    <p className="text-[10px] text-muted-foreground">Absent</p>
                  </div>
                  <div className="rounded-lg border bg-background p-2 text-center" data-testid="ccv2-team-leave">
                    <p className="font-mono text-xl font-bold text-muted-foreground">{teamTodayData!.onLeaveCount}</p>
                    <p className="text-[10px] text-muted-foreground">Leave</p>
                  </div>
                  <div className="rounded-lg border bg-background p-2 text-center" data-testid="ccv2-team-pending">
                    <p className="font-mono text-xl font-bold" style={{ color: "#F47C20" }}>{pendingLeaveApprovalsCount ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Awareness — upcoming holidays */}
          <Card className="shadow-sm" data-testid="ccv2-awareness-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="h-4 w-4" style={{ color: NAVY }} />
                Upcoming Holidays
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingHolidays.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground" data-testid="ccv2-holidays-empty">
                  None in the next 7 days.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {upcomingHolidays.map((h) => (
                    <div key={h.id} className="flex items-center gap-2" data-testid={`ccv2-holiday-${h.id}`}>
                      <span className="w-[46px] shrink-0 font-mono text-[11px] text-muted-foreground">
                        {new Date(h.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <span className="flex-1 truncate text-xs font-medium text-foreground">{h.name}</span>
                      {h.type === "regional" && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px]">Reg</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
