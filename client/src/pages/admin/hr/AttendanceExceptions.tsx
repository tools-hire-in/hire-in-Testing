import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertTriangle, ShieldAlert, TrendingUp, CheckCircle, Clock, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface AttendanceException {
  id: string;
  attendanceDate: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  managerName: string | null;
  exceptionType: string;
  status: string;
  workedHours: number;
  standardHours: number;
  shortfall: number;
  managerComment: string | null;
  resolverName: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface RiskSummaryEntry {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  managerName: string | null;
  monthlyCount: number;
  lastOccurrence: string;
  highestTierReached: number;
  escalationStatus: string;
}

interface RiskSummary {
  month: string;
  results: RiskSummaryEntry[];
  thresholds: { tier1: number; tier2: number; tier3: number };
}

function statusBadge(status: string) {
  if (status === "pending") return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Pending</Badge>;
  if (status === "approved_exception") return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Exception Approved</Badge>;
  if (status === "marked_half_day") return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Marked Half Day</Badge>;
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

function tierBadge(tier: number) {
  if (tier === 3) return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Tier 3</Badge>;
  if (tier === 2) return <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Tier 2</Badge>;
  if (tier === 1) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">Tier 1</Badge>;
  return null;
}

export default function AttendanceExceptions({ view = "exceptions" }: { view?: "exceptions" | "risk-summary" }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [riskTierFilter, setRiskTierFilter] = useState("all");
  const [resolving, setResolving] = useState<AttendanceException | null>(null);
  const [resolveForm, setResolveForm] = useState({ disposition: "approved_exception", comment: "" });

  const { data: departments } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/hr/departments"],
  });

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  if (deptFilter !== "all") queryParams.set("department", deptFilter);

  const { data: exceptions, isLoading: excLoading } = useQuery<AttendanceException[]>({
    queryKey: ["/api/attendance/exceptions/all", statusFilter, startDate, endDate, deptFilter],
    enabled: view === "exceptions",
    queryFn: async () => {
      const res = await fetch(`/api/attendance/exceptions/all?${queryParams}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: riskSummary, isLoading: riskLoading } = useQuery<RiskSummary>({
    queryKey: ["/api/attendance/risk-summary", riskTierFilter],
    enabled: view === "risk-summary",
    queryFn: async () => {
      const params = new URLSearchParams();
      if (riskTierFilter !== "all") params.set("tierFilter", riskTierFilter);
      const res = await fetch(`/api/attendance/risk-summary?${params}`, { credentials: "include" });
      if (!res.ok) return { month: "", results: [], thresholds: { tier1: 2, tier2: 5, tier3: 10 } };
      return res.json();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, disposition, comment }: { id: string; disposition: string; comment: string }) => {
      const res = await apiRequest("POST", `/api/attendance/exceptions/${id}/resolve`, { disposition, comment });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to resolve");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/exceptions/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/exceptions/count"] });
      setResolving(null);
      setResolveForm({ disposition: "approved_exception", comment: "" });
      toast({ title: "Resolved", description: "Exception has been resolved." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleResolve = () => {
    if (!resolving) return;
    if (resolveForm.disposition === "approved_exception" && !resolveForm.comment.trim()) {
      toast({ title: "Comment required", description: "Please add a comment when approving an exception.", variant: "destructive" });
      return;
    }
    resolveMutation.mutate({ id: resolving.id, disposition: resolveForm.disposition, comment: resolveForm.comment });
  };

  return (
    <div className="space-y-4">
      {view === "exceptions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44 h-8 text-sm" data-testid="select-exception-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved_exception">Exception Approved</SelectItem>
                  <SelectItem value="marked_half_day">Marked Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Department</Label>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-44 h-8 text-sm" data-testid="select-exception-dept">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments?.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-sm w-36" data-testid="input-exc-start-date" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-sm w-36" data-testid="input-exc-end-date" />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {excLoading ? (
                <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : !exceptions || exceptions.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-10 w-10 mx-auto text-green-400 mb-3" />
                  <p className="text-muted-foreground">No exceptions found for the selected filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Employee</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Hours / Shortfall</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Manager</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Resolved By</th>
                        <th className="text-right py-3 px-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exceptions.map(exc => (
                        <tr key={exc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors" data-testid={`exc-row-${exc.id}`}>
                          <td className="py-2.5 px-3">
                            <p className="font-medium">{exc.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{exc.departmentName || "—"}</p>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            {exc.attendanceDate}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-medium">{exc.workedHours.toFixed(1)}h</p>
                            <p className="text-xs text-red-600">−{exc.shortfall.toFixed(1)}h short</p>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs">{exc.managerName || "—"}</td>
                          <td className="py-2.5 px-3">{statusBadge(exc.status)}</td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">
                            {exc.resolverName ? (
                              <div>
                                <p>{exc.resolverName}</p>
                                {exc.managerComment && <p className="italic truncate max-w-32" title={exc.managerComment}>"{exc.managerComment}"</p>}
                              </div>
                            ) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {exc.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setResolving(exc); setResolveForm({ disposition: "approved_exception", comment: "" }); }}
                                data-testid={`button-resolve-exc-${exc.id}`}
                              >
                                Resolve
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {view === "risk-summary" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter by Tier:</span>
            <Select value={riskTierFilter} onValueChange={setRiskTierFilter}>
              <SelectTrigger className="w-40 h-8 text-sm" data-testid="select-risk-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="1">Tier 1</SelectItem>
                <SelectItem value="2">Tier 2</SelectItem>
                <SelectItem value="3">Tier 3</SelectItem>
              </SelectContent>
            </Select>
            {riskSummary?.month && (
              <span className="text-xs text-muted-foreground ml-2">Month: {riskSummary.month}</span>
            )}
          </div>

          {riskSummary && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Tier 1 Threshold", value: riskSummary.thresholds.tier1, color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
                { label: "Tier 2 Threshold", value: riskSummary.thresholds.tier2, color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
                { label: "Tier 3 Threshold", value: riskSummary.thresholds.tier3, color: "text-red-700", bg: "bg-red-50 border-red-200" },
              ].map(t => (
                <div key={t.label} className={`rounded-lg border p-3 ${t.bg}`}>
                  <p className={`text-xs ${t.color}`}>{t.label}</p>
                  <p className={`text-2xl font-bold ${t.color}`}>{t.value}</p>
                  <p className="text-xs text-muted-foreground">occurrences/month</p>
                </div>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                Employees with Attendance Risks This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {riskLoading ? (
                <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : !riskSummary?.results || riskSummary.results.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="h-10 w-10 mx-auto text-green-400 mb-3" />
                  <p className="text-muted-foreground">No at-risk employees this month.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Employee</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Department</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Manager</th>
                        <th className="text-center py-3 px-3 font-medium text-muted-foreground">Count</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Last Occurrence</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Escalation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskSummary.results.map(r => (
                        <tr key={r.employeeId} className="border-b last:border-0 hover:bg-muted/30" data-testid={`risk-row-${r.employeeId}`}>
                          <td className="py-2.5 px-3">
                            <p className="font-medium">{r.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{r.employeeCode}</p>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs">{r.departmentName || "—"}</td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs">{r.managerName || "—"}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`font-bold text-lg ${r.highestTierReached === 3 ? "text-red-600" : r.highestTierReached === 2 ? "text-orange-600" : "text-yellow-600"}`}>
                              {r.monthlyCount}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">{r.lastOccurrence}</td>
                          <td className="py-2.5 px-3">{tierBadge(r.highestTierReached)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resolve Dialog (HR override) */}
      <Dialog open={!!resolving} onOpenChange={open => !open && setResolving(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-resolve-exception">
          <DialogHeader>
            <DialogTitle>Resolve Exception — HR Override</DialogTitle>
          </DialogHeader>
          {resolving && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-1">
                <p><span className="font-medium">Employee:</span> {resolving.employeeName}</p>
                <p><span className="font-medium">Date:</span> {resolving.attendanceDate}</p>
                <p><span className="font-medium">Hours Worked:</span> {resolving.workedHours.toFixed(2)}h (shortfall: {resolving.shortfall.toFixed(2)}h)</p>
              </div>
              <div className="space-y-2">
                <Label>Disposition</Label>
                <Select
                  value={resolveForm.disposition}
                  onValueChange={v => setResolveForm(f => ({ ...f, disposition: v }))}
                >
                  <SelectTrigger data-testid="select-disposition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved_exception">Approve as Exception (no leave deduction)</SelectItem>
                    <SelectItem value="marked_half_day">Mark as Half Day (deduct 0.5 leave)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Comment {resolveForm.disposition === "approved_exception" && <span className="text-red-500">*</span>}
                </Label>
                <Textarea
                  value={resolveForm.comment}
                  onChange={e => setResolveForm(f => ({ ...f, comment: e.target.value }))}
                  placeholder="Provide justification…"
                  rows={3}
                  data-testid="textarea-resolve-comment"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={resolveMutation.isPending} data-testid="button-confirm-resolve">
              {resolveMutation.isPending ? "Resolving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
