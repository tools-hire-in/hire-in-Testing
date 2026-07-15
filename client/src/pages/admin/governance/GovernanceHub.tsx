import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ActionRequiredFeed, type ActionItem } from "@/components/admin/governance/ActionRequiredFeed";
import GovernanceSettingsPanel from "@/components/admin/governance/GovernanceSettingsPanel";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  BookOpen,
  Target,
  ClipboardList,
  GraduationCap,
  CalendarCheck,
  Loader2,
  TrendingDown,
  Settings2,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
} from "lucide-react";

interface GovernancePulse {
  sop: {
    totalAssigned: number;
    acknowledged: number;
    overdue: number;
    waves: Array<{
      waveNumber: number;
      name: string;
      activated: boolean;
      sopCount: number;
      ackPercent: number;
    }>;
  };
  training: {
    totalActive: number;
    compliant: number;
    overdue: number;
    locked: number;
  };
  plans: {
    pip: { active: number; acknowledged: number; overdueCoaching: number; noCoachingInThreshold: number; checkInsInProgress: number };
    growth: { active: number };
    probation: { active: number; overdueCoaching: number };
    perManager: Array<{
      managerId: string;
      managerName: string;
      pipsActive: number;
      pipsStalled: number;
      growthPlansActive: number;
      probationActive: number;
      checkInsOverdue: number;
    }>;
  };
  probation: {
    dueSoon: Array<{ employeeId: string; employeeName: string; milestoneDay: number; daysUntilDue: number }>;
    missedRecently: Array<{ employeeId: string; employeeName: string; milestoneDay: number; missedDaysAgo: number; strikeCount: number }>;
  };
  goals: {
    healthSplit: { onTrack: number; atRisk: number; overdue: number; total: number };
    escalatedWithCoachingGap: Array<{ goalId: string; goalTitle: string; employeeName: string; daysSinceLastCoaching: number; daysOverdue: number }>;
  };
  checkins: {
    org: { scheduled: number; completed: number; missed: number; completionRate: number };
    perManager: Array<{ managerId: string; managerName: string; scheduled: number; completed: number; missed: number; missRate: number; consecutiveMisses: number }>;
  };
  action_items: ActionItem[];
  generatedAt: string;
}

interface PendingGoal {
  id: string;
  title: string;
  progress: number;
  suggested_progress: number;
  suggested_progress_at: string;
  progress_anomaly_flagged: boolean;
  plan_id: string | null;
  manager_id: string | null;
  employee_name: string;
}

interface WaveApprovalStatus {
  waveNumber: number;
  name: string;
  status: string;
  enforcement: string;
  sopCount: number;
  operationalCount: number;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalNotes: string | null;
}

function PulseStatCard({
  title,
  icon: Icon,
  value,
  label,
  sub,
  severity,
  onClick,
}: {
  title: string;
  icon: typeof ShieldCheck;
  value: number | string;
  label: string;
  sub?: string;
  severity?: "ok" | "warn" | "critical";
  onClick?: () => void;
}) {
  const colors = {
    ok: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20",
    warn: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20",
    critical: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20",
  };
  const valueColors = {
    ok: "text-green-700 dark:text-green-300",
    warn: "text-amber-700 dark:text-amber-300",
    critical: "text-red-700 dark:text-red-300",
  };
  const iconBg = {
    ok: "bg-green-100 dark:bg-green-900/40 text-green-600",
    warn: "bg-amber-100 dark:bg-amber-900/40 text-amber-600",
    critical: "bg-red-100 dark:bg-red-900/40 text-red-600",
  };
  const s = severity ?? "ok";

  return (
    <button
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-shadow hover:shadow-md",
        colors[s],
        onClick && "cursor-pointer",
      )}
      onClick={onClick}
      data-testid={`pulse-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("rounded-lg p-2 shrink-0", iconBg[s])}>
          <Icon className="h-4 w-4" />
        </div>
        <span className={cn("text-2xl font-bold tabular-nums", valueColors[s])}>{value}</span>
      </div>
      <div className="mt-2">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </button>
  );
}

function ManagerComplianceTab({ isHrReadOnly }: { isHrReadOnly: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [adjustingGoalId, setAdjustingGoalId] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState<number>(0);
  const [approveWave, setApproveWave] = useState<number | null>(null);
  const [approveNotes, setApproveNotes] = useState("");

  const { data: pendingGoals, isLoading: goalsLoading } = useQuery<{ goals: PendingGoal[] }>({
    queryKey: ["/api/hr/goals/pending-review"],
    staleTime: 2 * 60 * 1000,
  });

  const { data: waveApprovalData, isLoading: wavesLoading } = useQuery<{ waves: WaveApprovalStatus[] }>({
    queryKey: ["/api/sops/waves/pending-approval"],
    staleTime: 2 * 60 * 1000,
  });

  const confirmMutation = useMutation({
    mutationFn: (goalId: string) => apiRequest("POST", `/api/hr/goals/${goalId}/confirm-progress`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/goals/pending-review"] });
      toast({ title: "Progress confirmed" });
    },
    onError: () => toast({ title: "Failed to confirm progress", variant: "destructive" }),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ goalId, progress }: { goalId: string; progress: number }) =>
      apiRequest("POST", `/api/hr/goals/${goalId}/adjust-progress`, { progress }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/goals/pending-review"] });
      setAdjustingGoalId(null);
      toast({ title: "Progress adjusted" });
    },
    onError: () => toast({ title: "Failed to adjust progress", variant: "destructive" }),
  });

  const waveApproveMutation = useMutation({
    mutationFn: ({ wave, notes }: { wave: number; notes: string }) =>
      apiRequest("POST", `/api/sops/waves/${wave}/approve`, { riskAcknowledged: true, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sops/waves/pending-approval"] });
      setApproveWave(null);
      setApproveNotes("");
      toast({ title: "Wave approved" });
    },
    onError: () => toast({ title: "Failed to approve wave", variant: "destructive" }),
  });

  const goals = pendingGoals?.goals ?? [];
  const waves = waveApprovalData?.waves ?? [];
  const anomalyGoals = goals.filter(g => g.progress_anomaly_flagged);
  const normalGoals = goals.filter(g => !g.progress_anomaly_flagged);
  const unapprovedWaves = waves.filter(w => !w.approved && w.status === "active");

  function formatAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "< 1h ago";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <div className="space-y-6">
      {/* Wave Approval Gate */}
      {unapprovedWaves.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800" data-testid="wave-approval-gate">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" />
              Wave Approval Required
            </CardTitle>
            <p className="text-xs text-red-600 dark:text-red-400">
              Waves ≥ 3 require an explicit approval before employee SOP timers start. Until approved, new obligations are queued.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {unapprovedWaves.map(w => (
              <div key={w.waveNumber} className="flex items-center justify-between gap-3 rounded-lg bg-white dark:bg-red-950/30 border border-red-200 p-3" data-testid={`wave-approval-row-${w.waveNumber}`}>
                <div>
                  <p className="text-sm font-medium">Wave {w.waveNumber} — {w.name}</p>
                  <p className="text-xs text-muted-foreground">{w.sopCount} SOPs · {w.operationalCount} operational · enforcement: {w.enforcement}</p>
                </div>
                {!isHrReadOnly && (
                  approveWave === w.waveNumber ? (
                    <div className="flex flex-col gap-2 w-64">
                      <textarea
                        className="border rounded text-xs p-2 resize-none h-16"
                        placeholder="Optional notes for audit trail…"
                        value={approveNotes}
                        onChange={e => setApproveNotes(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => waveApproveMutation.mutate({ wave: w.waveNumber, notes: approveNotes })} disabled={waveApproveMutation.isPending} data-testid={`button-confirm-wave-${w.waveNumber}`}>
                          {waveApproveMutation.isPending ? "Approving…" : "Confirm Approval"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setApproveWave(null); setApproveNotes(""); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => setApproveWave(w.waveNumber)} data-testid={`button-approve-wave-${w.waveNumber}`}>
                      Approve Wave
                    </Button>
                  )
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Approved waves table */}
      {waves.filter(w => w.approved).length > 0 && (
        <Card data-testid="wave-approval-table">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Approved Waves (≥ 3)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left pb-2 font-medium">Wave</th>
                    <th className="text-center pb-2 font-medium">SOPs</th>
                    <th className="text-center pb-2 font-medium">Operational</th>
                    <th className="text-center pb-2 font-medium">Approved</th>
                    <th className="text-left pb-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {waves.filter(w => w.approved).map(w => (
                    <tr key={w.waveNumber} data-testid={`wave-approved-row-${w.waveNumber}`}>
                      <td className="py-2 font-medium">Wave {w.waveNumber} — {w.name}</td>
                      <td className="text-center py-2">{w.sopCount}</td>
                      <td className="text-center py-2">{w.operationalCount}</td>
                      <td className="text-center py-2 text-xs text-muted-foreground">{w.approvedAt ? new Date(w.approvedAt).toLocaleDateString("en-IN") : "—"}</td>
                      <td className="py-2 text-xs text-muted-foreground">{w.approvalNotes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goodhart Guard — Pending Progress Review */}
      <Card data-testid="pending-progress-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Pending Goal Progress Review
            {goals.length > 0 && <Badge variant="secondary">{goals.length}</Badge>}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            The system has suggested progress values. Managers should confirm or adjust within 96 hours — after that, values are auto-committed.
            Anomaly-flagged goals (⚠) must be reviewed manually and will never auto-commit.
          </p>
        </CardHeader>
        <CardContent>
          {goalsLoading && <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
          {!goalsLoading && goals.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No goals pending review. All suggestions have been confirmed.</p>
          )}
          {!goalsLoading && goals.length > 0 && (
            <div className="space-y-3">
              {/* Anomaly-flagged goals first */}
              {anomalyGoals.map(g => (
                <div key={g.id} className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 space-y-2" data-testid={`pending-goal-anomaly-${g.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">{g.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{g.employee_name} · suggested {formatAgo(g.suggested_progress_at)}</p>
                    </div>
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-xs shrink-0">Anomaly</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Current: <strong>{g.progress}%</strong></span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-red-600 font-semibold">Suggested: {g.suggested_progress}%</span>
                  </div>
                  {adjustingGoalId === g.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={adjustValue}
                        onChange={e => setAdjustValue(Number(e.target.value))}
                        className="flex-1 accent-primary"
                        data-testid={`slider-adjust-${g.id}`}
                      />
                      <span className="text-xs w-10 text-right">{adjustValue}%</span>
                      <Button size="sm" onClick={() => adjustMutation.mutate({ goalId: g.id, progress: adjustValue })} disabled={adjustMutation.isPending} data-testid={`button-save-adjust-${g.id}`}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAdjustingGoalId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { setAdjustingGoalId(g.id); setAdjustValue(g.suggested_progress); }} variant="outline" data-testid={`button-adjust-${g.id}`}>
                        Adjust &amp; Accept
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {/* Normal pending goals */}
              {normalGoals.map(g => (
                <div key={g.id} className="rounded-lg border p-3 space-y-2" data-testid={`pending-goal-${g.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{g.title}</p>
                      <p className="text-xs text-muted-foreground">{g.employee_name} · suggested {formatAgo(g.suggested_progress_at)}</p>
                    </div>
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Current: <strong>{g.progress}%</strong></span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-blue-600 font-semibold">Suggested: {g.suggested_progress}%</span>
                  </div>
                  {adjustingGoalId === g.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={adjustValue}
                        onChange={e => setAdjustValue(Number(e.target.value))}
                        className="flex-1 accent-primary"
                        data-testid={`slider-adjust-${g.id}`}
                      />
                      <span className="text-xs w-10 text-right">{adjustValue}%</span>
                      <Button size="sm" onClick={() => adjustMutation.mutate({ goalId: g.id, progress: adjustValue })} disabled={adjustMutation.isPending} data-testid={`button-save-adjust-${g.id}`}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAdjustingGoalId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => confirmMutation.mutate(g.id)} disabled={confirmMutation.isPending} data-testid={`button-confirm-${g.id}`}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Confirm {g.suggested_progress}%
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setAdjustingGoalId(g.id); setAdjustValue(g.suggested_progress); }} data-testid={`button-adjust-${g.id}`}>
                        Adjust
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manager Obligations table */}
      <Card data-testid="manager-obligations-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Manager Obligations
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Governance controls where managers are the owners (check-in facilitation + coaching logs). Same escalation ladder as employee controls.
          </p>
        </CardHeader>
        <CardContent>
          <ManagerObligationsTable />
        </CardContent>
      </Card>

      {/* Manager KPI table */}
      <Card data-testid="manager-kpi-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-amber-500" />
            Manager Compliance KPIs
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Per-manager metrics (last 90 days): % on-time check-ins, avg completion lag, and active plan review rate (coaching entry logged in last 30 days).
          </p>
        </CardHeader>
        <CardContent>
          <ManagerKpiTable />
        </CardContent>
      </Card>
    </div>
  );
}

function ManagerObligationsTable() {
  const { data, isLoading } = useQuery<{ rows: any[] }>({
    queryKey: ["/api/governance/manager-obligations"],
    staleTime: 3 * 60 * 1000,
  });

  if (isLoading) return <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;

  const rows = data?.rows ?? [];
  if (rows.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">No pending manager obligations.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="manager-obligations-table">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left pb-2 font-medium">Manager</th>
            <th className="text-left pb-2 font-medium">Obligation</th>
            <th className="text-center pb-2 font-medium">Due</th>
            <th className="text-center pb-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r: any) => {
            const isOverdue = r.status === "overdue" || r.status === "escalated";
            return (
              <tr key={r.id} className="hover:bg-muted/30" data-testid={`obligation-row-${r.id}`}>
                <td className="py-2 font-medium">{r.manager_name ?? "—"}</td>
                <td className="py-2 text-xs text-muted-foreground capitalize">{r.control_type?.replace(/_/g, " ")}</td>
                <td className="py-2 text-center text-xs">{r.due_date ?? "—"}</td>
                <td className="py-2 text-center">
                  {isOverdue ? (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">{r.status}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ManagerKpiTable() {
  const { data, isLoading } = useQuery<{ managers: any[] }>({
    queryKey: ["/api/governance/manager-kpis"],
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;

  const managers = data?.managers ?? [];
  if (managers.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">No manager KPI data available yet.</p>;

  function pctBadge(pct: number | null) {
    if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
    const cls = pct >= 85 ? "text-green-700 bg-green-50 border-green-200"
      : pct >= 60 ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-red-700 bg-red-50 border-red-200";
    return <Badge className={`${cls} border text-[10px] font-mono`}>{pct}%</Badge>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="manager-kpi-table">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left pb-2 font-medium">Manager</th>
            <th className="text-center pb-2 font-medium">On-Time Check-ins</th>
            <th className="text-center pb-2 font-medium">Avg Lag (days)</th>
            <th className="text-center pb-2 font-medium">Plan Review Rate</th>
            <th className="text-center pb-2 font-medium">Active Plans</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {managers.map((m: any) => (
            <tr key={m.manager_id} className="hover:bg-muted/30" data-testid={`kpi-row-${m.manager_id}`}>
              <td className="py-2 font-medium">{m.manager_name}</td>
              <td className="py-2 text-center">
                {pctBadge(m.on_time_pct !== null ? Number(m.on_time_pct) : null)}
                <span className="ml-1 text-xs text-muted-foreground">({m.on_time_checkins}/{m.total_checkins})</span>
              </td>
              <td className="py-2 text-center">
                {m.avg_completion_lag_days !== null
                  ? <span className={`text-xs font-mono ${Number(m.avg_completion_lag_days) > 3 ? "text-red-600" : "text-foreground"}`}>{m.avg_completion_lag_days}d</span>
                  : <span className="text-xs text-muted-foreground">—</span>}
              </td>
              <td className="py-2 text-center">
                {pctBadge(m.plan_review_rate_pct !== null ? Number(m.plan_review_rate_pct) : null)}
              </td>
              <td className="py-2 text-center text-xs">{m.active_plans}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GovernanceHub() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const role = user?.role;

  const ALLOWED_ROLES = ["super_admin", "admin", "hr"];
  const canAccess = !!role && ALLOWED_ROLES.includes(role);
  const isHrReadOnly = role === "hr";

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { setLocation("/admin/login"); return; }
    if (!canAccess) { setLocation("/admin"); return; }
  }, [authLoading, isAuthenticated, canAccess, setLocation]);

  const { data: pulse, isLoading } = useQuery<GovernancePulse>({
    queryKey: ["/api/governance/pulse"],
    enabled: isAuthenticated && canAccess,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (authLoading || !isAuthenticated || !canAccess) return null;

  const actionItems: ActionItem[] = pulse?.action_items ?? [];
  const criticalCount = actionItems.filter((i) => i.severity === "critical").length;
  const warningCount = actionItems.filter((i) => i.severity === "warning").length;

  const sopAckPct = pulse
    ? pulse.sop.totalAssigned > 0
      ? Math.round((pulse.sop.acknowledged / pulse.sop.totalAssigned) * 100)
      : 100
    : 0;

  const trainingCompliantPct = pulse
    ? pulse.training.totalActive > 0
      ? Math.round((pulse.training.compliant / pulse.training.totalActive) * 100)
      : 100
    : 0;

  const checkinRate = pulse?.checkins.org.completionRate ?? 100;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-governance-hub-title">
                Governance Hub
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Org-wide compliance health across SOPs, training, PIPs, probation, goals, and check-ins.
              </p>
            </div>
          </div>
          {(criticalCount > 0 || warningCount > 0) && (
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <Badge className="bg-red-500 text-white hover:bg-red-500 gap-1" data-testid="badge-critical-count">
                  <AlertTriangle className="h-3 w-3" />
                  {criticalCount} critical
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-amber-500 text-white hover:bg-amber-500" data-testid="badge-warning-count">
                  {warningCount} warning{warningCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <Tabs defaultValue="overview" data-testid="governance-tabs">
          <TabsList className="mb-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="manager-compliance" data-testid="tab-manager-compliance">
              Manager Compliance
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {pulse && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6" data-testid="pulse-cards">
                  <PulseStatCard
                    title="SOP Compliance"
                    icon={BookOpen}
                    value={`${sopAckPct}%`}
                    label={`${pulse.sop.acknowledged}/${pulse.sop.totalAssigned} acknowledged`}
                    sub={pulse.sop.overdue > 0 ? `${pulse.sop.overdue} overdue` : undefined}
                    severity={pulse.sop.overdue > 10 ? "critical" : pulse.sop.overdue > 0 ? "warn" : "ok"}
                    onClick={() => setLocation("#action-required-feed")}
                  />
                  <PulseStatCard
                    title="Training"
                    icon={GraduationCap}
                    value={`${trainingCompliantPct}%`}
                    label={`${pulse.training.compliant}/${pulse.training.totalActive} compliant`}
                    sub={pulse.training.locked > 0 ? `${pulse.training.locked} locked` : undefined}
                    severity={pulse.training.locked > 0 ? "critical" : pulse.training.overdue > 0 ? "warn" : "ok"}
                    onClick={() => setLocation("#action-required-feed")}
                  />
                  <PulseStatCard
                    title="Active PIPs"
                    icon={ClipboardList}
                    value={pulse.plans.pip.active}
                    label={`${pulse.plans.pip.overdueCoaching} coaching overdue`}
                    sub={`${pulse.plans.pip.noCoachingInThreshold} no recent coaching`}
                    severity={pulse.plans.pip.overdueCoaching > 0 ? "critical" : pulse.plans.pip.noCoachingInThreshold > 0 ? "warn" : "ok"}
                    onClick={() => setLocation("#action-required-feed")}
                  />
                  <PulseStatCard
                    title="Probation"
                    icon={Users}
                    value={pulse.plans.probation.active}
                    label={`${pulse.probation.missedRecently.length} milestones missed`}
                    sub={pulse.probation.dueSoon.length > 0 ? `${pulse.probation.dueSoon.length} due soon` : undefined}
                    severity={pulse.probation.missedRecently.length > 0 ? "warn" : "ok"}
                    onClick={() => setLocation("#action-required-feed")}
                  />
                  <PulseStatCard
                    title="Goals"
                    icon={Target}
                    value={pulse.goals.healthSplit.total}
                    label={`${pulse.goals.healthSplit.onTrack} on track`}
                    sub={pulse.goals.healthSplit.overdue > 0 ? `${pulse.goals.healthSplit.overdue} overdue` : undefined}
                    severity={pulse.goals.healthSplit.overdue > 0 ? "warn" : "ok"}
                    onClick={() => setLocation("#action-required-feed")}
                  />
                  <PulseStatCard
                    title="Check-ins"
                    icon={CalendarCheck}
                    value={`${checkinRate}%`}
                    label={`${pulse.checkins.org.completed}/${pulse.checkins.org.scheduled} completed`}
                    sub={pulse.checkins.org.missed > 0 ? `${pulse.checkins.org.missed} missed` : undefined}
                    severity={checkinRate < 50 ? "critical" : checkinRate < 75 ? "warn" : "ok"}
                    onClick={() => setLocation("#action-required-feed")}
                  />
                </div>

                {pulse.plans.perManager.length > 0 && (
                  <Card className="mb-6" data-testid="manager-breakdown-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        Manager Breakdown — Plans & Check-ins
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="manager-breakdown-table">
                          <thead>
                            <tr className="border-b text-muted-foreground text-xs">
                              <th className="text-left pb-2 font-medium">Manager</th>
                              <th className="text-center pb-2 font-medium">PIPs</th>
                              <th className="text-center pb-2 font-medium">Stalled</th>
                              <th className="text-center pb-2 font-medium">Growth</th>
                              <th className="text-center pb-2 font-medium">Probation</th>
                              <th className="text-center pb-2 font-medium">Check-ins Overdue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {pulse.plans.perManager.map((m) => (
                              <tr key={m.managerId} className="hover:bg-muted/30" data-testid={`mgr-row-${m.managerId}`}>
                                <td className="py-2 font-medium">{m.managerName}</td>
                                <td className="text-center py-2">{m.pipsActive}</td>
                                <td className="text-center py-2">
                                  {m.pipsStalled > 0 ? (
                                    <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-semibold">{m.pipsStalled}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="text-center py-2">{m.growthPlansActive}</td>
                                <td className="text-center py-2">{m.probationActive}</td>
                                <td className="text-center py-2">
                                  {m.checkInsOverdue > 0 ? (
                                    <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">{m.checkInsOverdue}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-3" id="action-required-feed">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h2 className="text-lg font-semibold" data-testid="text-action-required-heading">
                      Action Required
                    </h2>
                    {actionItems.length > 0 && (
                      <Badge variant="secondary" className="text-xs" data-testid="badge-action-count">
                        {actionItems.length}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground -mt-1">
                    Ranked by urgency. Use Nudge to notify the responsible manager, or Escalate to create an HR request.
                  </p>
                  <ActionRequiredFeed
                    items={actionItems}
                    isLoading={false}
                    isHrReadOnly={isHrReadOnly}
                  />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="manager-compliance">
            <ManagerComplianceTab isHrReadOnly={isHrReadOnly} />
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Enforcement Settings</h2>
              </div>
              <p className="text-sm text-muted-foreground -mt-1">
                Configure governance enforcement across SOPs, PIPs, growth plans, and probation milestones.
              </p>
              <GovernanceSettingsPanel />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
