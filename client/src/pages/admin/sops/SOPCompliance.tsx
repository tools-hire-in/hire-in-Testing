import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShieldCheck, Download, AlertTriangle, ClipboardCheck, TrendingUp, Users, ChevronRight, BookOpen, ListChecks, Pencil } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSopAccess } from "@/hooks/use-sop-access";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OwnerUser { id: string; firstName: string | null; lastName: string | null; email: string; }
function ownerLabel(u: OwnerUser) { return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email; }

const GOVERNANCE_ROLES = ["super_admin", "admin", "hr", "operations"];

interface SopRow {
  id: string; sopMasterId: string; code: string; title: string; category: string; launchWave: number;
  lifecycleStatus: string; version: number; auditOwnerRole: string | null;
  impacted: number; trained: number; acknowledged: number; adoptionPct: number;
  openFindings: number; overdueReviews: number;
  lastAuditWeek: string | null; lastAuditScore: number | null;
}
interface DeptOption { id: string; name: string; }
interface ComplianceSummary {
  summary: {
    totalSops: number; adoptionPct: number; trainingPct: number; ackGaps: number;
    openFindings: number; overdueReviews: number; auditedThisWeek: number; auditCoveragePct: number;
  };
  filters: { categories: string[]; departments: DeptOption[]; roles: string[] };
  sops: SopRow[];
}

interface FindingRow {
  id: string; sopMasterId: string; sopId: string | null; sopCode: string; sopTitle: string | null;
  description: string; correctiveAction: string | null; status: string; dueDate: string | null;
  ownerId: string | null; raisedByName: string | null; ownerName: string | null; overdue: boolean; createdAt: string;
}

interface DrillEmployee { userId: string; name: string; role: string | null; trained: boolean; acknowledgedCurrent: boolean; acknowledgedVersion: number | null; acknowledgedAt: string | null; }
interface DrillRecord { id: string; weekDate: string | null; createdAt: string; auditorName: string | null; evidenceCollected: boolean; missesCount: number; auditScore: number | null; }
interface DrillFinding { id: string; description: string; correctiveAction: string | null; status: string; dueDate: string | null; raisedByName: string | null; ownerName: string | null; }
interface DrillData {
  sop: { id: string; code: string; title: string; category: string; version: number; lifecycleStatus: string; auditOwnerRole: string | null };
  employees: DrillEmployee[];
  records: DrillRecord[];
  findings: DrillFinding[];
}

function SummaryCard({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <Card data-testid={`card-summary-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className={`h-3.5 w-3.5 ${tone ?? ""}`} /> {label}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function findingStatusVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  if (status === "resolved" || status === "closed") return "default";
  if (status === "open") return "destructive";
  return "secondary";
}

export default function SOPCompliance() {
  const { enabled, isLoading: accessLoading } = useSopAccess();
  const { user } = useAuth();
  // Governance dashboards are scoped to CEO/Ops/HR (+admin) — managers run audits
  // but do not get the cross-SOP governance view.
  const canViewGovernance = GOVERNANCE_ROLES.includes((user as any)?.role ?? "");
  const [category, setCategory] = useState("all");
  const [wave, setWave] = useState("all");
  const [role, setRole] = useState("all");
  const [department, setDepartment] = useState("all");
  const [drillId, setDrillId] = useState<string | null>(null);

  // Pass filters as an OBJECT secondary key so the default fetcher builds a proper
  // `?query=string` URL. A string here would be join("/")-ed into a broken path.
  const filters = useMemo(() => ({
    category: category === "all" ? undefined : category,
    wave: wave === "all" ? undefined : wave,
    role: role === "all" ? undefined : role,
    department: department === "all" ? undefined : department,
  }), [category, wave, role, department]);

  const { data, isLoading } = useQuery<ComplianceSummary>({
    queryKey: ["/api/sops/compliance/summary", filters],
    enabled: enabled && canViewGovernance,
  });

  const waves = useMemo(() => Array.from(new Set((data?.sops ?? []).map((s) => s.launchWave))).sort((a, b) => a - b), [data]);

  const exportCsv = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, String(v)); });
    const qs = params.toString();
    window.open(`/api/sops/compliance/export${qs ? `?${qs}` : ""}`, "_blank");
  };

  if (accessLoading) {
    return <AdminLayout><div className="p-6"><Skeleton className="h-64 w-full" /></div></AdminLayout>;
  }
  if (!enabled || !canViewGovernance) {
    return (
      <AdminLayout>
        <div className="p-6 max-w-md mx-auto text-center">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold">Governance dashboard unavailable</h2>
          <p className="text-sm text-muted-foreground mt-1">This cross-SOP governance view is limited to HR, Operations, and leadership.</p>
        </div>
      </AdminLayout>
    );
  }

  const s = data?.summary;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <ShieldCheck className="h-5 w-5 text-primary" /> SOP Governance Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">Adoption, audit coverage, and open findings across all live SOPs.</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} data-testid="button-export-csv">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview"><TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Overview</TabsTrigger>
            <TabsTrigger value="findings" data-testid="tab-findings"><ListChecks className="h-3.5 w-3.5 mr-1.5" /> Findings Tracker</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5 mt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-44" data-testid="select-filter-category"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {(data?.filters.categories ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={wave} onValueChange={setWave}>
                <SelectTrigger className="w-36" data-testid="select-filter-wave"><SelectValue placeholder="Wave" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All waves</SelectItem>
                  {waves.map((w) => <SelectItem key={w} value={String(w)}>Wave {w}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-44" data-testid="select-filter-role"><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {(data?.filters.roles ?? []).map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="w-48" data-testid="select-filter-department"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {(data?.filters.departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isLoading || !s ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard icon={BookOpen} label="Live SOPs" value={s.totalSops} sub={`${s.trainingPct}% trained`} />
                <SummaryCard icon={TrendingUp} label="Adoption" value={`${s.adoptionPct}%`} sub={`${s.ackGaps} ack gaps`} tone="text-green-600" />
                <SummaryCard icon={ClipboardCheck} label="Audit Coverage" value={`${s.auditCoveragePct}%`} sub={`${s.auditedThisWeek}/${s.totalSops} this week`} tone="text-blue-600" />
                <SummaryCard icon={AlertTriangle} label="Open Findings" value={s.openFindings} sub={`${s.overdueReviews} overdue reviews`} tone="text-amber-600" />
              </div>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Per-SOP compliance</CardTitle></CardHeader>
              <CardContent className="px-0">
                {isLoading ? (
                  <div className="px-6"><Skeleton className="h-40 w-full" /></div>
                ) : (data?.sops.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground px-6 py-4" data-testid="text-no-sops">No live SOPs match these filters.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SOP</TableHead>
                          <TableHead className="text-center">Adoption</TableHead>
                          <TableHead className="text-center">Audit</TableHead>
                          <TableHead className="text-center">Findings</TableHead>
                          <TableHead className="text-center">Reviews</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data!.sops.map((row) => (
                          <TableRow key={row.id} className="cursor-pointer" onClick={() => setDrillId(row.id)} data-testid={`row-sop-${row.code}`}>
                            <TableCell>
                              <div className="font-medium">{row.code}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[220px]">{row.title}</div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <Progress value={row.adoptionPct} className="w-16 h-1.5" />
                                <span className="text-xs tabular-nums w-9">{row.adoptionPct}%</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground">{row.acknowledged}/{row.impacted}</div>
                            </TableCell>
                            <TableCell className="text-center text-xs">
                              {row.lastAuditWeek ? (
                                <span data-testid={`text-audit-${row.code}`}>{row.lastAuditWeek}{row.lastAuditScore != null ? ` · ${row.lastAuditScore}` : ""}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {row.openFindings > 0 ? (
                                <Badge variant="destructive" className="text-[10px]">{row.openFindings}</Badge>
                              ) : <span className="text-xs text-muted-foreground">0</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {row.overdueReviews > 0 ? (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">{row.overdueReviews}</Badge>
                              ) : <span className="text-xs text-muted-foreground">0</span>}
                            </TableCell>
                            <TableCell className="text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="findings" className="mt-4">
            <FindingsTracker
              sops={data?.sops ?? []}
              onOpenSop={(sopId) => setDrillId(sopId)}
            />
          </TabsContent>
        </Tabs>
      </div>

      {drillId && <DrillDownDrawer sopId={drillId} onClose={() => setDrillId(null)} />}
    </AdminLayout>
  );
}

function FindingsTracker({ sops, onOpenSop }: { sops: SopRow[]; onOpenSop: (sopId: string) => void }) {
  const [status, setStatus] = useState("all");
  const [sopMasterId, setSopMasterId] = useState("all");
  const [ownerId, setOwnerId] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState("all");
  const [editing, setEditing] = useState<FindingRow | null>(null);

  const filters = useMemo(() => ({
    status: status === "all" ? undefined : status,
    sopMasterId: sopMasterId === "all" ? undefined : sopMasterId,
    ownerId: ownerId === "all" ? undefined : ownerId,
    overdue: overdueOnly === "overdue" ? "true" : undefined,
  }), [status, sopMasterId, ownerId, overdueOnly]);

  const { data: findings, isLoading } = useQuery<FindingRow[]>({
    queryKey: ["/api/sops/compliance/findings", filters],
  });
  // Unfiltered fetch purely to build a STABLE owner dropdown (so options don't
  // collapse when the user filters by owner). Cached/deduped by react-query.
  const { data: allFindings } = useQuery<FindingRow[]>({
    queryKey: ["/api/sops/compliance/findings", {}],
  });

  // Stable options from the (unfiltered) summary rows, keyed by the real master id.
  const dropdownOptions = useMemo(
    () => sops.map((s) => ({ sopMasterId: s.sopMasterId, code: s.code })),
    [sops],
  );
  const ownerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (allFindings ?? []).forEach((f) => {
      if (f.ownerId && f.ownerName && !seen.has(f.ownerId)) seen.set(f.ownerId, f.ownerName);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ ownerId: id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allFindings]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Findings Tracker</CardTitle>
        <div className="flex items-center gap-2 flex-wrap pt-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40" data-testid="select-finding-filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sopMasterId} onValueChange={setSopMasterId}>
            <SelectTrigger className="w-48" data-testid="select-finding-filter-sop"><SelectValue placeholder="SOP" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SOPs</SelectItem>
              {dropdownOptions.map((o) => <SelectItem key={o.sopMasterId} value={o.sopMasterId}>{o.code}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger className="w-48" data-testid="select-finding-filter-owner"><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {ownerOptions.map((o) => <SelectItem key={o.ownerId} value={o.ownerId}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={overdueOnly} onValueChange={setOverdueOnly}>
            <SelectTrigger className="w-40" data-testid="select-finding-filter-overdue"><SelectValue placeholder="Overdue" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All findings</SelectItem>
              <SelectItem value="overdue">Overdue only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {isLoading ? (
          <div className="px-6"><Skeleton className="h-40 w-full" /></div>
        ) : (findings?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground px-6 py-4" data-testid="text-no-findings">No findings match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SOP</TableHead>
                  <TableHead>Finding</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-center">Due</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {findings!.map((f) => (
                  <TableRow key={f.id} data-testid={`row-finding-${f.id}`}>
                    <TableCell>
                      <button
                        className="font-medium text-left hover:underline"
                        onClick={() => f.sopId && onOpenSop(f.sopId)}
                        data-testid={`button-finding-sop-${f.id}`}
                      >
                        {f.sopCode}
                      </button>
                      {f.sopTitle && <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">{f.sopTitle}</div>}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="text-xs">{f.description}</div>
                      {f.correctiveAction && <div className="text-[10px] text-muted-foreground">Action: {f.correctiveAction}</div>}
                      {f.raisedByName && <div className="text-[10px] text-muted-foreground">Raised by {f.raisedByName}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{f.ownerName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center text-xs">
                      {f.dueDate ? (
                        <span className={f.overdue ? "text-destructive font-medium" : ""} data-testid={`text-finding-due-${f.id}`}>{f.dueDate}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={findingStatusVariant(f.status)} className="text-[10px] capitalize" data-testid={`badge-finding-status-${f.id}`}>{f.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(f)} data-testid={`button-manage-finding-${f.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {editing && <FindingManageDialog finding={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

const FINDING_STATUSES = ["open", "in_progress", "resolved", "closed"];

function FindingManageDialog({ finding, onClose }: { finding: FindingRow; onClose: () => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(finding.status);
  const [owner, setOwner] = useState(finding.ownerId ?? "none");
  const [dueDate, setDueDate] = useState(finding.dueDate ?? "");
  const [correctiveAction, setCorrectiveAction] = useState(finding.correctiveAction ?? "");

  const { data: usersResp } = useQuery<{ users: OwnerUser[] }>({ queryKey: ["/api/admin/users"] });
  const owners = usersResp?.users ?? [];

  const save = useMutation({
    mutationFn: async () =>
      (await apiRequest("PATCH", `/api/sops/findings/${finding.id}`, {
        status,
        ownerId: owner === "none" ? null : owner,
        dueDate: dueDate || null,
        correctiveAction: correctiveAction.trim() || null,
      })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops/compliance/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sops/compliance/summary"] });
      toast({ title: "Finding updated" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Update failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="dialog-manage-finding">
        <DialogHeader>
          <DialogTitle>{finding.sopCode} — Manage finding</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">{finding.description}</p>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-manage-finding-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FINDING_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Owner</Label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger data-testid="select-manage-finding-owner"><SelectValue placeholder="Assign owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {owners.map((u) => <SelectItem key={u.id} value={u.id}>{ownerLabel(u)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="input-manage-finding-due" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Corrective action</Label>
            <Textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} rows={3} placeholder="What will be done to close this?" data-testid="input-manage-finding-action" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-manage-finding-cancel">Cancel</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()} data-testid="button-manage-finding-save">
            {save.isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DrillDownDrawer({ sopId, onClose }: { sopId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<DrillData>({ queryKey: ["/api/sops", sopId, "compliance"] });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="drawer-sop-drilldown">
        {isLoading || !data ? (
          <Skeleton className="h-64 w-full mt-6" />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{data.sop.code} — {data.sop.title}</SheetTitle>
              <SheetDescription>{data.sop.category} · v{data.sop.version} · {data.sop.lifecycleStatus}</SheetDescription>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-fit"
                onClick={() => window.open(`/api/sops/${sopId}/compliance/export`, "_blank")}
                data-testid="button-drill-export-csv"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export employees CSV
              </Button>
            </SheetHeader>

            <div className="mt-4 space-y-5 text-sm">
              <div>
                <p className="font-medium mb-1.5 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Employees ({data.employees.length})</p>
                {data.employees.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No impacted employees.</p>
                ) : (
                  <div className="space-y-1">
                    {data.employees.map((e) => (
                      <div key={e.userId} className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-xs" data-testid={`row-drill-emp-${e.userId}`}>
                        <div className="min-w-0">
                          <span className="font-medium">{e.name}{e.role && <span className="text-muted-foreground capitalize ml-1.5">{e.role.replace(/_/g, " ")}</span>}</span>
                          {e.acknowledgedAt ? (
                            <div className="text-[10px] text-muted-foreground" data-testid={`text-drill-ack-${e.userId}`}>
                              Ack v{e.acknowledgedVersion ?? "?"} · {new Date(e.acknowledgedAt).toLocaleDateString()}
                            </div>
                          ) : (
                            <div className="text-[10px] text-muted-foreground">Not acknowledged</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant={e.trained ? "default" : "outline"} className="text-[10px]">{e.trained ? "Trained" : "Pending"}</Badge>
                          <Badge variant={e.acknowledgedCurrent ? "default" : "secondary"} className="text-[10px]">{e.acknowledgedCurrent ? "Ack current" : e.acknowledgedAt ? "Outdated ack" : "Not ack"}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-3">
                <p className="font-medium mb-1.5 flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Audits ({data.records.length})</p>
                {data.records.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No audits recorded.</p>
                ) : (
                  <div className="space-y-1">
                    {data.records.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs">
                        <span>{r.weekDate ?? new Date(r.createdAt).toLocaleDateString()}{r.auditorName && <span className="text-muted-foreground ml-1.5">by {r.auditorName}</span>}</span>
                        <div className="flex items-center gap-1.5">
                          {r.missesCount > 0 && <Badge variant="destructive" className="text-[10px]">{r.missesCount} miss</Badge>}
                          {r.auditScore != null && <Badge variant="secondary" className="text-[10px]">Score {r.auditScore}</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-3">
                <p className="font-medium mb-1.5 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Findings ({data.findings.length})</p>
                {data.findings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No findings.</p>
                ) : (
                  <div className="space-y-2">
                    {data.findings.map((f) => (
                      <div key={f.id} className="rounded border p-2.5 text-xs space-y-1" data-testid={`row-drill-finding-${f.id}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{f.description}</p>
                          <Badge variant={f.status === "resolved" ? "default" : f.status === "open" ? "destructive" : "secondary"} className="text-[10px] shrink-0 capitalize">{f.status.replace("_", " ")}</Badge>
                        </div>
                        {f.correctiveAction && <p className="text-muted-foreground">Action: {f.correctiveAction}</p>}
                        <div className="flex items-center gap-3 text-muted-foreground">
                          {f.raisedByName && <span>By {f.raisedByName}</span>}
                          {f.dueDate && <span>Due {f.dueDate}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
