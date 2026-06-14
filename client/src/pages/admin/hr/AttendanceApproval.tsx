import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, Clock, AlertTriangle, Edit2, Users, Timer, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const FIELD_LABELS: Record<string, string> = {
  presentDays: "Present Days",
  absentDays: "Absent Days",
  lopDays: "LOP Days",
  leaveDays: "Leave Days",
  holidayDays: "Holiday Days",
  totalHours: "Total Hours",
};

const FIELDS = Object.keys(FIELD_LABELS);

function computeCountdown(deadlineAt: string): { label: string; expired: boolean } {
  const diff = new Date(deadlineAt).getTime() - Date.now();
  if (diff <= 0) return { label: "Deadline expired", expired: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { label: `${h}h ${m}m ${s}s remaining`, expired: false };
}

function useDeadlineCountdown(deadlineAt: string | null | undefined) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!deadlineAt) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [deadlineAt]);
  if (!deadlineAt) return { label: "", expired: false };
  return computeCountdown(deadlineAt);
}

function statusBadge(status: string) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-700">Approved</Badge>;
  if (status === "overridden") return <Badge className="bg-blue-100 text-blue-700">Overridden</Badge>;
  if (status === "edits_submitted") return <Badge className="bg-orange-100 text-orange-700">Edits Submitted</Badge>;
  if (status === "in_review") return <Badge className="bg-yellow-100 text-yellow-700">In Review</Badge>;
  if (status === "deadline_expired") return <Badge className="bg-red-100 text-red-700">Deadline Expired</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

function managerStatusBadge(status: string) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-700">Approved</Badge>;
  if (status === "edits_submitted") return <Badge className="bg-orange-100 text-orange-700">Edits Submitted</Badge>;
  if (status === "overridden") return <Badge className="bg-blue-100 text-blue-700">Overridden</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

interface CorrectionRow {
  entryId: string;
  field: string;
  proposedValue: string;
  reason: string;
}

export default function AttendanceApproval() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const { data: myRunData, isLoading: runLoading } = useQuery<any>({
    queryKey: ["/api/hr/attendance-report/my-run"],
    refetchInterval: 60_000,
  });

  const run = myRunData?.run;

  const countdown = useDeadlineCountdown(run?.deadline_at);

  const { data: workspaceData, isLoading: wsLoading } = useQuery<any>({
    queryKey: ["/api/hr/attendance-report/runs", run?.run_id, "my-team"],
    enabled: !!run?.run_id,
    queryFn: () => apiRequest("GET", `/api/hr/attendance-report/runs/${run.run_id}/my-team`).then(r => r.json()),
  });

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/hr/attendance-report/runs/${run?.run_id}/approve`).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Attendance approved successfully" });
      qc.invalidateQueries({ queryKey: ["/api/hr/attendance-report/my-run"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/attendance-report/runs"] });
      setConfirmApproveOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const editsMutation = useMutation({
    mutationFn: (correctionList: CorrectionRow[]) =>
      apiRequest("POST", `/api/hr/attendance-report/runs/${run?.run_id}/edits`, { corrections: correctionList }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Corrections submitted for HR review" });
      qc.invalidateQueries({ queryKey: ["/api/hr/attendance-report/my-run"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/attendance-report/runs", run?.run_id, "my-team"] });
      setEditDialogOpen(false);
      setCorrections([]);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (runLoading) return <div className="text-muted-foreground p-4">Loading…</div>;

  if (!run) {
    return (
      <Card data-testid="card-no-approval-run">
        <CardContent className="p-8 text-center text-muted-foreground">
          <CheckCircle className="mx-auto mb-3 text-green-400" size={40} />
          <p className="font-medium">No pending attendance approval</p>
          <p className="text-sm mt-1">Your team's attendance report will appear here when HR generates it for a new month.</p>
        </CardContent>
      </Card>
    );
  }

  const alreadyActed = run.manager_status === "approved" || run.manager_status === "edits_submitted" || run.manager_status === "overridden";
  // Lock based on actual current time vs deadline_at (not just server status), so UI locks immediately at deadline
  const runExpired = run.status === "deadline_expired" || countdown.expired;
  const runClosed = run.status === "approved" || run.status === "overridden";
  const actionsLocked = runExpired || runClosed || alreadyActed;

  const entries = workspaceData?.entries || [];
  const existingEdits = workspaceData?.edits || [];

  const toggleEntry = (id: string) => {
    setExpandedEntries(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const addCorrection = (entryId: string) => {
    setCorrections(prev => {
      if (prev.some(c => c.entryId === entryId)) return prev;
      return [...prev, { entryId, field: "presentDays", proposedValue: "", reason: "" }];
    });
    setEditDialogOpen(true);
  };

  const updateCorrection = (idx: number, field: keyof CorrectionRow, value: string) => {
    setCorrections(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const removeCorrection = (idx: number) => {
    setCorrections(prev => prev.filter((_, i) => i !== idx));
  };

  const submitEdits = () => {
    const valid = corrections.filter(c => c.proposedValue !== "" && c.reason.trim());
    if (valid.length === 0) {
      toast({ title: "No valid corrections", description: "Each correction needs a proposed value and reason", variant: "destructive" });
      return;
    }
    const finalCorrections = valid.map(c => ({
      entryId: c.entryId,
      field: c.field,
      proposedValue: parseFloat(c.proposedValue),
      reason: c.reason.trim(),
    }));
    editsMutation.mutate(finalCorrections as any);
  };

  const monthName = run.month ? new Date(run.year, run.month - 1, 1).toLocaleString("en-US", { month: "long" }) : "";

  return (
    <div className="space-y-4" data-testid="section-attendance-approval">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Attendance Approval — {monthName} {run.year}</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Review and approve your team's attendance data before the salary run</p>
            </div>
            <div className="flex gap-2 items-center">
              {statusBadge(run.status)}
              {managerStatusBadge(run.manager_status)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {run.deadline_at && (
            <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm font-medium ${
              runExpired ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
            }`}>
              <Timer size={16} />
              <span data-testid="text-approval-deadline">
                {countdown.label || (runExpired ? "Deadline expired" : "")}
              </span>
            </div>
          )}

          {alreadyActed && !runClosed && (
            <Alert className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {run.manager_status === "approved"
                  ? "You approved this month's attendance. Waiting for other managers."
                  : run.manager_status === "edits_submitted"
                  ? "Your corrections have been submitted. HR will review and the salary run will proceed once resolved."
                  : "This approval has been overridden by HR."}
              </AlertDescription>
            </Alert>
          )}

          {runClosed && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Attendance approved. Salary run can now be generated.
              </AlertDescription>
            </Alert>
          )}

          {wsLoading ? (
            <div className="text-muted-foreground text-sm py-4 text-center">Loading team data…</div>
          ) : (
            <div className="space-y-2" data-testid="list-team-entries">
              {entries.map((entry: any) => {
                const isExpanded = expandedEntries.has(entry.id);
                const entryEdits = existingEdits.filter((e: any) => e.entry_id === entry.id);
                return (
                  <div key={entry.id} className="border rounded-lg" data-testid={`card-entry-${entry.id}`}>
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40"
                      onClick={() => toggleEntry(entry.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                          {entry.first_name?.[0]}{entry.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{entry.first_name} {entry.last_name}</p>
                          <p className="text-xs text-muted-foreground">{entry.designation || "—"} · {entry.employee_id || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">{Number(entry.cur_present_days).toFixed(1)} present</span>
                        <span className={Number(entry.cur_lop_days) > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>{Number(entry.cur_lop_days).toFixed(1)} LOP</span>
                        {entryEdits.length > 0 && <Badge variant="outline" className="text-xs">Edited</Badge>}
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t px-3 pb-3 pt-2 bg-muted/20">
                        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                          {["cur_present_days", "cur_absent_days", "cur_lop_days", "cur_leave_days", "cur_holiday_days", "cur_total_hours"].map(field => {
                            const label = FIELD_LABELS[field.replace("cur_", "").replace(/_([a-z])/g, (_: string, l: string) => l.toUpperCase())] || field;
                            return (
                              <div key={field} className="bg-white dark:bg-background rounded p-2 border">
                                <p className="text-muted-foreground">{label}</p>
                                <p className="font-semibold text-sm">{Number(entry[field]).toFixed(1)}</p>
                              </div>
                            );
                          })}
                        </div>
                        {entryEdits.length > 0 && (
                          <div className="mb-2 text-xs text-muted-foreground">
                            <p className="font-medium mb-1">Submitted corrections:</p>
                            {entryEdits.map((ed: any) => (
                              <div key={ed.id} className="flex items-center gap-2 py-0.5">
                                <Badge variant="outline" className="text-xs">{FIELD_LABELS[ed.field] || ed.field}</Badge>
                                <span>{Number(ed.original_value).toFixed(1)} → {Number(ed.proposed_value).toFixed(1)}</span>
                                <Badge className={ed.status === "approved" ? "bg-green-100 text-green-700" : ed.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"} >{ed.status}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                        {!actionsLocked && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => addCorrection(entry.id)}
                            data-testid={`button-propose-correction-${entry.id}`}
                          >
                            <Edit2 size={12} className="mr-1" /> Propose Correction
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {entries.length === 0 && (
                <div className="text-center text-muted-foreground py-6 text-sm">No team members in this report</div>
              )}
            </div>
          )}

          {!actionsLocked && (
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <Button
                onClick={() => setConfirmApproveOpen(true)}
                className="gap-2"
                data-testid="button-approve-attendance"
                disabled={approveMutation.isPending}
              >
                <CheckCircle size={16} />
                Approve Attendance
              </Button>
              {corrections.length > 0 && (
                <Button variant="outline" onClick={() => setEditDialogOpen(true)} data-testid="button-view-corrections">
                  View Corrections ({corrections.length})
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmApproveOpen} onOpenChange={setConfirmApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Team Attendance</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You are confirming that the attendance data for your team for <strong>{monthName} {run?.year}</strong> is correct. This will allow the salary run to proceed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApproveOpen(false)}>Cancel</Button>
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} data-testid="button-confirm-approve">
              {approveMutation.isPending ? "Approving…" : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Attendance Corrections</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Corrections will be reviewed by HR. The salary run will hold until all corrections are resolved.</p>
          <div className="space-y-4 mt-2">
            {corrections.map((corr, idx) => {
              const entry = entries.find((e: any) => e.id === corr.entryId);
              return (
                <div key={idx} className="border rounded-lg p-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">{entry?.first_name} {entry?.last_name}</p>
                    <Button size="sm" variant="ghost" onClick={() => removeCorrection(idx)} className="text-red-500 h-7 text-xs">Remove</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Field to Correct</Label>
                      <select
                        className="mt-1 w-full text-sm border rounded px-2 py-1.5 bg-background"
                        value={corr.field}
                        onChange={e => updateCorrection(idx, "field", e.target.value)}
                        data-testid={`select-field-${idx}`}
                      >
                        {FIELDS.map(f => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Proposed Value</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        className="mt-1 h-8 text-sm"
                        value={corr.proposedValue}
                        onChange={e => updateCorrection(idx, "proposedValue", e.target.value)}
                        data-testid={`input-proposed-value-${idx}`}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Reason / Justification</Label>
                    <Textarea
                      className="mt-1 text-sm h-20"
                      placeholder="Explain the correction…"
                      value={corr.reason}
                      onChange={e => updateCorrection(idx, "reason", e.target.value)}
                      data-testid={`textarea-reason-${idx}`}
                    />
                  </div>
                </div>
              );
            })}
            {corrections.length === 0 && (
              <div className="text-center text-muted-foreground py-4 text-sm">
                Click "Propose Correction" on an employee row to add corrections here.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            {corrections.length > 0 && (
              <Button onClick={submitEdits} disabled={editsMutation.isPending} data-testid="button-submit-corrections">
                {editsMutation.isPending ? "Submitting…" : `Submit ${corrections.length} Correction(s)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
