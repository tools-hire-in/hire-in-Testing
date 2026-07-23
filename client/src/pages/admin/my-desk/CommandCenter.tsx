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
  UtensilsCrossed,
  X,
  ChevronDown,
  Timer,
  AlertCircle,
  ClipboardCheck,
  ArrowRight,
  KeyRound,
  ShieldAlert,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import CeipalComplianceModal, { CeipalComplianceCard } from "@/components/admin/CeipalComplianceModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import OnboardingChecklist from "@/components/admin/OnboardingChecklist";
import RecruiterActivityWidget from "./RecruiterActivityWidget";
import CopilotPanel from "@/components/ceo/CopilotPanel";
import CompanyGoalStrip from "@/components/ceo/CompanyGoalStrip";
import RateIntelligenceCard from "@/components/ceo/RateIntelligenceCard";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const TARGET_HOURS = 9;

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

interface ComplianceCountdownItem {
  sopMasterId: string;
  sopCode: string;
  title: string;
  estimatedMinutes: number;
  daysUntilLockCalendar: number;
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
  complianceCountdown?: {
    active: boolean;
    workingDaysLeft: number;
    items: ComplianceCountdownItem[];
  };
}

interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  isConditional: boolean;
  carryForwardCap: number | null;
  occurrenceBased: boolean;
}

interface BreakRecord {
  id: string;
  breakType: "lunch" | "tea";
  startedAt: string;
  endedAt: string | null;
  durationMinutes: string | null;
}

export interface BreakStatus {
  breaks: BreakRecord[];
  totalMinutes: number;
  lunchMinutes: number;
  teaMinutes: number;
  activeBreak: BreakRecord | null;
  entitlement: { lunch: number; tea: number; teaCount: number; total: number };
  lunchCount: number;
  teaCount: number;
}

export default function CommandCenter() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [liveMs, setLiveMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lunchReminderDismissed, setLunchReminderDismissed] = useState(false);
  const [countdownDismissed, setCountdownDismissed] = useState(false);
  const [ceipalModalOpen, setCeipalModalOpen] = useState(false);

  // Check if Ceipal-eligible user has already answered today's checkpoint.
  // Always fetch — the backend returns promptEnabled:false for users without the flag.
  // isCeipalEligible is derived from the per-user flag, not from the system role.
  const { data: ceipalTodayStatus, isError: ceipalStatusError } = useQuery<{
    hasAnsweredToday: boolean;
    status: string | null;
    promptEnabled: boolean;
    consecutiveSkips: number;
  }>({
    queryKey: ["/api/ceipal/today-status"],
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  const isCeipalEligible = ceipalTodayStatus?.promptEnabled === true;

  useEffect(() => {
    if (ceipalStatusError) {
      console.warn("[Ceipal] Could not fetch today-status — modal will not auto-open");
      toast({ title: "Ceipal checkpoint unavailable", description: "Could not load your Ceipal status. The prompt will not appear until this resolves.", variant: "destructive" });
    }
  }, [ceipalStatusError]);

  // Open modal if ?ceipal=1 is in the URL (e.g. from morning reminder notification CTA)
  useEffect(() => {
    if (!isCeipalEligible) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("ceipal") === "1" && ceipalTodayStatus && !ceipalTodayStatus.hasAnsweredToday && ceipalTodayStatus.promptEnabled !== false) {
      setCeipalModalOpen(true);
      // Remove the query param without a page reload
      const url = new URL(window.location.href);
      url.searchParams.delete("ceipal");
      window.history.replaceState({}, "", url.toString());
    }
  }, [isCeipalEligible, ceipalTodayStatus]);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/hr/dashboard-stats"],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: myVaultAccess = [] } = useQuery<any[]>({
    queryKey: ["/api/my-vault-access"],
    enabled: isAuthenticated,
  });

  const { data: leaveTypes } = useQuery<LeaveType[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated,
  });

  const { data: pendingAddendums } = useQuery<{ id: string; token: string; addendumType: string; candidateName: string; effectiveDate: string | null }[]>({
    queryKey: ["/api/hr/tools/addendums/my-pending"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/hr/tools/addendums/my-pending", { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      } catch { return []; }
    },
    enabled: isAuthenticated,
    refetchInterval: 120000,
  });

  // Knowledge Hub: doc list + read paths for the Training card
  const { data: knowledgeDocs = [] } = useQuery<Array<{ id: string; path: string; title: string; assignedRoles: string[] }>>({
    queryKey: ["/api/admin/knowledge/docs"],
    enabled: isAuthenticated,
    staleTime: 300000,
  });

  const { data: knowledgeReadsData } = useQuery<{ readPaths: string[]; readCounts?: Record<string, number> }>({
    queryKey: ["/api/admin/knowledge/reads"],
    enabled: isAuthenticated,
    retry: false,
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
  const isManager = ["manager", "hr", "admin", "super_admin"].includes(user?.role || "");

  // My own manager obligations (manager_checkin_obligation / manager_coaching_obligation
  // where owner_id = me). Uses a dedicated endpoint so we don't conflate "my obligations"
  // with "my team's compliance breakdown" (/manager/:id/breakdown uses manager_id = me).
  const { data: myObligations } = useQuery<{
    totalControls: number;
    overdueCount: number;
    controls: Array<{ id: string; controlType: string; status: string; dueDate: string | null; requiredAction: string | null; escalationLevel: number }>;
  }>({
    queryKey: ["/api/governance/my-manager-obligations"],
    enabled: isAuthenticated && isManager,
    refetchInterval: 120000,
  });

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

  const { data: breakStatus } = useQuery<BreakStatus>({
    queryKey: ["/api/hr/attendance/breaks/today"],
    enabled: isAuthenticated && stats?.todayStatus === "punched_in",
    refetchInterval: 30000,
  });

  const { data: probationCheckInsData } = useQuery<{
    checkIns: Array<{
      id: string;
      employeeName: string;
      scheduledDate: string;
      status: string;
      isProbation?: boolean;
      isOverdue?: boolean;
      requiresScores?: boolean;
      milestoneDay?: number | null;
    }>;
  }>({
    queryKey: ["/api/performance/check-ins"],
    enabled: isAuthenticated && isManagerRole,
    refetchInterval: 120000,
  });

  const probationOpen = (probationCheckInsData?.checkIns || []).filter(
    (c) => c.isProbation && c.status !== "completed" && c.status !== "cancelled",
  );
  const probationOverdue = probationOpen
    .filter((c) => c.isOverdue)
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  const probationUpcoming = probationOpen
    .filter((c) => !c.isOverdue)
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
    .slice(0, 3);

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
      // Show Ceipal checkpoint for eligible roles who haven't answered today
      if (isCeipalEligible && ceipalTodayStatus?.promptEnabled !== false && !ceipalTodayStatus?.hasAnsweredToday) {
        setTimeout(() => setCeipalModalOpen(true), 600);
      }
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

  const progressColor = hoursWorked >= TARGET_HOURS + 0.5
    ? "bg-amber-500"
    : hoursWorked >= TARGET_HOURS
    ? "bg-green-500"
    : "bg-blue-500";

  const showLunchReminder = punchedIn && !lunchReminderDismissed && hoursWorked >= 5;

  const selectedRegionalIds = new Set(regionalSelections?.map(s => s.holidayId) || []);
  const in7DaysStr = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  })();
  const upcomingHolidays = holidays
    ?.filter(h => {
      if (h.date < todayStr) return false;
      if (h.date > in7DaysStr) return false;
      if (h.type === "regional") return selectedRegionalIds.has(h.id);
      return true;
    })
    .slice(0, 2) || [];

  const getLeaveTypeName = (typeId: string) => leaveTypes?.find(lt => lt.id === typeId)?.name || "Leave";

  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4" data-testid="command-center-bento">
      {/* Ceipal compliance modal (recruiter-only, shown after punch-out) */}
      <CeipalComplianceModal
        open={ceipalModalOpen}
        onClose={() => setCeipalModalOpen(false)}
      />

      {/* CEO: Company Goal Strip — super_admin only */}
      <CompanyGoalStrip />

      {/* CEO: Rate Intelligence Dashboard — super_admin only */}
      <RateIntelligenceCard />

      {/* Greeting */}
      <div>
        <h2 className="text-xl font-semibold" data-testid="text-cc-greeting">
          {greeting}, {user?.firstName || "there"} 👋
        </h2>
        <p className="text-sm text-muted-foreground">
          {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Pending addendum signature alert */}
      {(pendingAddendums?.length ?? 0) > 0 && (pendingAddendums || []).map((a) => {
        const typeLabel = a.addendumType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return (
          <Alert
            key={a.id}
            className="flex items-center justify-between gap-4 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700"
            data-testid={`cc-addendum-alert-${a.id}`}
          >
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 shrink-0 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                You have an amendment letter to sign: <strong>{typeLabel}</strong>
              </AlertDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/addendum/${a.token}`, "_blank")}
              className="shrink-0"
              data-testid={`cc-link-sign-addendum-${a.id}`}
            >
              Review &amp; Sign
            </Button>
          </Alert>
        );
      })}

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

      {/* Compliance countdown banner */}
      {(() => {
        const cd = stats?.complianceCountdown;
        if (!cd?.active) return null;
        const wdLeft = cd.workingDaysLeft;
        // Dismissable at 5 or 4 working days; non-dismissable at ≤ 3
        const isDismissable = wdLeft >= 4;
        if (isDismissable && countdownDismissed) return null;

        const isCritical = wdLeft <= 1;
        const isUrgent = wdLeft <= 3;
        const colorClass = isCritical
          ? "border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-700"
          : isUrgent
          ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700"
          : "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700";
        const textClass = isCritical
          ? "text-red-800 dark:text-red-200"
          : isUrgent
          ? "text-orange-800 dark:text-orange-200"
          : "text-amber-800 dark:text-amber-200";
        const iconClass = isCritical
          ? "text-red-600"
          : isUrgent
          ? "text-orange-600"
          : "text-amber-600";
        const sopCode = cd.items[0]?.sopCode ?? "";
        const totalItems = cd.items.length;
        const moreText = totalItems > 1 ? ` (+${totalItems - 1} more)` : "";
        const wdWord = wdLeft === 1 ? "working day" : "working days";
        const label = wdLeft === 0 ? "Today is the last day" : `${wdLeft} ${wdWord} left`;

        return (
          <Alert
            className={`flex items-center justify-between gap-4 ${colorClass}`}
            data-testid="cc-compliance-countdown-banner"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <ShieldAlert className={`h-5 w-5 shrink-0 ${iconClass}`} />
              <AlertDescription className={`${textClass} text-xs leading-snug`}>
                <strong>{label}</strong> to acknowledge SOP{totalItems > 1 ? "s" : ""}{sopCode ? ` (${sopCode}${moreText})` : moreText}. After that, portal access is restricted until complete.
                <button
                  onClick={() => setLocation("/admin/my-desk?tab=my-sops")}
                  className={`ml-2 underline underline-offset-2 font-medium ${textClass}`}
                  data-testid="cc-compliance-countdown-cta"
                >
                  Acknowledge now →
                </button>
              </AlertDescription>
            </div>
            {isDismissable && (
              <Button
                size="sm"
                variant="ghost"
                className={`h-7 w-7 p-0 shrink-0 ${iconClass}`}
                onClick={() => setCountdownDismissed(true)}
                data-testid="cc-dismiss-compliance-countdown"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </Alert>
        );
      })()}

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

      {/* ── Compact Time Card strip ── */}
      <Card className="border shadow-sm" data-testid="cc-punch-card">
        <CardContent className="px-4 py-3">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex items-center gap-4 min-h-[64px]">
              {/* Left: elapsed time + punch-in timestamp */}
              <div className="flex flex-col justify-center min-w-[100px]">
                <span
                  className={`text-2xl font-mono font-bold tracking-tight leading-none ${punchedIn ? "text-foreground" : "text-muted-foreground"}`}
                  data-testid="cc-hours-worked"
                >
                  {(punchedIn || dayComplete) ? formatElapsed(liveMs) : "—h ——m"}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  {stats?.punchInTime
                    ? `In: ${formatTime(stats.punchInTime)}${dayComplete && stats.punchOutTime ? ` · Out: ${formatTime(stats.punchOutTime)}` : ""}`
                    : "Not punched in"}
                </span>
              </div>

              {/* Center: slim progress bar + label */}
              <div className="flex-1 space-y-1 hidden sm:block">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  {(punchedIn || dayComplete) && (
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                      style={{ width: `${progressPct}%` }}
                      data-testid="cc-progress-bar"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>0h</span>
                  <span className={punchedIn ? "text-foreground font-medium" : ""}>
                    {(punchedIn || dayComplete) ? `${Math.round(progressPct)}% of ${TARGET_HOURS}h` : `${TARGET_HOURS}h target`}
                  </span>
                  <span>{TARGET_HOURS}h</span>
                </div>
              </div>

              {/* Right: status badge + action button */}
              <div className="flex items-center gap-2 shrink-0">
                {!isLoading && (
                  <Badge
                    variant={dayComplete ? "default" : punchedIn ? "secondary" : "outline"}
                    className="hidden md:inline-flex text-xs"
                    data-testid="cc-punch-status-badge"
                  >
                    {dayComplete ? "✓ Done" : punchedIn ? "● Working" : "Not In"}
                  </Badge>
                )}
                {stats?.todayStatus === "not_punched" && (
                  <Button
                    size="sm"
                    className="h-8 px-4 text-sm font-semibold"
                    onClick={() => punchInMutation.mutate()}
                    disabled={punchInMutation.isPending}
                    data-testid="cc-button-punch-in"
                  >
                    <LogIn className="h-4 w-4 mr-1.5" />
                    {punchInMutation.isPending ? "Starting…" : "Punch In"}
                  </Button>
                )}
                {stats?.todayStatus === "punched_in" && (
                  <Button
                    size="sm"
                    className="h-8 px-4 text-sm font-semibold"
                    variant="secondary"
                    onClick={() => punchOutMutation.mutate()}
                    disabled={punchOutMutation.isPending}
                    data-testid="cc-button-punch-out"
                  >
                    <LogOutIcon className="h-4 w-4 mr-1.5" />
                    {punchOutMutation.isPending ? "Wrapping up…" : "Punch Out"}
                  </Button>
                )}
                {stats?.todayStatus === "completed" && (
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Recorded</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Inline break chips (only when punched in) ── */}
      {punchedIn && (
        <BreakChips breakStatus={breakStatus ?? null} />
      )}

      {/* ── Guided onboarding checklist (non-blocking; hides when complete) ── */}
      <OnboardingChecklist />

      {/* ── Your Training card ── */}
      {(() => {
        const totalCount = knowledgeDocs.length;
        const readSet = new Set(knowledgeReadsData?.readPaths ?? []);
        const readCount = knowledgeDocs.filter((d) => readSet.has(d.path)).length;
        const unreadCount = totalCount - readCount;
        const progressPct = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;
        const allDone = totalCount > 0 && readCount === totalCount;
        if (totalCount === 0) return null;
        return (
          <Card
            className={`shadow-sm cursor-pointer transition-colors hover:bg-muted/30 ${allDone ? "border-green-200 bg-green-50/40 dark:bg-green-950/20 dark:border-green-800" : ""}`}
            data-testid="cc-training-docs-card"
            onClick={() => setLocation("/admin/knowledge-hub")}
          >
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {allDone
                    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                    : <BookOpen className="h-4 w-4 text-primary" />
                  }
                  <CardTitle className="text-sm font-semibold">
                    {allDone ? "Training Docs" : "Your Training"}
                  </CardTitle>
                  {!allDone && unreadCount > 0 && (
                    <span
                      className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1"
                      data-testid="cc-training-unread-badge"
                    >
                      {unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground" data-testid="cc-training-progress-text">
                  {readCount} / {totalCount} read
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              {allDone ? (
                <p className="text-xs text-green-700 dark:text-green-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  All caught up — you've read all your training docs
                </p>
              ) : (
                <>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                      data-testid="cc-training-progress-bar"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {unreadCount} unread doc{unreadCount === 1 ? "" : "s"} — tap to open Training Docs
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Smart action cards row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Leave balance */}
        <Card data-testid="cc-leave-balance-card" className="shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Leave Balance</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : stats?.leaveBalances && stats.leaveBalances.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {stats.leaveBalances.slice(0, 3).map((bal) => {
                    const total = parseFloat(bal.totalDays);
                    const used = parseFloat(bal.usedDays);
                    const available = Math.max(0, total - used);
                    const name = getLeaveTypeName(bal.leaveTypeId);
                    const shortName = name.replace(/\s+leave$/i, "").slice(0, 2).toUpperCase();
                    return (
                      <div
                        key={bal.id}
                        className="flex flex-col items-center bg-muted/50 rounded-lg px-3 py-1.5 min-w-[52px]"
                        data-testid={`cc-leave-bal-${bal.leaveTypeId}`}
                      >
                        <span className="text-lg font-bold font-mono leading-none text-foreground">{available}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{shortName}</span>
                      </div>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs h-7 text-muted-foreground"
                  onClick={() => setLocation("/admin/my-desk?tab=apply-leave")}
                  data-testid="cc-link-view-leaves"
                >
                  + Apply Leave
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-2">No leave data</p>
            )}
          </CardContent>
        </Card>

        {/* Pending items */}
        <Card data-testid="cc-open-requests-card" className="shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending Items</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-3xl font-bold font-mono leading-none ${(stats?.pendingLeaveRequests ?? 0) > 0 ? "text-amber-600" : "text-muted-foreground/40"}`}
                    data-testid="cc-pending-leaves-count"
                  >
                    {stats?.pendingLeaveRequests ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(stats?.pendingLeaveRequests ?? 0) === 1 ? "leave request" : "leave requests"} pending
                  </span>
                </div>
                {(stats?.pendingLeaveRequests ?? 0) > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-7 text-muted-foreground"
                    onClick={() => setLocation("/admin/my-desk?tab=leave-history")}
                    data-testid="cc-link-view-requests"
                  >
                    View History →
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">All clear ✓</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Vault Access */}
        <Card data-testid="cc-vault-access-card" className="shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              My Vault Access
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span
                  className={`text-3xl font-bold font-mono leading-none ${myVaultAccess.length > 0 ? "text-foreground" : "text-muted-foreground/40"}`}
                  data-testid="cc-vault-access-count"
                >
                  {myVaultAccess.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  {myVaultAccess.length === 1 ? "credential shared with you" : "credentials shared with you"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs h-7 text-muted-foreground"
                onClick={() => setLocation("/admin/vault")}
                data-testid="cc-link-vault-access"
              >
                Open Systems Vault →
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming holidays in next 7 days — hidden when none */}
        {upcomingHolidays.length > 0 && (
          <Card data-testid="cc-upcoming-card" className="shadow-sm">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-1.5">
              {upcomingHolidays.map((h) => (
                <div key={h.id} className="flex items-center gap-2" data-testid={`cc-holiday-${h.id}`}>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0 w-[44px]">
                    {new Date(h.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">{h.name}</span>
                  {h.type === "regional" && (
                    <Badge variant="outline" className="text-[9px] px-1 h-4 shrink-0">Reg</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Recruiter Daily Activity — recruiter/operations/manager roles ── */}
      <RecruiterActivityWidget />

      {/* ── Ceipal update compliance card (recruiter / operations / account_manager) ── */}
      {isCeipalEligible && <CeipalComplianceCard />}

      {/* ── Team Pulse — manager/HR/admin only ── */}
      {isManagerRole && teamTodayData && teamTodayData.totalCount > 0 && (
        <Card className="border-primary/20 bg-primary/5 shadow-sm" data-testid="cc-team-pulse">
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

      {/* ── My Governance Obligations — manager/HR/admin only, shown when overdue ── */}
      {isManager && (myObligations?.overdueCount ?? 0) > 0 && (
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800 shadow-sm" data-testid="cc-mgr-obligations-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                <CardTitle className="text-sm font-semibold text-red-800 dark:text-red-300">
                  Your Governance Obligations
                </CardTitle>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-red-700 dark:text-red-400"
                onClick={() => setLocation("/admin/hr/my-team?tab=plans")}
                data-testid="cc-link-mgr-obligations"
              >
                View Plans →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold font-mono leading-none text-red-700 dark:text-red-400" data-testid="cc-mgr-obligations-overdue-count">
                {myObligations?.overdueCount}
              </span>
              <span className="text-xs text-red-700 dark:text-red-400">
                {myObligations?.overdueCount === 1 ? "coaching obligation" : "coaching obligations"} overdue — log a coaching note to clear
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Probation action items — manager/HR/admin only ── */}
      {isManagerRole && probationOpen.length > 0 && (
        <Card className="border-primary/20 shadow-sm" data-testid="cc-probation-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Probation Check-Ins</CardTitle>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setLocation("/admin/performance/check-ins")} data-testid="cc-link-probation-checkins">
                View all →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {probationOverdue.length > 0 && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-2.5 space-y-1.5" data-testid="cc-probation-overdue">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {probationOverdue.length} overdue
                </div>
                {probationOverdue.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setLocation("/admin/performance/check-ins")}
                    className="flex items-center justify-between w-full text-left text-xs hover:underline"
                    data-testid={`cc-probation-overdue-${c.id}`}
                  >
                    <span>
                      {c.employeeName}
                      {c.requiresScores ? ` · Day ${c.milestoneDay} milestone` : ""}
                    </span>
                    <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                      {new Date(c.scheduledDate).toLocaleDateString()}
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            )}
            {probationUpcoming.length > 0 && (
              <div className="space-y-1.5" data-testid="cc-probation-upcoming">
                <p className="text-xs font-medium text-muted-foreground">Upcoming</p>
                {probationUpcoming.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setLocation("/admin/performance/check-ins")}
                    className="flex items-center justify-between w-full text-left text-xs hover:underline"
                    data-testid={`cc-probation-upcoming-${c.id}`}
                  >
                    <span>
                      {c.employeeName}
                      {c.requiresScores ? ` · Day ${c.milestoneDay} milestone` : ""}
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      {new Date(c.scheduledDate).toLocaleDateString()}
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CEO Copilot — fixed right-side panel, super_admin only */}
      <CopilotPanel />
    </div>
  );
}

/* ── Inline break chips with Popover ── */
export function BreakChips({ breakStatus }: { breakStatus: BreakStatus | null }) {
  const { toast } = useToast();
  const [lunchOpen, setLunchOpen] = useState(false);
  const [teaOpen, setTeaOpen] = useState(false);
  const [breakElapsed, setBreakElapsed] = useState("0:00");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const active = breakStatus?.activeBreak ?? null;
  const lunchCount = breakStatus?.lunchCount ?? 0;
  const teaCount = breakStatus?.teaCount ?? 0;
  const lunchDone = lunchCount >= 1;
  const teaDone = teaCount >= 2;

  useEffect(() => {
    if (active?.startedAt) {
      const tick = () => {
        const elapsed = Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 1000);
        const m = Math.floor(elapsed / 60);
        const s = elapsed % 60;
        setBreakElapsed(`${m}:${String(s).padStart(2, "0")}`);
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setBreakElapsed("0:00");
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active?.id]);

  const startBreak = useMutation({
    mutationFn: (breakType: "lunch" | "tea") => apiRequest("POST", "/api/hr/attendance/breaks/start", { breakType }),
    onSuccess: (_, breakType) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/breaks/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard-stats"] });
      setLunchOpen(false);
      setTeaOpen(false);
      toast({ title: `${breakType === "lunch" ? "Lunch" : "Tea"} break started` });
    },
    onError: (err: any) => {
      toast({ title: "Can't start break", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const endBreak = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/attendance/breaks/end"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/breaks/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard-stats"] });
      setLunchOpen(false);
      setTeaOpen(false);
      if (data?.exceeded) {
        toast({ title: "Break ended — slightly over", description: `${data.durationMinutes} min taken (policy: ${data.allocated} min).` });
      } else {
        toast({ title: "Break ended", description: "Welcome back!" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const activeIsLunch = active?.breakType === "lunch";
  const activeIsTea = active?.breakType === "tea";
  const elapsedMin = active ? (Date.now() - new Date(active.startedAt).getTime()) / 60000 : 0;
  const allocated = active ? (activeIsLunch ? 30 : 15) : 0;
  const isOver = active && elapsedMin > allocated;

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="cc-break-chips">
      {/* Lunch chip */}
      <Popover open={lunchOpen} onOpenChange={setLunchOpen}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer
              ${activeIsLunch
                ? isOver ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-400"
                         : "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-400"
                : lunchDone ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-950/30 dark:border-green-700 dark:text-green-400"
                            : "bg-muted border-border text-muted-foreground hover:border-foreground/30"
              }`}
            data-testid="cc-chip-lunch"
          >
            <UtensilsCrossed className="h-3 w-3" />
            {activeIsLunch
              ? <><Timer className="h-3 w-3" />{breakElapsed}</>
              : lunchDone ? "Lunch ✓"
              : "Lunch · not taken"
            }
            {!lunchDone && !activeIsLunch && <ChevronDown className="h-3 w-3 opacity-50" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3 space-y-2" align="start" data-testid="cc-popover-lunch">
          <p className="text-xs font-semibold">Lunch Break <span className="text-muted-foreground font-normal">(up to 30 min)</span></p>
          {lunchDone && !activeIsLunch && (
            <p className="text-xs text-muted-foreground">Lunch already taken today.</p>
          )}
          {activeIsLunch && (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                <span className={`font-mono ${isOver ? "text-red-600" : ""}`}>{breakElapsed}</span>
                {isOver && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
              </div>
              <Button
                size="sm"
                variant={isOver ? "destructive" : "default"}
                className="w-full h-7 text-xs"
                onClick={() => endBreak.mutate()}
                disabled={endBreak.isPending}
                data-testid="cc-button-end-lunch"
              >
                {endBreak.isPending ? "Ending…" : "End Lunch Break"}
              </Button>
            </>
          )}
          {!lunchDone && !active && (
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => startBreak.mutate("lunch")}
              disabled={startBreak.isPending}
              data-testid="cc-button-start-lunch"
            >
              {startBreak.isPending ? "Starting…" : "Start Lunch Break"}
            </Button>
          )}
          {!lunchDone && activeIsTea && (
            <p className="text-xs text-muted-foreground">End your tea break first.</p>
          )}
        </PopoverContent>
      </Popover>

      {/* Tea chip */}
      <Popover open={teaOpen} onOpenChange={setTeaOpen}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer
              ${activeIsTea
                ? isOver ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-400"
                         : "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-400"
                : teaDone ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-950/30 dark:border-green-700 dark:text-green-400"
                : teaCount > 0 ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400"
                              : "bg-muted border-border text-muted-foreground hover:border-foreground/30"
              }`}
            data-testid="cc-chip-tea"
          >
            <Coffee className="h-3 w-3" />
            {activeIsTea
              ? <><Timer className="h-3 w-3" />{breakElapsed}</>
              : teaDone ? `Tea ✓ (${teaCount}/2)`
              : `Tea · ${teaCount}/2`
            }
            {!teaDone && !activeIsTea && <ChevronDown className="h-3 w-3 opacity-50" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3 space-y-2" align="start" data-testid="cc-popover-tea">
          <p className="text-xs font-semibold">Tea Break <span className="text-muted-foreground font-normal">(up to 15 min · {teaCount}/2 used)</span></p>
          {teaDone && !activeIsTea && (
            <p className="text-xs text-muted-foreground">Both tea breaks taken today.</p>
          )}
          {activeIsTea && (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                <span className={`font-mono ${isOver ? "text-red-600" : ""}`}>{breakElapsed}</span>
                {isOver && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
              </div>
              <Button
                size="sm"
                variant={isOver ? "destructive" : "default"}
                className="w-full h-7 text-xs"
                onClick={() => endBreak.mutate()}
                disabled={endBreak.isPending}
                data-testid="cc-button-end-tea"
              >
                {endBreak.isPending ? "Ending…" : "End Tea Break"}
              </Button>
            </>
          )}
          {!teaDone && !active && (
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => startBreak.mutate("tea")}
              disabled={startBreak.isPending}
              data-testid="cc-button-start-tea"
            >
              {startBreak.isPending ? "Starting…" : "Start Tea Break"}
            </Button>
          )}
          {!teaDone && activeIsLunch && (
            <p className="text-xs text-muted-foreground">End your lunch break first.</p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
