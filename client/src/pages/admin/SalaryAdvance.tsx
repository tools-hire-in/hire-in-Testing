import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Wallet, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight,
  IndianRupee, ShieldCheck, Banknote, RotateCcw, Send, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

interface AdvanceUser {
  id: string; firstName: string; lastName: string; email: string; role: string;
}
interface Advance {
  id: string;
  requestNumber: string;
  kind?: string;
  backfilled?: boolean;
  requesterId: string;
  managerId: string | null;
  requestedAmount: string;
  approvedAmount: string | null;
  reason: string;
  status: string;
  repaymentMonths: number | null;
  monthlyDeduction: string | null;
  totalRepaid: string;
  outstandingBalance: string;
  isException: boolean;
  exceptionReason: string | null;
  returnNote: string | null;
  rejectionReason: string | null;
  exitRecoveryFlag: boolean;
  urgentProcessing?: boolean | null;
  createdAt: string;
  requester?: AdvanceUser | null;
  manager?: AdvanceUser | null;
}
interface Repayment {
  id: string; installmentNo: number; year: number; month: number;
  scheduledAmount: string; status: string; deductedAmount: string | null;
}
interface AuditEntry {
  id: string; action: string; oldStatus: string | null; newStatus: string | null;
  metadata: any; createdAt: string; actor?: AdvanceUser | null;
}
interface AdvanceDetail extends Advance {
  repayments: Repayment[];
  auditLog: AuditEntry[];
  eligibilityWarnings?: string[];
}
interface Policy {
  enabled: boolean;
  maxAdvancePctOfNet: number;
  exceptionCeilingPct: number;
  defaultMaxMonths: number;
  managerMaxMonths: number;
  ceoMaxMonths: number;
  requireProbationComplete: boolean;
  minTenureMonths: number;
  oneActiveAdvanceOnly: boolean;
}

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending_manager: { label: "Pending Manager", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  pending_final: { label: "Pending Final Approval", color: "bg-blue-100 text-blue-700 border-blue-200", icon: ShieldCheck },
  pending_review: { label: "Pending Review", color: "bg-violet-100 text-violet-700 border-violet-200", icon: ShieldCheck },
  approved: { label: "Approved", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  disbursed: { label: "Disbursed", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Banknote },
  repaying: { label: "Repaying", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: RotateCcw },
  applied: { label: "Applied", color: "bg-teal-100 text-teal-700 border-teal-200", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-600 border-slate-200", icon: CheckCircle2 },
  returned: { label: "Returned for Edit", color: "bg-rose-100 text-rose-700 border-rose-200", icon: AlertCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-slate-100 text-slate-500 border-slate-200", icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] || { label: status, color: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock };
  const Icon = s.icon;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${s.color}`} data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3" /> {s.label}
    </Badge>
  );
}

function KindBadge({ kind }: { kind?: string }) {
  if (kind === "overpayment") {
    return (
      <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-200" data-testid="badge-kind-overpayment">
        Overpayment
      </Badge>
    );
  }
  if (kind === "salary_credit") {
    return (
      <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200" data-testid="badge-kind-salary-credit">
        Salary Credit
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs bg-indigo-100 text-indigo-700 border-indigo-200" data-testid="badge-kind-advance">
      Advance
    </Badge>
  );
}

function fmt(value: string | number | null | undefined) {
  const num = typeof value === "string" ? parseFloat(value) : (value || 0);
  if (isNaN(num as number)) return "0.00";
  return (num as number).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function userName(u?: AdvanceUser | null) {
  if (!u) return "—";
  return `${u.firstName} ${u.lastName}`;
}

export default function SalaryAdvance() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { isEnabled, isLoading: flagsLoading } = useFeatureFlags();

  const role = user?.role || "employee";
  // HR can be a fallback approver when the manager chain is unavailable, so HR
  // must also reach the manager-approval queue/UI.
  const isManager = ["manager", "admin", "super_admin", "hr"].includes(role);
  const isFinal = role === "super_admin";
  const isAccounts = ["super_admin", "admin", "hr", "finance"].includes(role);
  // HR/admin/super_admin can manually record advances & overpayments. This tool
  // works regardless of the self-service flag, so these roles keep access to the
  // page (Active Advances area) even when the flag is OFF.
  const canRecord = ["super_admin", "admin", "hr"].includes(role);

  // The self-service Salary Advance feature is hidden behind the
  // `salary_advance_enabled` flag (default OFF). When disabled, redirect away so
  // the page is unreachable even via a direct URL — except for the roles that can
  // manually record entries, who land on the Active Advances tab. Code is kept
  // intact so the flag can re-enable the full self-service feature later.
  const advanceEnabled = isEnabled("salary_advance_enabled");
  useEffect(() => {
    if (!flagsLoading && !advanceEnabled && !canRecord) setLocation("/admin/hr");
  }, [flagsLoading, advanceEnabled, canRecord, setLocation]);

  // When the flag is off but the user can record, the Active Advances, Pending
  // Adjustments, and My Submissions tabs are still meaningful.
  const recordOnly = !advanceEnabled && canRecord;

  const params = new URLSearchParams(location.split("?")[1] || "");
  const defaultTab = recordOnly ? (isFinal ? "pending-adjustments" : canRecord ? "active" : "mine") : (params.get("tab") || "mine");
  const initialTab = params.get("tab") || defaultTab;
  const [tab, setTab] = useState(initialTab);
  useEffect(() => {
    const p = new URLSearchParams(location.split("?")[1] || "");
    const t = p.get("tab");
    if (t) { setTab(t); return; }
    setTab(recordOnly ? (isFinal ? "pending-adjustments" : "active") : "mine");
    /* eslint-disable-next-line */
  }, [location, recordOnly]);

  const setTabAndUrl = (t: string) => {
    setTab(t);
    setLocation(`/admin/salary-advance?tab=${t}`);
  };

  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: policy } = useQuery<Policy>({ queryKey: ["/api/salary-advances/policy"] });
  const { data: stats } = useQuery<{ pendingManager: number; pendingFinal: number; active: number }>({
    queryKey: ["/api/salary-advances/stats"],
    refetchInterval: 60000,
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Wallet className="h-6 w-6" /> Salary Advance
            </h1>
            <p className="text-muted-foreground text-sm">
              {recordOnly ? "Record salary advances and overpayments for employees" : "Request a salary advance and track repayment"}
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTabAndUrl}>
          <TabsList className="flex flex-wrap gap-1 h-auto">
            {!recordOnly && <TabsTrigger value="mine" data-testid="tab-mine">My Requests</TabsTrigger>}
            {!recordOnly && isManager && (
              <TabsTrigger value="approvals" data-testid="tab-approvals">
                Approvals {stats?.pendingManager ? <Badge className="ml-1.5 bg-amber-500">{stats.pendingManager}</Badge> : null}
              </TabsTrigger>
            )}
            {!recordOnly && isFinal && (
              <TabsTrigger value="final" data-testid="tab-final">
                Final Approval {stats?.pendingFinal ? <Badge className="ml-1.5 bg-blue-500">{stats.pendingFinal}</Badge> : null}
              </TabsTrigger>
            )}
            {isAccounts && (
              <TabsTrigger value="active" data-testid="tab-active">Active Advances</TabsTrigger>
            )}
            {isFinal && (
              <TabsTrigger value="pending-adjustments" data-testid="tab-pending-adjustments">
                Pending Adjustments
              </TabsTrigger>
            )}
            {canRecord && (
              <TabsTrigger value="my-submissions" data-testid="tab-my-submissions">My Submissions</TabsTrigger>
            )}
            {!recordOnly && <TabsTrigger value="policy" data-testid="tab-policy">Policy</TabsTrigger>}
          </TabsList>
        </Tabs>

        {tab === "mine" && !recordOnly && <MyRequestsTab policy={policy} onOpen={setDetailId} />}
        {tab === "approvals" && isManager && !recordOnly && <ManagerQueueTab policy={policy} onOpen={setDetailId} />}
        {tab === "final" && isFinal && !recordOnly && <FinalQueueTab policy={policy} onOpen={setDetailId} />}
        {tab === "active" && isAccounts && <ActiveAdvancesTab onOpen={setDetailId} canRecord={canRecord} />}
        {tab === "pending-adjustments" && isFinal && <PendingAdjustmentsTab />}
        {tab === "my-submissions" && canRecord && <MySubmissionsTab />}
        {tab === "policy" && !recordOnly && <PolicyView policy={policy} />}

        {detailId && (
          <AdvanceDetailDialog
            advanceId={detailId}
            open={!!detailId}
            onClose={() => setDetailId(null)}
            role={role}
            userId={user?.id || ""}
            policy={policy}
          />
        )}
      </div>
    </AdminLayout>
  );
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["/api/salary-advances/mine"] });
    qc.invalidateQueries({ queryKey: ["/api/salary-advances/pending/manager"] });
    qc.invalidateQueries({ queryKey: ["/api/salary-advances/pending/final"] });
    qc.invalidateQueries({ queryKey: ["/api/salary-advances/active"] });
    qc.invalidateQueries({ queryKey: ["/api/salary-advances/stats"] });
  };
}

function AdvanceRow({ a, onOpen, showRequester }: { a: Advance; onOpen: (id: string) => void; showRequester?: boolean }) {
  return (
    <button
      onClick={() => onOpen(a.id)}
      className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
      data-testid={`row-advance-${a.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-muted-foreground">{a.requestNumber}</span>
          <StatusBadge status={a.status} />
          <KindBadge kind={a.kind} />
          {a.backfilled && (
            <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-200" data-testid={`badge-backfilled-${a.id}`}>
              Manually recorded
            </Badge>
          )}
          {a.isException && <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200">Exception</Badge>}
          {a.exitRecoveryFlag && <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-200">Exit Recovery</Badge>}
        </div>
        <div className="mt-1 text-sm">
          {showRequester && <span className="font-medium">{userName(a.requester)} · </span>}
          <span className="font-semibold">₹{fmt(a.approvedAmount || a.requestedAmount)}</span>
          {a.outstandingBalance && parseFloat(a.outstandingBalance) > 0 && (
            <span className="text-muted-foreground"> · ₹{fmt(a.outstandingBalance)} outstanding</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{a.reason}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function MyRequestsTab({ policy, onOpen }: { policy?: Policy; onOpen: (id: string) => void }) {
  const { toast } = useToast();
  const invalidate = useInvalidateAll();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const { data: advances, isLoading } = useQuery<Advance[]>({ queryKey: ["/api/salary-advances/mine"] });

  const debouncedAmount = useDebounced(amount, 400);
  const { data: eligibility } = useQuery<{ warnings: string[]; netSalary: number; cap: number; ceiling: number }>({
    queryKey: ["/api/salary-advances/eligibility", debouncedAmount],
    queryFn: async () => {
      const res = await fetch(`/api/salary-advances/eligibility?amount=${encodeURIComponent(debouncedAmount || "0")}`, { credentials: "include" });
      if (!res.ok) return { warnings: [], netSalary: 0, cap: 0, ceiling: 0 };
      return res.json();
    },
    enabled: showForm && !!debouncedAmount && parseFloat(debouncedAmount) > 0,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/salary-advances", { requestedAmount: parseFloat(amount), reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Advance request submitted" });
      setShowForm(false); setAmount(""); setReason("");
      invalidate();
    },
    onError: (e: any) => toast({ title: "Failed to submit", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-medium text-muted-foreground">Your advance requests</h2>
        {policy?.enabled !== false && (
          <Button size="sm" onClick={() => setShowForm(v => !v)} data-testid="button-new-request">
            {showForm ? "Cancel" : "New Request"}
          </Button>
        )}
      </div>

      {policy?.enabled === false && (
        <Card><CardContent className="py-4 text-sm text-muted-foreground">Salary advances are currently disabled by your HR policy.</CardContent></Card>
      )}

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Request a Salary Advance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 25000" data-testid="input-amount" />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Briefly explain the reason for this advance" data-testid="input-reason" />
            </div>
            {eligibility && eligibility.netSalary > 0 && (
              <div className="text-xs text-muted-foreground">
                Standard cap: ₹{fmt(eligibility.cap)} · Ceiling: ₹{fmt(eligibility.ceiling)}
              </div>
            )}
            {eligibility?.warnings?.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                {eligibility.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5" data-testid={`text-warning-${i}`}>
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {w}
                  </p>
                ))}
                <p className="text-xs text-amber-600 pt-1">These are advisory — you may still submit; approvers will review.</p>
              </div>
            ) : null}
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !amount || parseFloat(amount) <= 0 || reason.trim().length < 5}
              data-testid="button-submit-request"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
              Submit Request
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : advances && advances.length > 0 ? (
        <div className="space-y-2">{advances.map(a => <AdvanceRow key={a.id} a={a} onOpen={onOpen} />)}</div>
      ) : (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No advance requests yet.</CardContent></Card>
      )}
    </div>
  );
}

function ManagerQueueTab({ policy, onOpen }: { policy?: Policy; onOpen: (id: string) => void }) {
  const { data: advances, isLoading } = useQuery<Advance[]>({ queryKey: ["/api/salary-advances/pending/manager"] });
  const pending = (advances || []).filter(a => a.status === "pending_manager");
  const others = (advances || []).filter(a => a.status !== "pending_manager");
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">Requests awaiting your approval</h2>
      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : pending.length > 0 ? (
        <div className="space-y-2">{pending.map(a => <AdvanceRow key={a.id} a={a} onOpen={onOpen} showRequester />)}</div>
      ) : (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nothing pending your approval.</CardContent></Card>
      )}
      {others.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-muted-foreground pt-2">Previously actioned</h2>
          <div className="space-y-2">{others.map(a => <AdvanceRow key={a.id} a={a} onOpen={onOpen} showRequester />)}</div>
        </>
      )}
    </div>
  );
}

function FinalQueueTab({ policy, onOpen }: { policy?: Policy; onOpen: (id: string) => void }) {
  const { data: advances, isLoading } = useQuery<Advance[]>({ queryKey: ["/api/salary-advances/pending/final"] });
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">Manager-approved requests awaiting final sign-off</h2>
      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : advances && advances.length > 0 ? (
        <div className="space-y-2">{advances.map(a => <AdvanceRow key={a.id} a={a} onOpen={onOpen} showRequester />)}</div>
      ) : (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nothing awaiting final approval.</CardContent></Card>
      )}
    </div>
  );
}

function ActiveAdvancesTab({ onOpen, canRecord }: { onOpen: (id: string) => void; canRecord?: boolean }) {
  const { data: advances, isLoading } = useQuery<Advance[]>({ queryKey: ["/api/salary-advances/active"] });
  const [showRecord, setShowRecord] = useState(false);
  const totalOutstanding = (advances || []).reduce((s, a) => s + parseFloat(a.outstandingBalance || "0"), 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Advances with outstanding balances</h2>
        <div className="flex items-center gap-3">
          <div className="text-sm">Total outstanding: <span className="font-semibold font-mono">₹{fmt(totalOutstanding)}</span></div>
          {canRecord && (
            <Button size="sm" onClick={() => setShowRecord(true)} data-testid="button-record-for-employee">
              <IndianRupee className="h-4 w-4 mr-1.5" /> Record for Employee
            </Button>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : advances && advances.length > 0 ? (
        <div className="space-y-2">{advances.map(a => <AdvanceRow key={a.id} a={a} onOpen={onOpen} showRequester />)}</div>
      ) : (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No active advances.</CardContent></Card>
      )}
      {canRecord && showRecord && (
        <RecordForEmployeeDialog open={showRecord} onClose={() => setShowRecord(false)} />
      )}
    </div>
  );
}

function RecordForEmployeeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const invalidate = useInvalidateAll();
  const qc = useQueryClient();
  const [kind, setKind] = useState<"advance" | "overpayment" | "salary_credit">("advance");
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [repaymentMonths, setRepaymentMonths] = useState("6");
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [startYear, setStartYear] = useState(String(defaultStart.getFullYear()));
  const [startMonth, setStartMonth] = useState(String(defaultStart.getMonth() + 1));
  const [targetMonth, setTargetMonth] = useState(String(now.getMonth() + 1));
  const [targetYear, setTargetYear] = useState(String(now.getFullYear()));
  const [disbursedAt, setDisbursedAt] = useState(now.toISOString().slice(0, 10));

  const { data: usersResp } = useQuery<{ users: AdvanceUser[] }>({ queryKey: ["/api/admin/users", "active"], queryFn: async () => {
    const res = await fetch("/api/admin/users?status=active", { credentials: "include" });
    if (!res.ok) return { users: [] };
    return res.json();
  } });
  const employees = (usersResp?.users || []).slice().sort((a, b) => userName(a).localeCompare(userName(b)));

  const amt = parseFloat(amount || "0");
  const months = parseInt(repaymentMonths || "0", 10);
  const monthlyPreview = kind === "advance" && amt > 0 && months > 0 ? Math.ceil((amt / months) * 100) / 100 : 0;

  const submit = useMutation({
    mutationFn: async () => {
      const body: any = { employeeId, kind, amount: amt };
      if (reason.trim()) body.reason = reason.trim();
      if (kind === "advance") {
        body.repaymentMonths = months;
        body.startYear = parseInt(startYear, 10);
        body.startMonth = parseInt(startMonth, 10);
        body.disbursedAt = disbursedAt;
      } else if (kind === "overpayment") {
        body.repaymentMonths = months;
      } else if (kind === "salary_credit") {
        body.targetMonth = parseInt(targetMonth, 10);
        body.targetYear = parseInt(targetYear, 10);
      }
      const res = await apiRequest("POST", "/api/salary-advances/backfill", body);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: () => {
      const labels: Record<string, string> = { advance: "Advance", overpayment: "Overpayment", salary_credit: "Salary Credit" };
      toast({ title: `${labels[kind] || kind} submitted`, description: kind === "advance" ? "Created and active." : "Sent for super admin review." });
      invalidate();
      qc.invalidateQueries({ queryKey: ["/api/salary-advances/my-submissions"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed to record", description: e?.message, variant: "destructive" }),
  });

  const canSubmit = !!employeeId && amt > 0 && (kind === "salary_credit" || kind === "overpayment" || months > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record for Employee</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Type</Label>
            <Tabs value={kind} onValueChange={(v) => setKind(v as any)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="advance" data-testid="tab-record-advance">Advance</TabsTrigger>
                <TabsTrigger value="overpayment" data-testid="tab-record-overpayment">Overpayment</TabsTrigger>
                <TabsTrigger value="salary_credit" data-testid="tab-record-salary-credit">Salary Credit</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {kind === "advance"
                ? "Backfill an already-given advance. Recovery runs over the chosen months. Created active immediately."
                : kind === "overpayment"
                  ? "Record an overpayment to recover in installments. Requires super admin approval before payroll deducts it."
                  : "Add a one-time salary credit for a specific payroll month. Requires super admin approval before payroll applies it."}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Employee</Label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              data-testid="select-employee"
            >
              <option value="">Select an employee…</option>
              {employees.map(u => (
                <option key={u.id} value={u.id}>{userName(u)} · {u.email}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Amount (₹)</Label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 25000" data-testid="input-record-amount" />
          </div>

          {kind === "advance" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Date of Disbursement</Label>
                <Input type="date" value={disbursedAt} onChange={(e) => setDisbursedAt(e.target.value)} data-testid="input-record-disbursed-at" />
                <p className="text-xs text-muted-foreground">When was the cash/transfer actually given to the employee?</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Repayment months</Label>
                  <Input type="number" min={1} max={36} value={repaymentMonths} onChange={(e) => setRepaymentMonths(e.target.value)} data-testid="input-record-months" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Start month</Label>
                  <select value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm" data-testid="select-start-month">
                    {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Start year</Label>
                  <Input type="number" min={2000} max={2100} value={startYear} onChange={(e) => setStartYear(e.target.value)} data-testid="input-start-year" />
                </div>
              </div>
            </>
          )}

          {kind === "overpayment" && (
            <div className="space-y-1">
              <Label className="text-xs">Recovery months (installments)</Label>
              <Input type="number" min={1} max={36} value={repaymentMonths} onChange={(e) => setRepaymentMonths(e.target.value)} data-testid="input-record-overpayment-months" />
              <p className="text-xs text-muted-foreground">How many monthly installments to recover this amount. Schedule is set after approval.</p>
            </div>
          )}

          {kind === "salary_credit" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Target month</Label>
                <select value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm" data-testid="select-target-month">
                  {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Target year</Label>
                <Input type="number" min={2000} max={2100} value={targetYear} onChange={(e) => setTargetYear(e.target.value)} data-testid="input-target-year" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Reason / note (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={kind === "overpayment" ? "Why was this overpaid?" : kind === "salary_credit" ? "What is this credit for?" : "Context for this advance"}
              data-testid="input-record-reason" />
          </div>

          {amt > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              {kind === "advance"
                ? <>Recovery: {months} month(s) × <span className="font-mono">₹{fmt(monthlyPreview)}</span>, starting {MONTHS[parseInt(startMonth, 10)]} {startYear}. Created immediately.</>
                : kind === "overpayment"
                  ? <>Will recover <span className="font-mono">₹{fmt(amt)}</span> over {months || 1} month(s). Awaits super admin approval before payroll deducts it.</>
                  : <>Will add <span className="font-mono">₹{fmt(amt)}</span> to {MONTHS[parseInt(targetMonth, 10)]} {targetYear} payroll. Awaits super admin approval.</>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-record">Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={!canSubmit || submit.isPending} data-testid="button-submit-record">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            {kind === "advance" ? "Record Advance" : kind === "salary_credit" ? "Submit Credit" : "Submit Overpayment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Shared types for the new tabs ─────────────────────────────────────────────
interface AdjustmentRow extends Advance {
  recordedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
  requester?: { id: string; firstName: string; lastName: string; email: string } | null;
  targetMonth?: number | null;
  targetYear?: number | null;
  reviewerComment?: string | null;
}

// ── Pending Adjustments Tab (super_admin only) ────────────────────────────────
function PendingAdjustmentsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [showCommentFor, setShowCommentFor] = useState<string | null>(null);
  const [commentAction, setCommentAction] = useState<"return" | "reject">("return");

  const { data: rows = [], isLoading } = useQuery<AdjustmentRow[]>({
    queryKey: ["/api/salary-advances/pending-adjustments"],
    queryFn: async () => {
      const res = await fetch("/api/salary-advances/pending-adjustments", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/salary-advances/pending-adjustments"] });
    qc.invalidateQueries({ queryKey: ["/api/salary-advances/active"] });
    qc.invalidateQueries({ queryKey: ["/api/salary-advances/stats"] });
  };

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/salary-advances/${id}/approve-adjustment`, {});
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: () => { toast({ title: "Adjustment approved" }); invalidate(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const returnOrReject = useMutation({
    mutationFn: async ({ id, action, comment }: { id: string; action: "return" | "reject"; comment: string }) => {
      const endpoint = action === "return" ? "return-adjustment" : "reject-adjustment";
      const res = await apiRequest("PATCH", `/api/salary-advances/${id}/${endpoint}`, { comment });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: (_d, vars) => {
      toast({ title: vars.action === "return" ? "Returned for edit" : "Rejected" });
      setShowCommentFor(null);
      setCommentMap(m => { const n = { ...m }; delete n[vars.id]; return n; });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>;

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          No adjustments pending your review.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{rows.length} adjustment(s) awaiting your approval.</p>
      {rows.map(row => (
        <Card key={row.id} data-testid={`card-adjustment-${row.id}`}>
          <CardContent className="pt-4 pb-3 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">{row.requestNumber}</span>
                  <KindBadge kind={row.kind} />
                  <StatusBadge status={row.status} />
                </div>
                <div className="mt-1 text-sm font-medium">
                  {row.requester ? `${row.requester.firstName} ${row.requester.lastName}` : "—"}
                  <span className="text-muted-foreground font-normal text-xs ml-2">{row.requester?.email}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Amount: <span className="font-mono font-medium text-foreground">₹{fmt(row.requestedAmount)}</span>
                  {row.kind === "overpayment" && row.repaymentMonths ? ` · ${row.repaymentMonths} month(s)` : ""}
                  {row.kind === "salary_credit" && row.targetMonth && row.targetYear
                    ? ` · Target: ${MONTHS[row.targetMonth]} ${row.targetYear}` : ""}
                  {" · "}Submitted by: {row.recordedBy ? `${row.recordedBy.firstName} ${row.recordedBy.lastName}` : "—"}
                </div>
                {row.reason && <div className="text-xs text-muted-foreground mt-0.5">Note: {row.reason}</div>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  data-testid={`button-return-${row.id}`}
                  onClick={() => { setShowCommentFor(row.id); setCommentAction("return"); }}>
                  Return
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                  data-testid={`button-reject-${row.id}`}
                  onClick={() => { setShowCommentFor(row.id); setCommentAction("reject"); }}>
                  Reject
                </Button>
                <Button size="sm" data-testid={`button-approve-${row.id}`}
                  onClick={() => approve.mutate(row.id)} disabled={approve.isPending}>
                  {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Approve
                </Button>
              </div>
            </div>
            {showCommentFor === row.id && (
              <div className="border-t pt-3 space-y-2">
                <Label className="text-xs">{commentAction === "return" ? "Return note (required)" : "Rejection reason (required)"}</Label>
                <Textarea
                  value={commentMap[row.id] || ""}
                  onChange={(e) => setCommentMap(m => ({ ...m, [row.id]: e.target.value }))}
                  placeholder={commentAction === "return" ? "What needs to be corrected?" : "Why is this being rejected?"}
                  className="text-sm" rows={2}
                  data-testid={`input-comment-${row.id}`} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowCommentFor(null)}>Cancel</Button>
                  <Button size="sm"
                    disabled={!commentMap[row.id]?.trim() || returnOrReject.isPending}
                    onClick={() => returnOrReject.mutate({ id: row.id, action: commentAction, comment: commentMap[row.id]?.trim() || "" })}
                    data-testid={`button-confirm-comment-${row.id}`}>
                    {returnOrReject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Confirm
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── My Submissions Tab (HR/Admin) ─────────────────────────────────────────────
function MySubmissionsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editMonths, setEditMonths] = useState("");
  const [editTargetMonth, setEditTargetMonth] = useState("");
  const [editTargetYear, setEditTargetYear] = useState("");

  const { data: rows = [], isLoading } = useQuery<AdjustmentRow[]>({
    queryKey: ["/api/salary-advances/my-submissions"],
    queryFn: async () => {
      const res = await fetch("/api/salary-advances/my-submissions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/salary-advances/my-submissions"] });
    qc.invalidateQueries({ queryKey: ["/api/salary-advances/active"] });
  };

  const resubmit = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const res = await apiRequest("PATCH", `/api/salary-advances/${id}/resubmit-adjustment`, body);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Resubmitted for approval" });
      setEditId(null);
      invalidate();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>;
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          You have not submitted any adjustments yet. Use "Record for Employee" on the Active Advances tab.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map(row => (
        <Card key={row.id} data-testid={`card-submission-${row.id}`}>
          <CardContent className="pt-4 pb-3 space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">{row.requestNumber}</span>
                  <KindBadge kind={row.kind} />
                  <StatusBadge status={row.status} />
                </div>
                <div className="text-sm font-medium mt-1">
                  {row.requester ? `${row.requester.firstName} ${row.requester.lastName}` : `Employee ID: ${row.requesterId}`}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Amount: <span className="font-mono font-medium text-foreground">₹{fmt(row.requestedAmount)}</span>
                  {row.kind === "salary_credit" && row.targetMonth && row.targetYear
                    ? ` · Target: ${MONTHS[row.targetMonth]} ${row.targetYear}` : ""}
                  {row.kind === "overpayment" && row.repaymentMonths ? ` · ${row.repaymentMonths} month(s)` : ""}
                </div>
                {row.reason && <div className="text-xs text-muted-foreground">Note: {row.reason}</div>}
                {row.reviewerComment && row.status === "returned" && (
                  <div className="mt-1 text-xs bg-rose-50 text-rose-700 rounded px-2 py-1">
                    Returned: {row.reviewerComment}
                  </div>
                )}
                {row.reviewerComment && row.status === "rejected" && (
                  <div className="mt-1 text-xs bg-red-50 text-red-700 rounded px-2 py-1">
                    Rejected: {row.reviewerComment}
                  </div>
                )}
              </div>
              {row.status === "returned" && editId !== row.id && (
                <Button size="sm" variant="outline" data-testid={`button-edit-resubmit-${row.id}`}
                  onClick={() => {
                    setEditId(row.id);
                    setEditAmount(String(parseFloat(row.requestedAmount)));
                    setEditReason(row.reason || "");
                    setEditMonths(String(row.repaymentMonths || ""));
                    setEditTargetMonth(String((row as any).targetMonth || ""));
                    setEditTargetYear(String((row as any).targetYear || ""));
                  }}>
                  Edit & Resubmit
                </Button>
              )}
            </div>
            {editId === row.id && (
              <div className="border-t pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Amount (₹)</Label>
                    <Input type="number" min={1} value={editAmount} onChange={e => setEditAmount(e.target.value)} data-testid="input-edit-amount" />
                  </div>
                  {row.kind === "overpayment" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Repayment months</Label>
                      <Input type="number" min={1} max={36} value={editMonths} onChange={e => setEditMonths(e.target.value)} data-testid="input-edit-months" />
                    </div>
                  )}
                  {row.kind === "salary_credit" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Target month</Label>
                        <select value={editTargetMonth} onChange={e => setEditTargetMonth(e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm" data-testid="select-edit-target-month">
                          {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Target year</Label>
                        <Input type="number" min={2000} max={2100} value={editTargetYear} onChange={e => setEditTargetYear(e.target.value)} data-testid="input-edit-target-year" />
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reason</Label>
                  <Textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={2} data-testid="input-edit-reason" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                  <Button size="sm" disabled={resubmit.isPending}
                    onClick={() => {
                      const body: any = {};
                      const amt = parseFloat(editAmount);
                      if (!isNaN(amt) && amt > 0) body.amount = amt;
                      if (editReason.trim()) body.reason = editReason.trim();
                      if (row.kind === "overpayment" && editMonths) body.repaymentMonths = parseInt(editMonths, 10);
                      if (row.kind === "salary_credit" && editTargetMonth) body.targetMonth = parseInt(editTargetMonth, 10);
                      if (row.kind === "salary_credit" && editTargetYear) body.targetYear = parseInt(editTargetYear, 10);
                      resubmit.mutate({ id: row.id, body });
                    }}
                    data-testid={`button-confirm-resubmit-${row.id}`}>
                    {resubmit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Resubmit
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PolicyView({ policy }: { policy?: Policy }) {
  if (!policy) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Loading policy…</CardContent></Card>;
  const items = [
    { label: "Feature", value: policy.enabled ? "Enabled" : "Disabled" },
    { label: "Standard cap", value: `${policy.maxAdvancePctOfNet}% of net salary` },
    { label: "Absolute ceiling", value: `${policy.exceptionCeilingPct}% of net salary` },
    { label: "Default max repayment", value: `${policy.defaultMaxMonths} months` },
    { label: "Manager max repayment", value: `${policy.managerMaxMonths} months` },
    { label: "Final approver max repayment", value: `${policy.ceoMaxMonths} months` },
    { label: "Probation must be complete", value: policy.requireProbationComplete ? "Yes" : "No" },
    { label: "Minimum tenure", value: policy.minTenureMonths > 0 ? `${policy.minTenureMonths} months` : "None" },
    { label: "One active advance only", value: policy.oneActiveAdvanceOnly ? "Yes" : "No" },
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Salary Advance Policy</CardTitle></CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(it => (
            <div key={it.label} className="flex justify-between border-b py-2 text-sm">
              <dt className="text-muted-foreground">{it.label}</dt>
              <dd className="font-medium">{it.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground mt-4">
          Caps are advisory. Requests above the cap require an exception and remain subject to manager and final approval.
        </p>
      </CardContent>
    </Card>
  );
}

function AdvanceDetailDialog({ advanceId, open, onClose, role, userId, policy }: {
  advanceId: string; open: boolean; onClose: () => void; role: string; userId: string; policy?: Policy;
}) {
  const { toast } = useToast();
  const invalidate = useInvalidateAll();
  const qc = useQueryClient();

  const { data: advance, isLoading } = useQuery<AdvanceDetail>({
    queryKey: ["/api/salary-advances", advanceId],
    queryFn: async () => {
      const res = await fetch(`/api/salary-advances/${advanceId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: open,
  });

  const refresh = () => {
    invalidate();
    qc.invalidateQueries({ queryKey: ["/api/salary-advances", advanceId] });
  };

  const action = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: any }) => {
      const res = await apiRequest("POST", `/api/salary-advances/${advanceId}/${path}`, body);
      return res.json();
    },
    onSuccess: () => { toast({ title: "Done" }); refresh(); },
    onError: (e: any) => toast({ title: "Action failed", description: e?.message, variant: "destructive" }),
  });

  const isOwner = advance?.requesterId === userId;
  const isManagerApprover = ["manager", "admin", "super_admin", "hr"].includes(role);
  const isFinal = role === "super_admin";
  const isAccounts = ["super_admin", "admin", "hr", "finance"].includes(role);

  // Manager approval form
  const [approvedAmount, setApprovedAmount] = useState("");
  const [repaymentMonths, setRepaymentMonths] = useState("");
  const [isException, setIsException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const [note, setNote] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (advance) {
      setApprovedAmount(advance.approvedAmount || advance.requestedAmount);
      setRepaymentMonths(String(advance.repaymentMonths || policy?.defaultMaxMonths || 6));
      setIsException(advance.isException);
    }
  }, [advance?.id]);

  const maxMonths = useMemo(() => {
    if (role === "super_admin" || role === "admin") return policy?.ceoMaxMonths || 12;
    if (role === "manager") return policy?.managerMaxMonths || 8;
    return policy?.defaultMaxMonths || 6;
  }, [role, policy]);

  const monthlyPreview = useMemo(() => {
    const amt = parseFloat(approvedAmount || "0");
    const m = parseInt(repaymentMonths || "0", 10);
    if (!amt || !m) return 0;
    return Math.ceil((amt / m) * 100) / 100;
  }, [approvedAmount, repaymentMonths]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm">{advance?.requestNumber || "Advance"}</span>
            {advance && <StatusBadge status={advance.status} />}
            {advance && <KindBadge kind={advance.kind} />}
            {advance?.backfilled && (
              <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-200" data-testid="badge-detail-backfilled">
                Manually recorded
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !advance ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>
        ) : (
          <div className="space-y-4">
            {(isManagerApprover || isFinal) && advance.eligibilityWarnings?.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="banner-eligibility-warnings">
                <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" /> Policy warnings</p>
                <ul className="mt-1 list-disc pl-5 space-y-0.5">
                  {advance.eligibilityWarnings.map((w, i) => (
                    <li key={i} data-testid={`text-eligibility-warning-${i}`}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Employee" value={userName(advance.requester)} />
              <Info label="Manager" value={userName(advance.manager)} />
              <Info label="Requested" value={`₹${fmt(advance.requestedAmount)}`} />
              <Info label="Approved" value={advance.approvedAmount ? `₹${fmt(advance.approvedAmount)}` : "—"} />
              {advance.repaymentMonths ? <Info label="Repayment" value={`${advance.repaymentMonths} months × ₹${fmt(advance.monthlyDeduction)}`} /> : null}
              {parseFloat(advance.outstandingBalance) > 0 ? <Info label="Outstanding" value={`₹${fmt(advance.outstandingBalance)}`} /> : null}
              {parseFloat(advance.totalRepaid) > 0 ? <Info label="Repaid" value={`₹${fmt(advance.totalRepaid)}`} /> : null}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reason</p>
              <p className="text-sm">{advance.reason}</p>
            </div>
            {advance.returnNote && advance.status === "returned" && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <p className="font-medium">Returned for more info:</p>
                <p>{advance.returnNote}</p>
              </div>
            )}
            {advance.rejectionReason && advance.status === "rejected" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-medium">Rejected:</p>
                <p>{advance.rejectionReason}</p>
              </div>
            )}

            {/* Repayment schedule */}
            {advance.repayments?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Repayment Schedule</p>
                <div className="rounded-lg border divide-y">
                  {advance.repayments.map(r => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-1.5 text-sm" data-testid={`row-repayment-${r.id}`}>
                      <span>#{r.installmentNo} · {MONTHS[r.month]} {r.year}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono">₹{fmt(r.scheduledAmount)}</span>
                        <Badge variant="outline" className={`text-[10px] ${r.status === "deducted" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                          {r.status}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OWNER actions */}
            {isOwner && (advance.status === "pending_manager" || advance.status === "pending_final" || advance.status === "returned") && (
              <div className="space-y-3 rounded-lg border p-3">
                {advance.status === "returned" && (
                  <>
                    <p className="text-sm font-medium">Update & Resubmit</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Amount (₹)</Label>
                        <Input type="number" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} data-testid="input-resubmit-amount" />
                      </div>
                    </div>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Updated reason" data-testid="input-resubmit-reason" />
                    <Button size="sm" onClick={() => action.mutate({ path: "resubmit", body: { requestedAmount: parseFloat(approvedAmount), reason: note || advance.reason } })} disabled={action.isPending} data-testid="button-resubmit">
                      Resubmit
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={() => action.mutate({ path: "cancel" })} disabled={action.isPending} data-testid="button-cancel-request">
                  Cancel Request
                </Button>
              </div>
            )}

            {/* MANAGER actions */}
            {isManagerApprover && advance.status === "pending_manager" && !isOwner && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Manager Review</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Approved Amount (₹)</Label>
                    <Input type="number" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} data-testid="input-approved-amount" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Repayment Months (max {maxMonths})</Label>
                    <Input type="number" min={1} max={maxMonths} value={repaymentMonths} onChange={(e) => setRepaymentMonths(e.target.value)} data-testid="input-repayment-months" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Monthly deduction preview: <span className="font-mono">₹{fmt(monthlyPreview)}</span></p>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Exception (above standard cap)</Label>
                  <Switch checked={isException} onCheckedChange={setIsException} data-testid="switch-exception" />
                </div>
                {isException && (
                  <Textarea value={exceptionReason} onChange={(e) => setExceptionReason(e.target.value)} placeholder="Exception justification" data-testid="input-exception-reason" />
                )}
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" data-testid="input-manager-note" />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => action.mutate({ path: "manager-approve", body: { approvedAmount: parseFloat(approvedAmount), repaymentMonths: parseInt(repaymentMonths, 10), isException, exceptionReason, note } })} disabled={action.isPending} data-testid="button-manager-approve">
                    Approve & Send for Final
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { const n = prompt("Note for the employee:"); if (n) action.mutate({ path: "return", body: { note: n } }); }} disabled={action.isPending} data-testid="button-return">
                    Return for Info
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { const r = prompt("Rejection reason:"); if (r) action.mutate({ path: "manager-reject", body: { reason: r } }); }} disabled={action.isPending} data-testid="button-manager-reject">
                    Reject
                  </Button>
                  {!advance.urgentProcessing && (
                    <Button size="sm" variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-300" onClick={() => action.mutate({ path: "urgent-process", body: {} })} disabled={action.isPending} data-testid="button-urgent-process">
                      Mark Urgent
                    </Button>
                  )}
                </div>
                {advance.urgentProcessing && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300" data-testid="text-urgent-flagged">⚡ Flagged for urgent payout — recovery will begin in the current payroll month.</p>
                )}
              </div>
            )}

            {/* FINAL actions */}
            {isFinal && advance.status === "pending_final" && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Final Approval</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Approved Amount (₹)</Label>
                    <Input type="number" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} data-testid="input-final-amount" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Repayment Months (max {maxMonths})</Label>
                    <Input type="number" min={1} max={maxMonths} value={repaymentMonths} onChange={(e) => setRepaymentMonths(e.target.value)} data-testid="input-final-months" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Monthly deduction preview: <span className="font-mono">₹{fmt(monthlyPreview)}</span></p>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" data-testid="input-final-note" />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => action.mutate({ path: "final-approve", body: { approvedAmount: parseFloat(approvedAmount), repaymentMonths: parseInt(repaymentMonths, 10), note } })} disabled={action.isPending} data-testid="button-final-approve">
                    Approve & Generate Schedule
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { const r = prompt("Rejection reason:"); if (r) action.mutate({ path: "final-reject", body: { reason: r } }); }} disabled={action.isPending} data-testid="button-final-reject">
                    Reject
                  </Button>
                </div>
              </div>
            )}

            {/* ACCOUNTS: disburse */}
            {isAccounts && advance.status === "approved" && (
              <div className="rounded-lg border p-3">
                <Button size="sm" onClick={() => action.mutate({ path: "disburse" })} disabled={action.isPending} data-testid="button-disburse">
                  <Banknote className="h-4 w-4 mr-1.5" /> Mark as Disbursed
                </Button>
              </div>
            )}

            {/* Audit log */}
            {advance.auditLog?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">History</p>
                <div className="space-y-1.5">
                  {advance.auditLog.map(e => (
                    <div key={e.id} className="text-xs flex items-start gap-2" data-testid={`audit-${e.id}`}>
                      <span className="text-muted-foreground whitespace-nowrap">{format(new Date(e.createdAt), "dd MMM HH:mm")}</span>
                      <span><span className="font-medium">{userName(e.actor)}</span> — {e.action.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-close-detail">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
