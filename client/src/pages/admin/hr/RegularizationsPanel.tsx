import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Shield,
  Users,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Pencil,
  Search,
  Eye,
  History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface RegularizationRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  attendanceDate: string;
  requestType: string;
  requestedPunchIn: string | null;
  requestedPunchOut: string | null;
  reason: string;
  status: string;
  reviewerComment: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface PolicyAck {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  policyType: string;
  policyVersion: string;
  acknowledged: boolean;
  acceptedAt: string | null;
  acknowledgedVersion: string | null;
}

interface PolicyConfig {
  employeeWindowDays: number;
  managerCutoffDay: number;
  policyVersion: string;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  missed_punch_in: "Missed Punch In",
  missed_punch_out: "Missed Punch Out",
  wrong_absent: "Wrong Absent Mark",
  correction: "Time Correction",
};

const STATUS_CFG: Record<string, { label: string; cls: string; icon: any }> = {
  pending:  { label: "Pending",  cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300", icon: Clock },
  approved: { label: "Approved", cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",   icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",           icon: XCircle },
};

function ReviewModal({
  request,
  onClose,
}: {
  request: RegularizationRequest;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<"approved" | "rejected">("approved");
  const [comment, setComment] = useState("");

  const reviewMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/hr/attendance/regularization/${request.id}/review`, {
        status,
        reviewerComment: comment,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/regularization/all"] });
      toast({ title: status === "approved" ? "Request Approved" : "Request Rejected" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to review", variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="dialog-review-regularization">
        <DialogHeader>
          <DialogTitle>Review Regularization Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg">
            <div><span className="text-muted-foreground">Employee</span><p className="font-medium">{request.employeeName}</p></div>
            <div><span className="text-muted-foreground">Date</span><p className="font-mono font-medium">{request.attendanceDate}</p></div>
            <div><span className="text-muted-foreground">Type</span><p className="font-medium">{REQUEST_TYPE_LABELS[request.requestType] || request.requestType}</p></div>
            {request.requestedPunchIn && (
              <div><span className="text-muted-foreground">Requested In</span><p className="font-mono">{new Date(request.requestedPunchIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p></div>
            )}
            {request.requestedPunchOut && (
              <div><span className="text-muted-foreground">Requested Out</span><p className="font-mono">{new Date(request.requestedPunchOut).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p></div>
            )}
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Employee Reason</span>
            <p className="mt-1 text-sm">{request.reason}</p>
          </div>
          <div className="space-y-2">
            <Label>Decision</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger data-testid="select-review-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approve</SelectItem>
                <SelectItem value="rejected">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reviewer Comment <span className="text-destructive">*</span></Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Provide a reason or note for your decision..."
              data-testid="input-review-comment"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => reviewMutation.mutate()}
            disabled={!comment.trim() || reviewMutation.isPending}
            data-testid="button-submit-review"
          >
            {reviewMutation.isPending ? "Submitting..." : "Submit Decision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OverrideModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    employeeId: "",
    attendanceDate: "",
    requestType: "correction",
    requestedPunchIn: "",
    requestedPunchOut: "",
    reason: "",
    comment: "",
  });

  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/hr/users"],
    queryFn: async () => {
      const res = await fetch("/api/hr/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const overrideMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/hr/attendance/regularization/override", {
        ...form,
        requestedPunchIn: form.requestedPunchIn || undefined,
        requestedPunchOut: form.requestedPunchOut || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/regularization/all"] });
      toast({ title: "Attendance Override Applied" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to apply override", variant: "destructive" });
    },
  });

  const isValid = form.employeeId && form.attendanceDate && form.requestType && form.reason && form.comment;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="dialog-override">
        <DialogHeader>
          <DialogTitle>Direct Attendance Override</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={form.employeeId} onValueChange={(v) => setForm(f => ({ ...f, employeeId: v }))}>
              <SelectTrigger data-testid="select-override-employee">
                <SelectValue placeholder="Select employee..." />
              </SelectTrigger>
              <SelectContent>
                {(allUsers || []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.employeeId || u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.attendanceDate}
                onChange={(e) => setForm(f => ({ ...f, attendanceDate: e.target.value }))}
                data-testid="input-override-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Correction Type</Label>
              <Select value={form.requestType} onValueChange={(v) => setForm(f => ({ ...f, requestType: v }))}>
                <SelectTrigger data-testid="select-override-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="missed_punch_in">Missed Punch In</SelectItem>
                  <SelectItem value="missed_punch_out">Missed Punch Out</SelectItem>
                  <SelectItem value="wrong_absent">Wrong Absent Mark</SelectItem>
                  <SelectItem value="correction">Time Correction</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Punch In Time (optional)</Label>
              <Input
                type="time"
                value={form.requestedPunchIn}
                onChange={(e) => setForm(f => ({ ...f, requestedPunchIn: e.target.value }))}
                data-testid="input-override-punch-in"
              />
            </div>
            <div className="space-y-2">
              <Label>Punch Out Time (optional)</Label>
              <Input
                type="time"
                value={form.requestedPunchOut}
                onChange={(e) => setForm(f => ({ ...f, requestedPunchOut: e.target.value }))}
                data-testid="input-override-punch-out"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Why is this correction needed?"
              data-testid="input-override-reason"
            />
          </div>
          <div className="space-y-2">
            <Label>HR Note / Comment</Label>
            <Textarea
              value={form.comment}
              onChange={(e) => setForm(f => ({ ...f, comment: e.target.value }))}
              placeholder="Note that will be visible to the employee..."
              data-testid="input-override-comment"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => overrideMutation.mutate()}
            disabled={!isValid || overrideMutation.isPending}
            data-testid="button-apply-override"
          >
            {overrideMutation.isPending ? "Applying..." : "Apply Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PolicySettingsCard() {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [windowDays, setWindowDays] = useState("7");
  const [cutoffDay, setCutoffDay] = useState("20");
  const [policyVersion, setPolicyVersion] = useState("1");

  const { data: config, isLoading } = useQuery<PolicyConfig>({
    queryKey: ["/api/hr/attendance/regularization/policy"],
    onSuccess: (d) => {
      setWindowDays(String(d.employeeWindowDays));
      setCutoffDay(String(d.managerCutoffDay));
      setPolicyVersion(d.policyVersion);
    },
  } as any);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Auto-bump policy version when window days or cutoff day changes,
      // ensuring all employees are prompted to re-acknowledge the updated policy.
      let effectiveVersion = policyVersion;
      const origWindowDays = String(config?.employeeWindowDays ?? 7);
      const origCutoffDay = String(config?.managerCutoffDay ?? 20);
      const policyChanged = windowDays !== origWindowDays || cutoffDay !== origCutoffDay;
      if (policyChanged && effectiveVersion === String(config?.policyVersion ?? "1")) {
        // Increment numeric version; if non-numeric, append ".1"
        const num = parseInt(effectiveVersion, 10);
        effectiveVersion = isNaN(num) ? `${effectiveVersion}.1` : String(num + 1);
      }
      await apiRequest("PUT", "/api/system-settings/regularization_employee_window_days", { value: windowDays });
      await apiRequest("PUT", "/api/system-settings/regularization_manager_cutoff_day", { value: cutoffDay });
      await apiRequest("PUT", "/api/system-settings/regularization_policy_version", { value: effectiveVersion });
      return effectiveVersion;
    },
    onSuccess: (effectiveVersion) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/regularization/policy"] });
      const origWindowDays = String(config?.employeeWindowDays ?? 7);
      const origCutoffDay = String(config?.managerCutoffDay ?? 20);
      const policyChanged = windowDays !== origWindowDays || cutoffDay !== origCutoffDay;
      toast({
        title: "Policy settings saved",
        description: policyChanged
          ? `Policy version updated to v${effectiveVersion}. All employees will be prompted to re-acknowledge.`
          : "Settings saved.",
      });
      setEditing(false);
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Regularization Policy Configuration
          </CardTitle>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="button-edit-policy">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Employee Window (working days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={windowDays}
                  onChange={(e) => setWindowDays(e.target.value)}
                  data-testid="input-window-days"
                />
                <p className="text-xs text-muted-foreground">Days from incident to raise request</p>
              </div>
              <div className="space-y-2">
                <Label>Manager Cutoff Day</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={cutoffDay}
                  onChange={(e) => setCutoffDay(e.target.value)}
                  data-testid="input-cutoff-day"
                />
                <p className="text-xs text-muted-foreground">Day of month after which HR handles it</p>
              </div>
              <div className="space-y-2">
                <Label>Policy Version</Label>
                <Input
                  value={policyVersion}
                  onChange={(e) => setPolicyVersion(e.target.value)}
                  data-testid="input-policy-version"
                />
                <p className="text-xs text-muted-foreground">Increment to re-prompt all employees</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-policy">
                {saveMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted/40 text-center">
              <p className="text-2xl font-bold font-mono">{config?.employeeWindowDays ?? 7}</p>
              <p className="text-xs text-muted-foreground mt-1">Working days window</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 text-center">
              <p className="text-2xl font-bold font-mono">{config?.managerCutoffDay ?? 20}</p>
              <p className="text-xs text-muted-foreground mt-1">Manager cutoff day</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 text-center">
              <p className="text-2xl font-bold font-mono">v{config?.policyVersion ?? "1"}</p>
              <p className="text-xs text-muted-foreground mt-1">Policy version</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AcknowledgementsSection() {
  const { data: acks, isLoading } = useQuery<PolicyAck[]>({
    queryKey: ["/api/hr/policy-acknowledgements"],
  });

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  const all = acks ?? [];
  const acceptedCount = all.filter(a => a.acknowledged).length;
  const pendingCount = all.length - acceptedCount;

  return (
    <div className="space-y-3">
      <div className="flex gap-3 text-sm">
        <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
          <CheckCircle2 className="h-4 w-4" /> {acceptedCount} accepted
        </span>
        <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
          <Clock className="h-4 w-4" /> {pendingCount} pending
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Employee</th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Email</th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Accepted At</th>
            </tr>
          </thead>
          <tbody>
            {all.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-muted-foreground">No users found</td>
              </tr>
            ) : all.map(a => (
              <tr key={a.userId} className="border-b last:border-0 hover:bg-muted/20" data-testid={`ack-row-${a.userId}`}>
                <td className="py-2.5 px-4 font-medium">{a.userName}</td>
                <td className="py-2.5 px-4 text-muted-foreground text-xs">{a.userEmail}</td>
                <td className="py-2.5 px-4">
                  {a.acknowledged ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Accepted v{a.acknowledgedVersion}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5" /> Pending
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-muted-foreground text-xs">
                  {a.acceptedAt
                    ? new Date(a.acceptedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RegularizationsPanel() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reviewRequest, setReviewRequest] = useState<RegularizationRequest | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [activeSection, setActiveSection] = useState<"requests" | "acks" | "settings">("requests");
  const [auditDetailId, setAuditDetailId] = useState<string | null>(null);

  const { data: requests, isLoading, refetch } = useQuery<RegularizationRequest[]>({
    queryKey: ["/api/hr/attendance/regularization/all"],
    queryFn: async () => {
      const res = await fetch("/api/hr/attendance/regularization", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const filtered = (requests || []).filter(r => {
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchSearch = !search ||
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.attendanceDate.includes(search) ||
      (r.employeeCode || "").toLowerCase().includes(search.toLowerCase());
    const matchDateFrom = !dateFrom || r.attendanceDate >= dateFrom;
    const matchDateTo = !dateTo || r.attendanceDate <= dateTo;
    return matchStatus && matchSearch && matchDateFrom && matchDateTo;
  });

  const pendingCount = (requests || []).filter(r => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Attendance Regularizations</h2>
          <p className="text-sm text-muted-foreground">Review employee correction requests and manage policy settings</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-requests">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowOverride(true)} data-testid="button-direct-override">
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Direct Override
          </Button>
        </div>
      </div>

      {/* Sub-sections nav */}
      <div className="flex gap-2 flex-wrap border-b pb-2">
        {[
          { key: "requests", label: "Requests", badge: pendingCount > 0 ? pendingCount : null },
          { key: "acks",     label: "Policy Acknowledgements" },
          { key: "settings", label: "Policy Settings" },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key as any)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeSection === s.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            data-testid={`section-tab-${s.key}`}
          >
            {s.label}
            {s.badge != null && (
              <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs w-4 h-4 font-medium">
                {s.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Requests section */}
      {activeSection === "requests" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name or date..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-requests"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Label className="text-xs whitespace-nowrap">Date from</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
                data-testid="input-date-from"
              />
              <Label className="text-xs">to</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
                data-testid="input-date-to"
              />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }} className="h-8 px-2 text-xs">
                  Clear
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No regularization requests match your filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Employee</th>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Type</th>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Reason</th>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(r => {
                        const cfg = STATUS_CFG[r.status] || { label: r.status, cls: "", icon: AlertCircle };
                        const StatusIcon = cfg.icon;
                        return (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`reg-row-${r.id}`}>
                            <td className="py-3 px-4">
                              <p className="font-medium">{r.employeeName}</p>
                              {r.employeeCode && <p className="text-xs text-muted-foreground">{r.employeeCode}</p>}
                            </td>
                            <td className="py-3 px-4 font-mono">{r.attendanceDate}</td>
                            <td className="py-3 px-4">{REQUEST_TYPE_LABELS[r.requestType] || r.requestType}</td>
                            <td className="py-3 px-4 max-w-[200px] truncate text-muted-foreground" title={r.reason}>{r.reason}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
                                <StatusIcon className="h-3 w-3" />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {r.status === "pending" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setReviewRequest(r)}
                                    data-testid={`button-review-${r.id}`}
                                  >
                                    Review
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {r.reviewerName && `By ${r.reviewerName}`}
                                  </span>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setAuditDetailId(r.id)}
                                  title="View audit trail"
                                  data-testid={`button-audit-${r.id}`}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Acknowledgements section */}
      {activeSection === "acks" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Policy Acknowledgements
            </h3>
            <p className="text-xs text-muted-foreground">Employees who have accepted the current attendance regularization policy</p>
          </div>
          <Card>
            <CardContent className="p-0">
              <AcknowledgementsSection />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settings section */}
      {activeSection === "settings" && <PolicySettingsCard />}

      {/* Modals */}
      {reviewRequest && <ReviewModal request={reviewRequest} onClose={() => setReviewRequest(null)} />}
      {showOverride && <OverrideModal onClose={() => setShowOverride(false)} />}
      {auditDetailId && <AuditDetailDialog requestId={auditDetailId} onClose={() => setAuditDetailId(null)} />}
    </div>
  );
}

function AuditDetailDialog({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/hr/attendance/regularization", requestId],
    queryFn: async () => {
      const res = await fetch(`/api/hr/attendance/regularization/${requestId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const eventIcon: Record<string, any> = {
    submitted: Clock,
    approved: CheckCircle2,
    rejected: XCircle,
    regularization_override: Shield,
    policy_accepted: Users,
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Trail
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1,2,3].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No data found</p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm p-3 bg-muted/40 rounded-lg">
              <div><span className="text-muted-foreground text-xs">Employee: </span><span className="font-medium">{data.employeeName ?? data.employeeId}</span></div>
              <div><span className="text-muted-foreground text-xs">Date: </span><span className="font-mono">{data.attendanceDate}</span></div>
              <div><span className="text-muted-foreground text-xs">Type: </span>{REQUEST_TYPE_LABELS[data.requestType] ?? data.requestType}</div>
              <div><span className="text-muted-foreground text-xs">Status: </span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CFG[data.status]?.cls ?? ""}`}>
                  {STATUS_CFG[data.status]?.label ?? data.status}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <History className="h-3 w-3" /> Event History
              </p>
              <div className="relative pl-5 space-y-4">
                <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
                {(data.auditChain ?? []).map((ev: any, i: number) => {
                  const Icon = eventIcon[ev.event] ?? AlertCircle;
                  return (
                    <div key={i} className="relative" data-testid={`audit-event-${i}`}>
                      <div className="absolute -left-4 top-0.5 h-3 w-3 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                        <Icon className="h-1.5 w-1.5 text-primary" />
                      </div>
                      <p className="text-sm font-medium capitalize">{ev.event.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{ev.actor} · {ev.at ? new Date(ev.at).toLocaleString() : "—"}</p>
                      {ev.detail && <p className="text-xs text-muted-foreground mt-0.5 italic">{ev.detail}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
