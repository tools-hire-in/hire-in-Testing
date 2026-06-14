import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  Shield, CheckCircle, Clock, AlertTriangle, Download, RefreshCw, Send,
  Users, FileText, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface PolicyDoc {
  id: string;
  title: string;
  version: number;
  isActive: boolean;
  createdAt: string;
}

interface SignoffRow {
  requestId: string;
  employeeId: string;
  employeeName: string;
  email: string;
  empId: string | null;
  role: string;
  status: string;
  sentAt: string | null;
  signedAt: string | null;
  pdfPath: string | null;
}

interface SignoffStatus {
  rows: SignoffRow[];
  summary: { signed: number; pending: number; overdue: number; total: number };
}

interface Department {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string | null;
}

function statusBadge(status: string) {
  switch (status) {
    case "signed":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Signed</Badge>;
    case "overdue":
      return <Badge variant="destructive">Overdue</Badge>;
    case "pending":
    default:
      return <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">Pending</Badge>;
  }
}

export function PolicySignoffsContent() {
  const { toast } = useToast();
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [pushScope, setPushScope] = useState<"all" | "department" | "individuals">("all");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const { data: policies, isLoading: policiesLoading } = useQuery<PolicyDoc[]>({
    queryKey: ["/api/hr/policies"],
  });

  const { data: signoffStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<SignoffStatus>({
    queryKey: ["/api/hr/policies", selectedPolicyId, "signoff-status"],
    queryFn: async () => {
      const res = await fetch(`/api/hr/policies/${selectedPolicyId}/signoff-status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedPolicyId,
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: showPushDialog,
  });

  const { data: allEmployees } = useQuery<Employee[]>({
    queryKey: ["/api/admin/users/active"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?status=active", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return (data.users || data || []).filter((u: any) => u.isActive);
    },
    enabled: showPushDialog && pushScope === "individuals",
  });

  const filteredEmployees = (allEmployees || []).filter(e => {
    if (!employeeSearch) return true;
    const q = employeeSearch.toLowerCase();
    return `${e.firstName} ${e.lastName}`.toLowerCase().includes(q)
      || (e.email || "").toLowerCase().includes(q)
      || (e.employeeId || "").toLowerCase().includes(q);
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      const body: any = { scope: pushScope };
      if (pushScope === "department") body.departmentId = selectedDeptId;
      if (pushScope === "individuals") body.employeeIds = selectedEmployeeIds;
      return apiRequest("POST", `/api/hr/policies/${selectedPolicyId}/push`, body);
    },
    onSuccess: async (res: any) => {
      const data = await res.json();
      toast({
        title: "Policy pushed",
        description: `${data.created} request(s) created, ${data.skipped} already had pending requests.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/policies", selectedPolicyId, "signoff-status"] });
      setShowPushDialog(false);
      setSelectedEmployeeIds([]);
      setEmployeeSearch("");
      setSelectedDeptId("");
    },
    onError: () => toast({ title: "Failed to push policy", variant: "destructive" }),
  });

  const resendMutation = useMutation({
    mutationFn: (requestId: string) =>
      apiRequest("POST", `/api/hr/policy-requests/${requestId}/resend`, {}),
    onSuccess: () => {
      toast({ title: "Request resent" });
      refetchStatus();
    },
    onError: () => toast({ title: "Failed to resend", variant: "destructive" }),
  });

  function handleExportCsv() {
    if (!selectedPolicyId) return;
    window.open(`/api/hr/policies/${selectedPolicyId}/signoff-export`, "_blank");
  }

  const selectedPolicy = policies?.find(p => p.id === selectedPolicyId);

  return (
    <div className="space-y-6" data-testid="section-policy-signoffs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Policy Sign-offs
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage company policy documents and track employee acknowledgements.
          </p>
        </div>
      </div>

      {/* Policy Selector */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium shrink-0">Select Policy:</Label>
        {policiesLoading ? (
          <Skeleton className="h-9 w-64" />
        ) : (
          <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
            <SelectTrigger className="w-72" data-testid="select-policy">
              <SelectValue placeholder="Choose a policy document…" />
            </SelectTrigger>
            <SelectContent>
              {policies?.map(p => (
                <SelectItem key={p.id} value={p.id} data-testid={`option-policy-${p.id}`}>
                  {p.title} <span className="text-muted-foreground ml-1">v{p.version}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selectedPolicyId && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPushDialog(true)}
              data-testid="button-push-policy"
            >
              <Send className="h-4 w-4 mr-1.5" />
              Push to Employees
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchStatus()}
              data-testid="button-refresh-signoff"
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
          </>
        )}
      </div>

      {/* Summary Cards */}
      {selectedPolicyId && signoffStatus && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold" data-testid="count-total">{signoffStatus.summary.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Signed</p>
                <p className="text-xl font-bold text-green-600" data-testid="count-signed">{signoffStatus.summary.signed}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-bold text-amber-600" data-testid="count-pending">{signoffStatus.summary.pending}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className="text-xl font-bold text-red-600" data-testid="count-overdue">{signoffStatus.summary.overdue}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Table */}
      {selectedPolicyId && (
        <div className="border rounded-lg overflow-hidden">
          {statusLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : signoffStatus && signoffStatus.rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Signed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signoffStatus.rows.map(row => (
                  <TableRow key={row.requestId} data-testid={`row-signoff-${row.requestId}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{row.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{row.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.empId || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{row.role}</Badge>
                    </TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.sentAt ? format(new Date(row.sentAt), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.signedAt ? format(new Date(row.signedAt), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status !== "signed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resendMutation.mutate(row.requestId)}
                          disabled={resendMutation.isPending}
                          data-testid={`button-resend-${row.requestId}`}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Resend
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : signoffStatus ? (
            <div className="py-12 text-center text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No signing requests found for this policy.</p>
              <p className="text-xs mt-1">Use "Push to Employees" to send signing requests.</p>
            </div>
          ) : null}
        </div>
      )}

      {!selectedPolicyId && !policiesLoading && (
        <div className="flex flex-col items-center justify-center py-16 border rounded-lg bg-muted/20">
          <FileText className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
          <p className="text-muted-foreground">Select a policy document to view sign-off status.</p>
        </div>
      )}

      {/* Push Dialog */}
      <Dialog open={showPushDialog} onOpenChange={v => {
        setShowPushDialog(v);
        if (!v) { setSelectedEmployeeIds([]); setEmployeeSearch(""); setSelectedDeptId(""); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Push Policy to Employees</DialogTitle>
            <DialogDescription>
              Send a signing request for <strong>{selectedPolicy?.title}</strong> to employees.
              Employees who already have a pending request will be skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Who should receive this request?</Label>
              <Select value={pushScope} onValueChange={(v) => {
                setPushScope(v as any);
                setSelectedEmployeeIds([]);
                setSelectedDeptId("");
              }}>
                <SelectTrigger data-testid="select-push-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All active employees</SelectItem>
                  <SelectItem value="department">By department</SelectItem>
                  <SelectItem value="individuals">Select individuals</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {pushScope === "department" && (
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                  <SelectTrigger data-testid="select-department">
                    <SelectValue placeholder="Choose a department…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(departments || []).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {pushScope === "individuals" && (
              <div className="space-y-2">
                <Label>Search and select employees</Label>
                <Input
                  placeholder="Search by name, email or ID…"
                  value={employeeSearch}
                  onChange={e => setEmployeeSearch(e.target.value)}
                  data-testid="input-employee-search"
                />
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {filteredEmployees.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No employees found</p>
                  ) : (
                    filteredEmployees.map(emp => {
                      const checked = selectedEmployeeIds.includes(emp.id);
                      return (
                        <div
                          key={emp.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer"
                          onClick={() => setSelectedEmployeeIds(prev =>
                            checked ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                          )}
                          data-testid={`emp-select-${emp.id}`}
                        >
                          <Checkbox checked={checked} readOnly />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{emp.firstName} {emp.lastName}</p>
                            <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                          </div>
                          {emp.employeeId && (
                            <span className="text-xs text-muted-foreground shrink-0">{emp.employeeId}</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                {selectedEmployeeIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedEmployeeIds.length} employee(s) selected</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPushDialog(false)}>Cancel</Button>
            <Button
              onClick={() => pushMutation.mutate()}
              disabled={
                pushMutation.isPending
                || (pushScope === "department" && !selectedDeptId)
                || (pushScope === "individuals" && selectedEmployeeIds.length === 0)
              }
              data-testid="button-confirm-push"
            >
              {pushMutation.isPending ? "Sending…" : "Send Requests"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
