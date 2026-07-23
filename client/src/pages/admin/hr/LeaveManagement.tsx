import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CalendarCheck, Loader2, Plus, AlertTriangle, CheckCircle2, Clock, XCircle,
  TrendingUp, FileText, AlertCircle, Info
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LeaveBalanceCard } from "@/components/hr/leave-balance-card";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface LeaveRequest {
  id: string;
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  halfDay: boolean;
  halfDayPart: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewComment: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  monthlyAccrual: string;
  isActive: boolean;
  isConditional: boolean;
  carryForwardCap: number | null;
  occurrenceBased: boolean;
}

interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  totalDays: string;
  usedDays: string;
  year: number;
}

interface LeaveAccrual {
  id: string;
  leaveTypeId: string;
  year: number;
  month: number;
  accruedDays: string;
  hoursWorked: string;
  qualified: boolean;
  accrualType: string;
  skipReason: string | null;
  createdAt: string;
}

interface NightShiftConsent {
  required: boolean;
  status?: "not_signed" | "valid" | "expired";
  signedAt?: string;
  expiresAt?: string;
  daysToExpiry?: number;
  shiftName?: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EL_BONUS_MONTHS = [1, 5, 9];
const COMP_OFF_EXPIRY_DAYS = 90;

function getStatusIcon(status: LeaveRequest["status"]) {
  switch (status) {
    case "approved": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "rejected": return <XCircle className="h-4 w-4 text-red-500" />;
    case "cancelled": return <XCircle className="h-4 w-4 text-muted-foreground" />;
    default: return <Clock className="h-4 w-4 text-amber-500" />;
  }
}

function getStatusBadge(status: LeaveRequest["status"]) {
  const variants: Record<string, string> = {
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };
  return (
    <Badge className={variants[status] || variants.pending}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function formatExpiry(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const TAB_LABELS: Record<string, string> = {
  balance: "Balance",
  apply: "Apply Leave",
  history: "History",
  accrual: "Accrual",
};

const INNER_TO_DESK: Record<string, string> = {
  balance: "leave-balance",
  apply: "apply-leave",
  history: "leave-history",
  accrual: "accrual",
};

export default function LeaveManagement({ view }: { view?: "balance" | "apply" | "history" | "accrual" } = {}) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  // When embedded in My Desk, the parent provides a single-level `view`; this page
  // then renders exactly one section without its own (nested) tab bar, and any
  // cross-section navigation is promoted to the parent's `?tab=` router.
  const embedded = view !== undefined;
  const [activeTab, setActiveTab] = useState(view ?? "balance");
  const goTab = (t: "balance" | "apply" | "history" | "accrual") => {
    if (embedded) setLocation(`/admin/my-desk?tab=${INNER_TO_DESK[t] ?? t}`);
    else setActiveTab(t);
  };

  const applyFormInit = {
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
    halfDay: false,
    halfDayPart: "first",
  };
  const [applyForm, setApplyForm] = useState(applyFormInit);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReasonText, setOtherReasonText] = useState("");
  const [lwpWarning, setLwpWarning] = useState<string | null>(null);
  const [splitPaidDays, setSplitPaidDays] = useState<number | null>(null);

  const { data: myLeaves, isLoading: leavesLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/hr/leave-requests/my"],
    enabled: isAuthenticated,
  });

  const { data: leaveTypes, isLoading: ltLoading } = useQuery<LeaveType[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated,
  });

  const { data: balances, isLoading: balancesLoading } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/hr/leave-balances/my", selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/hr/leave-balances/my?year=${selectedYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: accruals, isLoading: accrualsLoading } = useQuery<LeaveAccrual[]>({
    queryKey: ["/api/hr/leave-accruals/my", selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/hr/leave-accruals/my?year=${selectedYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: probationStatus } = useQuery<{
    active: boolean;
    reason: string;
    probationEndDate: string | null;
    confirmed: boolean;
    overdue: boolean;
    probationMonths: number;
  }>({
    queryKey: ["/api/hr/probation-status/my"],
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const { data: nightShiftConsent } = useQuery<NightShiftConsent>({
    queryKey: ["/api/onboarding/night-shift-consent/status"],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: myShiftData } = useQuery<{
    name: string;
    istStart: string;
    istEnd: string;
  } | null>({
    queryKey: ["/api/hr/my-shift"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: holidays } = useQuery<{ id: string; date: string; name: string }[]>({
    queryKey: ["/api/hr/holidays"],
    enabled: isAuthenticated && activeTab === "apply",
    staleTime: 60 * 60 * 1000,
  });

  const { data: dayCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/hr/leave-days-count", applyForm.startDate, applyForm.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/hr/leave-days-count?startDate=${applyForm.startDate}&endDate=${applyForm.endDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!applyForm.startDate && !!applyForm.endDate && applyForm.startDate <= applyForm.endDate,
    staleTime: 30000,
  });

  const appliedDays = applyForm.halfDay ? 0.5 : (dayCountData?.count || 0);

  const applyMutation = useMutation({
    mutationFn: (data: typeof applyForm) => {
      const selectedLt = leaveTypes?.find(t => t.id === data.leaveTypeId);
      const bal = balances?.find(b => b.leaveTypeId === data.leaveTypeId);
      const available = bal ? Math.max(0, parseFloat(bal.totalDays) - parseFloat(bal.usedDays)) : 0;
      const balanceAfter = available - appliedDays;
      const isLWP = selectedLt && /lwp|loss.?of.?pay|unpaid/i.test(selectedLt.name);
      const isEML = selectedLt?.occurrenceBased;
      const hasSplit = !isLWP && !isEML && balanceAfter < 0 && available > 0 && splitPaidDays !== null;
      const reasonParts = selectedReason === "Other" || selectedReason === "Other emergency"
        ? [selectedReason, otherReasonText].filter(Boolean).join(": ")
        : selectedReason || data.reason || null;
      return apiRequest("POST", "/api/hr/leave-requests", {
        leaveTypeId: data.leaveTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: reasonParts,
        halfDay: data.halfDay,
        halfDayPart: data.halfDay ? data.halfDayPart : null,
        totalDays: isEML ? "1" : String(appliedDays),
        ...(hasSplit ? { splitPaidDays, splitLwpDays: appliedDays - (splitPaidDays ?? 0) } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-requests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balances/my"] });
      setApplyForm(applyFormInit);
      setSelectedReason("");
      setOtherReasonText("");
      setLwpWarning(null);
      setSplitPaidDays(null);
      goTab("history");
      toast({ title: "Leave Applied", description: "Your leave request has been submitted for approval." });
    },
    onError: async (err: unknown) => {
      const res = (err as { response?: Response })?.response;
      let msg = "Failed to submit leave request";
      if (res) {
        try { const json = await res.json(); msg = json.error || msg; } catch { /* noop */ }
      }
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/hr/leave-requests/${id}/cancel`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-requests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balances/my"] });
      toast({ title: "Cancelled", description: "Your leave request has been cancelled." });
    },
    onError: () => toast({ title: "Error", description: "Failed to cancel leave request", variant: "destructive" }),
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  // Check LWP warning when leave type changes; also reset reason
  useEffect(() => {
    setSelectedReason("");
    setOtherReasonText("");
    if (!applyForm.leaveTypeId || !leaveTypes || !balances) { setLwpWarning(null); return; }
    const lt = leaveTypes.find(t => t.id === applyForm.leaveTypeId);
    if (!lt || !/lwp|loss.?of.?pay|unpaid/i.test(lt.name)) { setLwpWarning(null); return; }
    const remaining = balances.reduce((sum, b) => {
      const blt = leaveTypes.find(t => t.id === b.leaveTypeId);
      if (!blt || /lwp|loss.?of.?pay|unpaid/i.test(blt.name) || blt.occurrenceBased) return sum;
      return sum + Math.max(0, parseFloat(b.totalDays) - parseFloat(b.usedDays));
    }, 0);
    setLwpWarning(
      remaining > 0
        ? `You have ${remaining.toFixed(1)} day(s) of EL/SL/Comp-Off remaining. LWP requires exhausting all other leave balances first.`
        : null
    );
  }, [applyForm.leaveTypeId, leaveTypes, balances]);

  function getLeaveCategory(lt: LeaveType): "el" | "sl" | "eml" | "lwp" | "co" | "other" {
    if (lt.occurrenceBased) return "eml";
    if (/lwp|loss.?of.?pay|unpaid/i.test(lt.name)) return "lwp";
    if (/comp.?off|compensatory/i.test(lt.name)) return "co";
    if (/sick|casual|cl/i.test(lt.name)) return "sl";
    if (/annual|earned|el\b/i.test(lt.name)) return "el";
    return "other";
  }

  const REASON_OPTIONS: Record<string, string[]> = {
    sl: ["Medical appointment", "Personal illness", "Family member illness", "Hospitalisation", "Other"],
    el: ["Vacation/travel", "Personal errand", "Family event", "Festival/celebration", "Other"],
    eml: ["Bereavement", "Family medical emergency", "Natural disaster/home emergency", "Legal obligation", "Other emergency"],
    lwp: ["Personal reasons (no paid leave remaining)"],
    co: ["Personal errand", "Family event", "Other"],
    other: ["Personal reasons", "Other"],
  };

  function getNoticePeriodWarning(lt: LeaveType, startDate: string, days: number): string | null {
    if (!startDate || days <= 0) return null;
    const category = getLeaveCategory(lt);
    if (category === "eml" || category === "lwp" || category === "co") return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate + "T00:00:00");
    const daysNotice = Math.round((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (category === "sl") {
      if (daysNotice < 1) return "Sick Leave requires at least 24 hours' advance notice where possible. Your manager's approval is required before you take this leave.";
      return null;
    }
    if (category === "el") {
      if (days <= 2 && daysNotice < 7) return "Earned Leave of 1–2 days requires at least 1 week's notice. Your manager's approval is required before you take this leave.";
      if (days >= 3 && days <= 7 && daysNotice < 14) return "Earned Leave of 3–7 days requires at least 2 weeks' notice. Your manager's approval is required before you take this leave.";
      if (days > 7 && daysNotice < 30) return "Earned Leave of more than 7 days requires at least 1 month's notice. Your manager's approval is required before you take this leave.";
      return null;
    }
    return null;
  }

  if (authLoading || !isAuthenticated) return null;

  const employeeId: string | undefined = user?.employeeId ?? undefined;
  const salary: string | undefined = user?.salary ?? undefined;

  function formatHHMMLeave(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  }

  const subtitleParts: string[] = [];
  if (employeeId) subtitleParts.push(employeeId);
  if (myShiftData?.name) {
    const timing = `${formatHHMMLeave(myShiftData.istStart)} – ${formatHHMMLeave(myShiftData.istEnd)} IST`;
    subtitleParts.push(`${myShiftData.name} · ${timing}`);
  }
  const headerSubtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : "Employee Leave Portal";

  const salaryNum = salary ? Number(salary) : NaN;
  const formattedCTC = Number.isFinite(salaryNum) ? `₹${salaryNum.toLocaleString("en-IN")}` : null;

  const activeLeaveTypes = (leaveTypes?.filter(lt => lt.isActive) || []).filter(lt => {
    if (/maternity/i.test(lt.name)) {
      return user?.maternityLeaveEligible === true;
    }
    if (/paternity/i.test(lt.name)) {
      return (user?.gender || "").toLowerCase() === "male";
    }
    return true;
  });
  const filteredLeaves = (myLeaves || []).filter(lr => {
    const year = parseInt(lr.startDate.split("-")[0]);
    return year === selectedYear;
  });

  const usedByType: Record<string, number> = {};
  filteredLeaves.filter(lr => lr.status === "approved").forEach(lr => {
    usedByType[lr.leaveTypeId] = (usedByType[lr.leaveTypeId] || 0) + parseFloat(lr.totalDays || "0");
  });

  const accruedByType: Record<string, number> = {};
  (accruals || []).forEach(a => {
    const days = parseFloat(a.accruedDays);
    if (days > 0) {
      accruedByType[a.leaveTypeId] = (accruedByType[a.leaveTypeId] || 0) + days;
    }
  });

  const compOffExpiryByType: Record<string, string> = {};
  if (myLeaves && leaveTypes) {
    activeLeaveTypes.forEach(lt => {
      if (!/comp.?off|compensatory/i.test(lt.name)) return;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - COMP_OFF_EXPIRY_DAYS);
      const compOffApprovals = (myLeaves || [])
        .filter(lr => lr.leaveTypeId === lt.id && lr.status === "approved" && lr.reviewedAt)
        .map(lr => ({ reviewedAt: new Date(lr.reviewedAt!) }))
        .filter(r => r.reviewedAt >= cutoff)
        .sort((a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime());
      if (compOffApprovals.length > 0) {
        const earliest = compOffApprovals[0].reviewedAt;
        const expiryDate = new Date(earliest);
        expiryDate.setDate(expiryDate.getDate() + COMP_OFF_EXPIRY_DAYS);
        compOffExpiryByType[lt.id] = formatExpiry(expiryDate);
      }
    });
  }

  const elTypes = activeLeaveTypes.filter(lt => lt.isConditional);
  const slTypes = activeLeaveTypes.filter(lt => !lt.isConditional && !/lwp|loss.?of.?pay/i.test(lt.name) && !lt.occurrenceBased);

  const getAccrualForTypeMonth = (leaveTypeId: string, month: number) =>
    accruals?.find(a => a.leaveTypeId === leaveTypeId && a.month === month && a.year === selectedYear);

  const now = new Date();
  const nextAccrualDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextAccrualDateStr = nextAccrualDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const nextMonth = nextAccrualDate.getMonth() + 1;

  const lapsingTypes = activeLeaveTypes.filter(lt => {
    const isSL = !lt.isConditional && !/lwp|loss.?of.?pay/i.test(lt.name) && !/comp.?off|compensatory/i.test(lt.name) && !lt.occurrenceBased;
    if (!isSL) return false;
    const balance = balances?.find(b => b.leaveTypeId === lt.id);
    const available = Math.max(0, parseFloat(balance?.totalDays || "0") - parseFloat(balance?.usedDays || "0"));
    return available > 0;
  });

  return (
    <AdminLayout>
      <div className="space-y-5 max-w-4xl v2-surface">
        {/* Custom tab bar — year selector kept inline (name/CTC header removed; parent provides page context) */}
        <div>
          <div className={`flex items-center ${embedded ? "justify-end" : "justify-between border-b border-border"}`} data-testid="tabs-leave-management">
            {!embedded && (
              <div className="flex">
                {(["balance", "apply", "history", "accrual"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    data-testid={`tab-${tab}`}
                    className={
                      activeTab === tab
                        ? "px-4 py-2.5 text-sm font-semibold border border-b-0 border-border rounded-t-md -mb-px bg-background text-foreground"
                        : "px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    }
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>
            )}
            {(!embedded || activeTab === "balance" || activeTab === "accrual") && (
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-[100px] h-8 mb-1.5" data-testid="select-leave-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="pt-5">

            {/* BALANCE TAB */}
            {activeTab === "balance" && (
              <>
                {balancesLoading || ltLoading ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-44" />)}
                  </div>
                ) : activeLeaveTypes.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CalendarCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No leave types configured. Contact HR.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Probation notice banner */}
                    {probationStatus?.active && (
                      <Alert
                        className={`mb-4 ${probationStatus.overdue ? "border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700" : "border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700"}`}
                        data-testid="alert-probation-leave"
                      >
                        <AlertTriangle className={`h-4 w-4 ${probationStatus.overdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`} />
                        <AlertDescription className={`text-sm ${probationStatus.overdue ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
                          {probationStatus.overdue ? (
                            <>
                              <span className="font-semibold">Your probation period has ended but has not been confirmed by HR.</span>
                              {" "}Earned Leave (EL) and Sick Leave (SL) accrual remains paused until HR formally confirms your probation outcome. Please contact HR to resolve this.
                            </>
                          ) : (
                            <>
                              <span className="font-semibold">You are currently on probation.</span>
                              {" "}Earned Leave (EL) and Sick Leave (SL) do not accrue during the probation period
                              {probationStatus.probationEndDate ? ` (until ${new Date(probationStatus.probationEndDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })})` : ""}.
                              {" "}Leave may be applied as Loss of Pay (LWP) during this period. Contact HR if you have questions.
                            </>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeLeaveTypes.map(lt => {
                        const balance = balances?.find(b => b.leaveTypeId === lt.id);
                        const total = parseFloat(balance?.totalDays || "0");
                        const used = parseFloat(balance?.usedDays || "0");
                        const available = Math.max(0, total - used);
                        const isEML = lt.occurrenceBased;
                        const isEL = !isEML && lt.isConditional && (lt.carryForwardCap || 0) > 0;
                        const isSL = !isEML && !lt.isConditional && !/lwp|loss.?of.?pay|unpaid/i.test(lt.name) && !/comp.?off|compensatory/i.test(lt.name);
                        const isCompOff = !isEML && /comp.?off|compensatory/i.test(lt.name);
                        const isLWP = !isEML && /lwp|loss.?of.?pay|unpaid/i.test(lt.name);
                        const isCurrentBonusMonth = isEL && EL_BONUS_MONTHS.includes(now.getMonth() + 1);
                        const carryForwardWarning = isEL && (lt.carryForwardCap || 0) > 0 && available > (lt.carryForwardCap || 45);
                        const leaveTypeToken: "el" | "sl" | "co" | "default" = isEL ? "el" : isSL ? "sl" : isCompOff ? "co" : "default";
                        const accrued = !isLWP && !isEML ? (accruedByType[lt.id] ?? 0) : undefined;

                        let subtitle = "";
                        if (isEML) subtitle = "Emergency Leave · Max 3 uses/year";
                        else if (isEL) subtitle = `of ${lt.defaultDays}/year · Carry fwd: max ${lt.carryForwardCap || 45}`;
                        else if (isSL) subtitle = `of ${lt.defaultDays}/year · Lapses 31 Dec`;
                        else if (isCompOff) subtitle = "Expires within 90 days";
                        else if (isLWP) subtitle = "Loss of Pay";
                        else subtitle = `${lt.defaultDays} days/year`;

                        if (isEML) {
                          const usedCount = Math.round(used);
                          const remaining = Math.max(0, 3 - usedCount);
                          return (
                            <Card key={lt.id} className="relative overflow-hidden border-2 border-purple-200 dark:border-purple-800" data-testid={`balance-card-${lt.id}`}>
                              <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
                              <CardContent className="pt-5 pb-4 px-5 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{lt.name}</p>
                                    <p className="text-3xl font-mono font-bold text-purple-600 dark:text-purple-400 mt-1">{remaining}</p>
                                    <p className="text-xs text-muted-foreground">of 3 uses remaining</p>
                                  </div>
                                  <div className="flex gap-1 mt-1">
                                    {[0, 1, 2].map(i => (
                                      <div key={i} className={`w-3 h-3 rounded-full ${i < usedCount ? "bg-purple-400" : "bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-700"}`} />
                                    ))}
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2 mt-2">
                                  For bereavement, family medical emergencies, legal obligations, and home emergencies. Evidence may be requested.
                                </p>
                              </CardContent>
                            </Card>
                          );
                        }

                        return (
                          <LeaveBalanceCard
                            key={lt.id}
                            type={leaveTypeToken}
                            label={lt.name}
                            balance={available}
                            total={total}
                            used={used}
                            accrued={accrued}
                            subtitle={subtitle}
                            expiry={isCompOff ? compOffExpiryByType[lt.id] : undefined}
                            isCurrentBonusMonth={isCurrentBonusMonth}
                            showCarryForwardWarning={carryForwardWarning}
                            carryForwardCap={lt.carryForwardCap || 45}
                            data-testid={`balance-card-${lt.id}`}
                          />
                        );
                      })}
                    </div>

                    {/* Policy section */}
                    <Card className="mt-4 bg-muted/30 border-dashed">
                      <CardContent className="py-4 px-5 space-y-4">
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1">Leave Policy — Employee Responsibilities</p>
                          <ol className="text-xs text-muted-foreground leading-relaxed space-y-1 list-decimal ml-4">
                            <li>Employees must apply for planned leave as far in advance as possible.</li>
                            <li>It is the employee's responsibility to obtain approval before taking leave. Absence without prior approval may result in disciplinary action and Loss of Pay.</li>
                            <li>Unapproved absence may be treated as LWP regardless of available balance.</li>
                          </ol>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1">Minimum Notice Periods</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Sick Leave</span><span>24 hours' notice</span>
                            <span className="font-medium text-foreground">EL — 1–2 days</span><span>1 week (7 days)</span>
                            <span className="font-medium text-foreground">EL — 3–7 days</span><span>2 weeks (14 days)</span>
                            <span className="font-medium text-foreground">EL — more than 7 days</span><span>1 month (30 days)</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1">Emergency Leave (EML) — up to 3 occurrences/year</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Covers bereavement, family medical emergency, natural disaster or home emergency, and legal obligation.
                            Same-day notice is accepted; retrospective approval applies. Maximum 3 uses per year.
                            Management may request supporting evidence.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Lapse warning banner */}
                    {lapsingTypes.length > 0 && (
                      <Alert variant="warning" className="mt-4" data-testid="banner-lapse-warning">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          {lapsingTypes.map(lt => {
                            const bal = balances?.find(b => b.leaveTypeId === lt.id);
                            const available = Math.max(0, parseFloat(bal?.totalDays || "0") - parseFloat(bal?.usedDays || "0"));
                            const n = available % 1 === 0 ? available.toFixed(0) : available.toFixed(1);
                            return `${n} ${lt.name}`;
                          }).join(", ")} will lapse on 31 Dec {now.getFullYear()} if unused. Plan your leave accordingly.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Next accrual section */}
                    <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4" data-testid="section-next-accrual">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                        Next Accrual — {nextAccrualDateStr}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {activeLeaveTypes
                          .filter(lt => !lt.occurrenceBased && !(/lwp|loss.?of.?pay/i.test(lt.name)) && !(/comp.?off|compensatory/i.test(lt.name)))
                          .map(lt => {
                            const isEL = lt.isConditional && (lt.carryForwardCap || 0) > 0;
                            const isSL = !lt.isConditional;
                            const isELBonus = isEL && EL_BONUS_MONTHS.includes(nextMonth);
                            const days = isELBonus ? 2 : parseFloat(lt.monthlyAccrual || "1");
                            const chipColor = isEL
                              ? "bg-el/10 text-el border-el/20"
                              : isSL
                              ? "bg-sl/10 text-sl border-sl/20"
                              : "bg-primary/10 text-primary border-primary/20";
                            return (
                              <span
                                key={lt.id}
                                className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${chipColor}`}
                                data-testid={`chip-accrual-${lt.id}`}
                              >
                                +{days} {lt.name} ({isELBonus ? "bonus month" : "monthly"})
                              </span>
                            );
                          })}
                      </div>
                      {elTypes.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Bonus EL months: </span>
                          {MONTH_NAMES
                            .filter((_, i) => EL_BONUS_MONTHS.includes(i + 1))
                            .map((m, idx) => {
                              const monthNum = EL_BONUS_MONTHS[idx];
                              const done = monthNum <= now.getMonth() + 1 && selectedYear === currentYear;
                              return (
                                <span key={m} className="mr-2">
                                  {m}{" "}
                                  {done
                                    ? <span className="text-green-600 font-semibold">✓</span>
                                    : <span className="text-muted-foreground">○</span>}
                                </span>
                              );
                            })}
                        </p>
                      )}
                    </div>

                    {/* Full-width Apply CTA */}
                    <Button
                      className="w-full mt-4"
                      size="lg"
                      onClick={() => goTab("apply")}
                      data-testid="button-apply-leave-cta"
                    >
                      <CalendarCheck className="h-4 w-4 mr-2" />
                      Apply for Leave
                    </Button>
                  </>
                )}
              </>
            )}

            {/* APPLY LEAVE TAB */}
            {activeTab === "apply" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Apply for Leave
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Leave Type</Label>
                    {ltLoading ? <Skeleton className="h-10" /> : (
                      <div className="flex flex-wrap gap-2">
                        {activeLeaveTypes.map(lt => {
                          const bal = balances?.find(b => b.leaveTypeId === lt.id);
                          const avail = Math.max(0, parseFloat(bal?.totalDays || "0") - parseFloat(bal?.usedDays || "0"));
                          const isSelected = applyForm.leaveTypeId === lt.id;
                          const isLWP = /lwp|loss.?of.?pay|unpaid/i.test(lt.name);
                          const isEML = lt.occurrenceBased;
                          return (
                            <button
                              key={lt.id}
                              onClick={() => setApplyForm(prev => ({ ...prev, leaveTypeId: lt.id }))}
                              data-testid={`button-leave-type-${lt.id}`}
                              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                isSelected
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background hover:border-primary/40 text-foreground"
                              }`}
                            >
                              <span>{lt.name}</span>
                              {isEML && (
                                <span className={`ml-2 text-xs ${isSelected ? "text-primary/70" : "text-muted-foreground"}`}>
                                  {Math.max(0, 3 - Math.round(parseFloat(bal?.usedDays || "0")))} uses left
                                </span>
                              )}
                              {!isLWP && !isEML && (
                                <span className={`ml-2 text-xs ${isSelected ? "text-primary/70" : "text-muted-foreground"}`}>
                                  {avail.toFixed(1)} left
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {lwpWarning && (
                      <Alert variant="warning" data-testid="text-lwp-warning">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{lwpWarning}</AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={applyForm.startDate}
                        onChange={(e) => setApplyForm(prev => ({
                          ...prev,
                          startDate: e.target.value,
                          endDate: prev.endDate < e.target.value ? e.target.value : prev.endDate,
                        }))}
                        min={new Date().toISOString().split("T")[0]}
                        data-testid="input-leave-start-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={applyForm.endDate}
                        onChange={(e) => setApplyForm(prev => ({ ...prev, endDate: e.target.value }))}
                        min={applyForm.startDate || new Date().toISOString().split("T")[0]}
                        data-testid="input-leave-end-date"
                      />
                    </div>
                  </div>

                  {(() => {
                    if (!applyForm.startDate || !applyForm.endDate || applyForm.startDate > applyForm.endDate) return null;
                    const start = new Date(applyForm.startDate + "T00:00:00");
                    const end = new Date(applyForm.endDate + "T00:00:00");
                    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    if (diff > 13) return null;
                    const holidaySet = new Set((holidays || []).map(h => h.date.substring(0, 10)));
                    const holidayNameMap: Record<string, string> = {};
                    (holidays || []).forEach(h => { holidayNameMap[h.date.substring(0, 10)] = h.name; });
                    const chips: { date: string; label: string; kind: "working" | "weekend" | "holiday"; hname?: string }[] = [];
                    for (let i = 0; i <= diff; i++) {
                      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
                      const iso = d.toISOString().substring(0, 10);
                      const dow = d.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      const isHoliday = holidaySet.has(iso);
                      const dayLabel = ["Su","Mo","Tu","We","Th","Fr","Sa"][dow];
                      chips.push({
                        date: iso,
                        label: `${dayLabel} ${d.getDate()}`,
                        kind: isHoliday ? "holiday" : isWeekend ? "weekend" : "working",
                        hname: isHoliday ? holidayNameMap[iso] : undefined,
                      });
                    }
                    return (
                      <div className="space-y-1" data-testid="day-chip-breakdown">
                        <p className="text-xs text-muted-foreground font-medium">Day breakdown</p>
                        <div className="flex flex-wrap gap-1.5">
                          {chips.map(chip => (
                            <span
                              key={chip.date}
                              title={chip.kind === "holiday" ? chip.hname : chip.kind === "weekend" ? "Weekend" : "Working day"}
                              data-testid={`chip-day-${chip.date}`}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                                ${chip.kind === "working" ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                                : chip.kind === "holiday" ? "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"}`}
                            >
                              {chip.label}
                              {chip.kind === "holiday" && <span className="ml-1 opacity-75">H</span>}
                              {chip.kind === "weekend" && <span className="ml-1 opacity-60">—</span>}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-green-400 inline-block" />Working</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-orange-400 inline-block" />Holiday</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-slate-300 inline-block" />Weekend</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="half-day"
                        checked={applyForm.halfDay}
                        onCheckedChange={(v) => setApplyForm(prev => ({ ...prev, halfDay: v }))}
                        data-testid="switch-half-day"
                      />
                      <Label htmlFor="half-day">Half Day</Label>
                    </div>
                    {applyForm.halfDay && (
                      <Select value={applyForm.halfDayPart} onValueChange={(v) => setApplyForm(prev => ({ ...prev, halfDayPart: v }))}>
                        <SelectTrigger className="w-[140px]" data-testid="select-half-day-part">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="first">First Half</SelectItem>
                          <SelectItem value="second">Second Half</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {applyForm.startDate && applyForm.endDate && applyForm.startDate <= applyForm.endDate && (() => {
                    const selectedLt = leaveTypes?.find(t => t.id === applyForm.leaveTypeId);
                    const bal = balances?.find(b => b.leaveTypeId === applyForm.leaveTypeId);
                    const available = bal ? Math.max(0, parseFloat(bal.totalDays) - parseFloat(bal.usedDays)) : 0;
                    const balanceAfter = available - appliedDays;
                    const isEML = selectedLt?.occurrenceBased;
                    const isLWP = selectedLt && /lwp|loss.?of.?pay|unpaid/i.test(selectedLt.name);
                    return (
                      <div className="space-y-2">
                        {isEML && (
                          <div className="flex items-start gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg" data-testid="text-eml-retrospective-notice">
                            <Info className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
                            <p className="text-sm text-purple-700 dark:text-purple-300">
                              <strong>Emergency Leave — retrospective approval applies.</strong> This will be flagged to your manager as an emergency. Evidence may be requested.
                            </p>
                          </div>
                        )}
                        {!isEML && (
                          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg" data-testid="text-days-count">
                            <CalendarCheck className="h-4 w-4 text-primary" />
                            <span className="text-sm">
                              <strong>{appliedDays}</strong> working day{appliedDays !== 1 ? "s" : ""} applied
                              {dayCountData && !applyForm.halfDay && (
                                <span className="text-muted-foreground ml-1">(weekends &amp; holidays excluded)</span>
                              )}
                            </span>
                          </div>
                        )}
                        {selectedLt && !isLWP && !isEML && appliedDays > 0 && (
                          <div className={`flex items-center justify-between p-3 rounded-lg border text-sm ${balanceAfter < 0 ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"}`} data-testid="text-balance-after">
                            <span className="text-muted-foreground">Balance after approval:</span>
                            <span className={`font-semibold ${balanceAfter < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                              {balanceAfter.toFixed(1)} days
                              {balanceAfter < 0 && <span className="ml-1 text-xs font-normal">(insufficient)</span>}
                            </span>
                          </div>
                        )}
                        {selectedLt && !isLWP && !isEML && appliedDays > 0 && balanceAfter < 0 && available > 0 && (() => {
                          const effectivePaid = splitPaidDays !== null ? splitPaidDays : available;
                          const lwpDays = Math.max(0, appliedDays - effectivePaid);
                          return (
                            <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 space-y-3" data-testid="split-leave-panel">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Insufficient balance — split with LWP?</p>
                                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                    You have <strong>{available.toFixed(1)}</strong> paid day{available !== 1 ? "s" : ""} available. Use the slider to allocate paid vs Loss of Pay days.
                                  </p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Paid leave: <strong className="text-green-700 dark:text-green-400">{effectivePaid.toFixed(1)} day{effectivePaid !== 1 ? "s" : ""}</strong></span>
                                  <span>LWP: <strong className="text-red-600 dark:text-red-400">{lwpDays.toFixed(1)} day{lwpDays !== 1 ? "s" : ""}</strong></span>
                                </div>
                                <Slider
                                  data-testid="slider-split-paid"
                                  min={0}
                                  max={available}
                                  step={0.5}
                                  value={[effectivePaid]}
                                  onValueChange={([v]) => setSplitPaidDays(v)}
                                  className="w-full"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>0 paid (all LWP)</span>
                                  <span>All paid ({available.toFixed(1)} d)</span>
                                </div>
                              </div>
                              {lwpDays > 0 && (
                                <p className="text-xs text-red-600 dark:text-red-400">
                                  <strong>{lwpDays.toFixed(1)}</strong> day{lwpDays !== 1 ? "s" : ""} will be Loss of Pay and deducted from your salary.
                                </p>
                              )}
                            </div>
                          );
                        })()}
                        {selectedLt && !isEML && (() => {
                          const warning = getNoticePeriodWarning(selectedLt, applyForm.startDate, appliedDays);
                          if (!warning) return null;
                          return (
                            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg" data-testid="text-notice-period-warning">
                              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                              <p className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>
                            </div>
                          );
                        })()}
                        {isLWP && appliedDays > 0 && (
                          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg" data-testid="text-lwp-salary-impact">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                            <p className="text-sm text-red-700 dark:text-red-400">
                              Loss of Pay: <strong>{appliedDays} day{appliedDays !== 1 ? "s" : ""}</strong> will be deducted from your salary this month.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Reason dropdown with contextual options */}
                  {applyForm.leaveTypeId && (() => {
                    const selectedLt = leaveTypes?.find(t => t.id === applyForm.leaveTypeId);
                    if (!selectedLt) return null;
                    const category = getLeaveCategory(selectedLt);
                    const options = REASON_OPTIONS[category] || REASON_OPTIONS.other;
                    const isOther = selectedReason === "Other" || selectedReason === "Other emergency";
                    return (
                      <div className="space-y-2">
                        <Label>Leave Reason</Label>
                        <Select value={selectedReason} onValueChange={setSelectedReason} data-testid="select-leave-reason">
                          <SelectTrigger data-testid="trigger-leave-reason">
                            <SelectValue placeholder="Select a reason…" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isOther && (
                          <Textarea
                            value={otherReasonText}
                            onChange={(e) => setOtherReasonText(e.target.value)}
                            placeholder="Please describe your reason…"
                            rows={2}
                            data-testid="textarea-other-reason"
                          />
                        )}
                      </div>
                    );
                  })()}

                  <Button
                    onClick={() => applyMutation.mutate(applyForm)}
                    disabled={
                      !applyForm.leaveTypeId ||
                      !applyForm.startDate ||
                      !applyForm.endDate ||
                      applyForm.startDate > applyForm.endDate ||
                      applyMutation.isPending
                    }
                    className="w-full sm:w-auto"
                    data-testid="button-submit-leave"
                  >
                    {applyMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                    ) : (
                      <><Plus className="h-4 w-4 mr-2" /> Submit Leave Request</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* HISTORY TAB */}
            {activeTab === "history" && (
              <div className="space-y-4">
                {activeLeaveTypes.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {selectedYear} Usage Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-4">
                        {activeLeaveTypes.map(lt => {
                          const used = usedByType[lt.id] || 0;
                          const bal = balances?.find(b => b.leaveTypeId === lt.id);
                          const total = parseFloat(bal?.totalDays || "0");
                          return (
                            <div key={lt.id} className="text-center min-w-[70px]" data-testid={`summary-${lt.id}`}>
                              <p className="text-xl font-mono font-bold">{used.toFixed(1)}</p>
                              <p className="text-xs text-muted-foreground">{lt.name}</p>
                              <p className="text-xs text-muted-foreground">of {total.toFixed(1)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {leavesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                  </div>
                ) : filteredLeaves.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No leave requests for {selectedYear}.</p>
                      <Button variant="outline" className="mt-4" onClick={() => goTab("apply")} data-testid="button-apply-now">
                        Apply for Leave
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredLeaves
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(lr => {
                        const lt = leaveTypes?.find(t => t.id === lr.leaveTypeId);
                        return (
                          <Card key={lr.id} className="transition-shadow hover:shadow-md" data-testid={`leave-request-${lr.id}`}>
                            <CardContent className="py-4">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5">{getStatusIcon(lr.status)}</div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-medium text-sm">{lt?.name || "Leave"}</p>
                                      {getStatusBadge(lr.status)}
                                      {lr.halfDay && <Badge variant="outline" className="text-xs">Half Day ({lr.halfDayPart || "first"})</Badge>}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {lr.startDate} → {lr.endDate}
                                      <span className="ml-2 font-medium text-foreground">{parseFloat(lr.totalDays).toFixed(1)} day{parseFloat(lr.totalDays) !== 1 ? "s" : ""}</span>
                                    </p>
                                    {lr.reason && <p className="text-xs text-muted-foreground mt-1 italic">{lr.reason}</p>}
                                    {lr.reviewComment && (
                                      <div className="mt-2 flex items-start gap-1.5 text-xs">
                                        <AlertCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                        <span className="text-muted-foreground">{lr.reviewComment}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <p className="text-xs text-muted-foreground">{new Date(lr.createdAt).toLocaleDateString("en-IN")}</p>
                                  {lr.status === "pending" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => cancelMutation.mutate(lr.id)}
                                      disabled={cancelMutation.isPending}
                                      data-testid={`button-cancel-leave-${lr.id}`}
                                    >
                                      Cancel
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* ACCRUAL TAB */}
            {activeTab === "accrual" && (
              <div className="space-y-6">
                {accrualsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                  </div>
                ) : (
                  <>
                    {elTypes.map(lt => {
                      const EL_BONUS_LOCAL = [1, 5, 9];
                      let cumulative = 0;
                      return (
                        <Card key={lt.id}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-primary" />
                              {lt.name} — {selectedYear} Accrual
                              <Badge variant="outline" className="text-xs">Conditional (128h/month)</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Month</th>
                                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
                                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Days</th>
                                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Cumulative</th>
                                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {MONTH_NAMES.map((m, idx) => {
                                    const month = idx + 1;
                                    const a = getAccrualForTypeMonth(lt.id, month);
                                    const isBonus = EL_BONUS_LOCAL.includes(month);
                                    const days = a ? parseFloat(a.accruedDays) : null;
                                    if (a && days !== null) cumulative += days;
                                    const futureMonth = month > now.getMonth() + 1 && selectedYear === currentYear;
                                    return (
                                      <tr key={month} className={`border-b last:border-0 ${futureMonth ? "opacity-40" : ""}`} data-testid={`accrual-row-${lt.id}-${month}`}>
                                        <td className="py-2 px-2 font-medium">
                                          {m}
                                          {isBonus && <span className="ml-1 text-xs text-amber-600">★</span>}
                                        </td>
                                        <td className="py-2 px-2 text-xs text-muted-foreground">
                                          {a?.accrualType === "monthly+bonus" ? "Bonus month" : a?.accrualType === "year_end_carry_forward" ? "Carry fwd" : futureMonth ? "—" : "Regular"}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono">
                                          {a ? (days! > 0 ? `+${days!.toFixed(1)}` : "0") : futureMonth ? "—" : <span className="text-muted-foreground text-xs">pending</span>}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono text-muted-foreground">
                                          {a && days! > 0 ? cumulative.toFixed(1) : "—"}
                                        </td>
                                        <td className="py-2 px-2">
                                          {!futureMonth && a && (
                                            <Badge className={`text-xs ${a.qualified ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>
                                              {a.qualified ? "Qualified" : "Skipped"}
                                            </Badge>
                                          )}
                                          {!futureMonth && !a && <span className="text-xs text-muted-foreground">Not run</span>}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {(() => {
                                    const cfAccrual = accruals?.find(a => a.leaveTypeId === lt.id && a.month === 0 && a.year === selectedYear);
                                    if (!cfAccrual) return null;
                                    return (
                                      <tr className="border-b bg-blue-50/50 dark:bg-blue-950/20" data-testid={`accrual-carry-${lt.id}`}>
                                        <td className="py-2 px-2 font-medium text-blue-700 dark:text-blue-400">Carry Fwd</td>
                                        <td className="py-2 px-2 text-xs text-blue-600">From prev. year</td>
                                        <td className="py-2 px-2 text-right font-mono text-blue-700">+{parseFloat(cfAccrual.accruedDays).toFixed(1)}</td>
                                        <td className="py-2 px-2" />
                                        <td className="py-2 px-2">
                                          <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Carry Fwd</Badge>
                                        </td>
                                      </tr>
                                    );
                                  })()}
                                </tbody>
                              </table>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">
                              ★ Bonus months (Jan, May, Sep): +1 extra day. Carry-forward capped at {lt.carryForwardCap || 45} days at year-end.
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}

                    {slTypes.map(lt => (
                      <Card key={lt.id}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4 text-green-600" />
                            {lt.name} — {selectedYear} Accrual
                            <Badge variant="outline" className="text-xs">Unconditional (0.67/month)</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 mb-4">
                            {MONTH_NAMES.map((m, idx) => {
                              const month = idx + 1;
                              const a = getAccrualForTypeMonth(lt.id, month);
                              const futureMonth = month > now.getMonth() + 1 && selectedYear === currentYear;
                              const days = a ? parseFloat(a.accruedDays) : null;
                              return (
                                <div
                                  key={month}
                                  className={`flex flex-col items-center p-2 rounded-lg border text-xs ${
                                    futureMonth
                                      ? "border-border bg-muted/30 opacity-40"
                                      : a?.qualified && days! > 0
                                      ? "border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800"
                                      : a && !a.qualified
                                      ? "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800"
                                      : "border-border bg-muted/20"
                                  }`}
                                  data-testid={`sl-accrual-${lt.id}-${month}`}
                                  title={a?.skipReason || ""}
                                >
                                  <span className="font-medium">{m}</span>
                                  <span className={`mt-0.5 font-mono ${a?.qualified && days! > 0 ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                                    {a ? (days! > 0 ? `+${days!.toFixed(1)}` : "✗") : futureMonth ? "—" : "?"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            SL accrues unconditionally (no hours check). Balance lapses Dec 31 — no carry-forward.
                          </p>
                        </CardContent>
                      </Card>
                    ))}

                    {elTypes.length === 0 && slTypes.length === 0 && (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                          <p className="text-muted-foreground">No accrual data available. Contact HR to configure leave types.</p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
