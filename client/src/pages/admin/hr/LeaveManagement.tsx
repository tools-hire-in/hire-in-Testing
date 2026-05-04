import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CalendarCheck, Loader2, Plus, AlertTriangle, CheckCircle2, Clock, XCircle,
  ChevronRight, TrendingUp, Calendar, FileText, AlertCircle, Info
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PillTabs, PillTabsContent, PillTabsList, PillTabsTrigger } from "@/components/ui/pill-tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PortalHeader } from "@/components/ui/portal-header";
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
}

interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  monthlyAccrual: string;
  isActive: boolean;
  isConditional: boolean;
  carryForwardCap: number | null;
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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

const EL_BONUS_MONTHS = [1, 5, 9]; // Jan, May, Sep

export default function LeaveManagement() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState("balance");

  // Apply form state
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
    halfDay: false,
    halfDayPart: "first",
  });
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
    enabled: isAuthenticated && activeTab === "accrual",
  });

  // Holidays for day-chip breakdown
  const { data: holidays } = useQuery<{ id: string; date: string; name: string }[]>({
    queryKey: ["/api/hr/holidays"],
    enabled: isAuthenticated && activeTab === "apply",
    staleTime: 60 * 60 * 1000,
  });

  // Day count live calculation
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
      const isLWP = selectedLt && /lwp|loss.?of.?pay/i.test(selectedLt.name);
      const hasSplit = !isLWP && balanceAfter < 0 && available > 0 && splitPaidDays !== null;
      return apiRequest("POST", "/api/hr/leave-requests", {
        leaveTypeId: data.leaveTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason || null,
        halfDay: data.halfDay,
        halfDayPart: data.halfDay ? data.halfDayPart : null,
        totalDays: String(appliedDays),
        ...(hasSplit ? { splitPaidDays: splitPaidDays, splitLwpDays: appliedDays - (splitPaidDays ?? 0) } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-requests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balances/my"] });
      setApplyForm({ leaveTypeId: "", startDate: "", endDate: "", reason: "", halfDay: false, halfDayPart: "first" });
      setLwpWarning(null);
      setSplitPaidDays(null);
      setActiveTab("history");
      toast({ title: "Leave Applied", description: "Your leave request has been submitted for approval." });
    },
    onError: async (err: any) => {
      const res = err?.response;
      let msg = "Failed to submit leave request";
      if (res) {
        try {
          const json = await res.json();
          msg = json.error || msg;
        } catch {}
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

  // Check LWP warning when leave type changes
  useEffect(() => {
    if (!applyForm.leaveTypeId || !leaveTypes || !balances) { setLwpWarning(null); return; }
    const lt = leaveTypes.find(t => t.id === applyForm.leaveTypeId);
    if (!lt || !/lwp|loss.?of.?pay/i.test(lt.name)) { setLwpWarning(null); return; }
    const remaining = balances.reduce((sum, b) => {
      const blt = leaveTypes.find(t => t.id === b.leaveTypeId);
      if (!blt || /lwp|loss.?of.?pay/i.test(blt.name)) return sum;
      return sum + Math.max(0, parseFloat(b.totalDays) - parseFloat(b.usedDays));
    }, 0);
    if (remaining > 0) {
      setLwpWarning(`You have ${remaining.toFixed(1)} day(s) of EL/SL/Comp-Off remaining. LWP requires exhausting all other leave balances first.`);
    } else {
      setLwpWarning(null);
    }
  }, [applyForm.leaveTypeId, leaveTypes, balances]);

  if (authLoading || !isAuthenticated) return null;

  const activeLeaveTypes = leaveTypes?.filter(lt => lt.isActive) || [];
  const filteredLeaves = myLeaves?.filter(lr => {
    const year = parseInt(lr.startDate.split("-")[0]);
    return year === selectedYear;
  }) || [];

  // Annual summary for history tab
  const usedByType: Record<string, number> = {};
  filteredLeaves.filter(lr => lr.status === "approved").forEach(lr => {
    usedByType[lr.leaveTypeId] = (usedByType[lr.leaveTypeId] || 0) + parseFloat(lr.totalDays || "0");
  });

  // Accrual calendar data
  const elTypes = activeLeaveTypes.filter(lt => lt.isConditional);
  const slTypes = activeLeaveTypes.filter(lt => !lt.isConditional && !/lwp|loss.?of.?pay/i.test(lt.name));

  const getAccrualForTypeMonth = (leaveTypeId: string, month: number) =>
    accruals?.find(a => a.leaveTypeId === leaveTypeId && a.month === month && a.year === selectedYear);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <PortalHeader
          label="HR Portal"
          title="Leave Management"
          subtitle="View your leave balance, apply for leave, and track accruals"
          action={
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[110px] bg-white/10 border-white/20 text-white" data-testid="select-leave-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          data-testid="text-leave-management-title"
        />

        <PillTabs value={activeTab} onValueChange={setActiveTab}>
          <PillTabsList className="grid grid-cols-4 w-full" data-testid="tabs-leave-management">
            <PillTabsTrigger value="balance" data-testid="tab-balance">Balance</PillTabsTrigger>
            <PillTabsTrigger value="apply" data-testid="tab-apply">Apply Leave</PillTabsTrigger>
            <PillTabsTrigger value="history" data-testid="tab-history">History</PillTabsTrigger>
            <PillTabsTrigger value="accrual" data-testid="tab-accrual">Accrual</PillTabsTrigger>
          </PillTabsList>

          {/* BALANCE TAB */}
          <PillTabsContent value="balance">
            {balancesLoading || ltLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
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
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeLeaveTypes.map(lt => {
                    const balance = balances?.find(b => b.leaveTypeId === lt.id);
                    const total = parseFloat(balance?.totalDays || "0");
                    const used = parseFloat(balance?.usedDays || "0");
                    const available = Math.max(0, total - used);
                    const isEL = lt.isConditional && (lt.carryForwardCap || 0) > 0;
                    const isSL = !lt.isConditional && !/lwp|loss.?of.?pay/i.test(lt.name) && !/comp.?off|compensatory/i.test(lt.name);
                    const isCompOff = /comp.?off|compensatory/i.test(lt.name);
                    const isLWP = /lwp|loss.?of.?pay/i.test(lt.name);
                    const now = new Date();
                    const nextAccrualDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    const nextAccrualStr = nextAccrualDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                    const nextMonth = nextAccrualDate.getMonth() + 1;
                    const isCurrentBonusMonth = isEL && EL_BONUS_MONTHS.includes(now.getMonth() + 1);
                    const isNextBonusMonth = isEL && EL_BONUS_MONTHS.includes(nextMonth);
                    const nextMonthDays = isNextBonusMonth ? 2 : parseFloat(lt.monthlyAccrual || "1");
                    const carryForwardWarning = isEL && (lt.carryForwardCap || 0) > 0 && available > (lt.carryForwardCap || 45);
                    const leaveTypeToken: "el" | "sl" | "co" | "default" = isEL ? "el" : isSL ? "sl" : isCompOff ? "co" : "default";
                    const subtitle = isEL
                      ? `EL · Carry fwd up to ${lt.carryForwardCap || 45} days`
                      : isSL ? "SL · Lapses Dec 31"
                      : isCompOff ? "Comp-Off · Use within 90 days"
                      : isLWP ? "Loss of Pay"
                      : `${lt.defaultDays} days/year`;
                    return (
                      <LeaveBalanceCard
                        key={lt.id}
                        type={leaveTypeToken}
                        label={lt.name}
                        balance={available}
                        total={total}
                        used={used}
                        subtitle={subtitle}
                        isCurrentBonusMonth={isCurrentBonusMonth}
                        isNextBonusMonth={isNextBonusMonth}
                        showCarryForwardWarning={carryForwardWarning}
                        carryForwardCap={lt.carryForwardCap || 45}
                        showLapseWarning={isSL && available > 0}
                        nextAccrualDate={!isLWP ? nextAccrualStr : undefined}
                        nextAccrualDays={!isLWP ? nextMonthDays : undefined}
                        data-testid={`balance-card-${lt.id}`}
                      />
                    );
                  })}
                </div>
                <Card className="mt-4 bg-muted/30 border-dashed">
                  <CardContent className="py-3 px-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>Policy:</strong> EL accrues 1 day/month (+1 bonus in Jan, May, Sep) conditional on 128h worked. Carry-forward capped at 45 days.
                      SL accrues 0.67 days/month unconditionally. SL balance lapses Dec 31 — no carry-forward.
                      LWP can only be applied after all other leave balances are exhausted.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </PillTabsContent>

          {/* APPLY LEAVE TAB */}
          <PillTabsContent value="apply">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Apply for Leave
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Leave type selection */}
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  {ltLoading ? <Skeleton className="h-10" /> : (
                    <div className="flex flex-wrap gap-2">
                      {activeLeaveTypes.map(lt => {
                        const bal = balances?.find(b => b.leaveTypeId === lt.id);
                        const avail = Math.max(0, parseFloat(bal?.totalDays || "0") - parseFloat(bal?.usedDays || "0"));
                        const isSelected = applyForm.leaveTypeId === lt.id;
                        const isLWP = /lwp|loss.?of.?pay/i.test(lt.name);
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
                            {!isLWP && (
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

                {/* Date range */}
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

                {/* Day-by-day chip breakdown for short periods (≤ 14 days) */}
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
                    const dateLabel = `${dayLabel} ${d.getDate()}`;
                    chips.push({
                      date: iso,
                      label: dateLabel,
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
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-orange-400 inline-block" />Holiday (H)</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-slate-300 inline-block" />Weekend (—)</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Half-day toggle */}
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

                {/* Day count + balance-after + impact display */}
                {applyForm.startDate && applyForm.endDate && applyForm.startDate <= applyForm.endDate && (() => {
                  const selectedLt = leaveTypes?.find(t => t.id === applyForm.leaveTypeId);
                  const bal = balances?.find(b => b.leaveTypeId === applyForm.leaveTypeId);
                  const available = bal ? Math.max(0, parseFloat(bal.totalDays) - parseFloat(bal.usedDays)) : 0;
                  const balanceAfter = available - appliedDays;
                  const isEL = selectedLt?.isConditional && (selectedLt?.carryForwardCap || 0) > 0;
                  const isLWP = selectedLt && /lwp|loss.?of.?pay/i.test(selectedLt.name);
                  const daysUntilStart = applyForm.startDate ? Math.ceil((new Date(applyForm.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                  const elShortNotice = isEL && daysUntilStart < 7 && daysUntilStart >= 0;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg" data-testid="text-days-count">
                        <CalendarCheck className="h-4 w-4 text-primary" />
                        <span className="text-sm">
                          <strong>{appliedDays}</strong> working day{appliedDays !== 1 ? "s" : ""} applied
                          {dayCountData && !applyForm.halfDay && (
                            <span className="text-muted-foreground ml-1">(weekends &amp; holidays excluded)</span>
                          )}
                        </span>
                      </div>
                      {selectedLt && !isLWP && appliedDays > 0 && (
                        <div className={`flex items-center justify-between p-3 rounded-lg border text-sm ${balanceAfter < 0 ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"}`} data-testid="text-balance-after">
                          <span className="text-muted-foreground">Balance after approval:</span>
                          <span className={`font-semibold ${balanceAfter < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                            {balanceAfter.toFixed(1)} days
                            {balanceAfter < 0 && <span className="ml-1 text-xs font-normal">(insufficient)</span>}
                          </span>
                        </div>
                      )}
                      {/* Split-leave slider: shown when balance is insufficient */}
                      {selectedLt && !isLWP && appliedDays > 0 && balanceAfter < 0 && available > 0 && (() => {
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
                      {elShortNotice && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg" data-testid="text-el-notice-warning">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                          <p className="text-sm text-amber-700 dark:text-amber-400">
                            EL requests should ideally be submitted at least 7 days in advance. Please inform your manager.
                          </p>
                        </div>
                      )}
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

                {/* Reason */}
                <div className="space-y-2">
                  <Label>Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea
                    value={applyForm.reason}
                    onChange={(e) => setApplyForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Brief reason for leave..."
                    rows={3}
                    data-testid="textarea-leave-reason"
                  />
                </div>

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
          </PillTabsContent>

          {/* HISTORY TAB */}
          <PillTabsContent value="history" className="space-y-4">
            {/* Annual summary */}
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
                  <Button variant="outline" className="mt-4" onClick={() => setActiveTab("apply")} data-testid="button-apply-now">
                    Apply for Leave
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredLeaves.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(lr => {
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
          </PillTabsContent>

          {/* ACCRUAL TAB */}
          <PillTabsContent value="accrual" className="space-y-6">
            {accrualsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
            ) : (
              <>
                {/* EL Accrual Table */}
                {elTypes.map(lt => {
                  const EL_BONUS_MONTHS = [1, 5, 9];
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
                                const isBonus = EL_BONUS_MONTHS.includes(month);
                                const isCarryFwd = getAccrualForTypeMonth(lt.id, 0);
                                const days = a ? parseFloat(a.accruedDays) : null;
                                if (a && days !== null) cumulative += days;
                                const futureMonth = month > new Date().getMonth() + 1 && selectedYear === currentYear;
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
                              {/* Carry forward row if it exists */}
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

                {/* SL Accrual Pills */}
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
                          const futureMonth = month > new Date().getMonth() + 1 && selectedYear === currentYear;
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
          </PillTabsContent>
        </PillTabs>
      </div>
    </AdminLayout>
  );
}
