import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ClipboardList, AlertCircle, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface HRPlan {
  id: string;
  employee_id: string;
  manager_id: string | null;
  plan_type: "probation" | "growth" | "pip";
  department_scope: string;
  status: "pending" | "active" | "completed" | "extended" | "closed";
  outcome: string | null;
  start_date: string;
  end_date: string;
  duration_days: number;
  acknowledged_at: string | null;
  employee_name: string | null;
  manager_name: string | null;
  department_name: string | null;
  completed_checkins: number;
  total_checkins: number;
  created_at: string | null;
}

interface PlanDetail {
  plan: HRPlan;
  goals: any[];
  checkIns: any[];
}

const OUTCOME_OPTIONS: Record<string, { value: string; label: string; description: string }[]> = {
  probation: [
    { value: "confirmed", label: "Confirmed", description: "Employee successfully completes probation. Plan closes immediately." },
    { value: "extended", label: "Extended", description: "Probation period is extended. You will be directed to the Addendum Generator." },
    { value: "released", label: "Released", description: "Employee is released. You will be directed to the Letter Generator." },
  ],
  growth: [
    { value: "completed", label: "Completed", description: "Growth plan objectives achieved. Plan closes immediately." },
    { value: "rolled_over", label: "Rolled Over", description: "Plan is rolled over to a new cycle. Plan closes immediately." },
  ],
  pip: [
    { value: "passed", label: "Passed", description: "Employee meets all PIP targets. Plan closes immediately." },
    { value: "extended", label: "Extended", description: "PIP period is extended. You will be directed to the Addendum Generator." },
    { value: "terminated", label: "Terminated", description: "Employment terminated following PIP. You will be directed to the Letter Generator." },
  ],
};

const EXTENDED_OUTCOMES = new Set(["extended"]);
const RELIEVING_OUTCOMES = new Set(["released", "terminated"]);

function planTypeLabel(t: string) {
  if (t === "probation") return "Probation";
  if (t === "growth") return "Growth";
  if (t === "pip") return "PIP";
  return t;
}

function planTypeBadge(t: string): "default" | "secondary" | "destructive" | "outline" {
  if (t === "pip") return "destructive";
  if (t === "probation") return "secondary";
  return "outline";
}

function statusBadge(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "active") return "default";
  if (s === "pending") return "secondary";
  if (s === "closed" || s === "completed") return "outline";
  return "outline";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysRemaining(endDate: string): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000));
}

function compliancePct(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

function PlanDetailPanel({ detail, canClose, onClosePlan }: {
  detail: PlanDetail;
  canClose: boolean;
  onClosePlan: () => void;
}) {
  const { plan, goals, checkIns } = detail;
  const today = new Date().toISOString().split("T")[0];
  const pct = compliancePct(plan.completed_checkins, plan.total_checkins);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-base">{plan.employee_name || "Unknown"}</p>
          {plan.department_name && <p className="text-xs text-muted-foreground">{plan.department_name}</p>}
          {plan.manager_name && <p className="text-xs text-muted-foreground mt-0.5">Manager: {plan.manager_name}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={statusBadge(plan.status)} className="capitalize">{plan.status}</Badge>
          {plan.outcome && <Badge variant="outline" className="capitalize text-xs">{plan.outcome}</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm border rounded-lg p-3 bg-muted/30">
        <div>
          <p className="text-xs text-muted-foreground">Start</p>
          <p className="font-medium">{formatDate(plan.start_date)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">End</p>
          <p className="font-medium">{formatDate(plan.end_date)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Days Left</p>
          <p className="font-medium">
            {plan.status === "closed" ? "—" : daysRemaining(plan.end_date) > 0 ? `${daysRemaining(plan.end_date)}d` : "Ended"}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Check-in Compliance</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-medium whitespace-nowrap">
            {plan.completed_checkins}/{plan.total_checkins} ({pct}%)
          </span>
        </div>
        {checkIns.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {checkIns.slice(0, 8).map((ci: any) => (
              <div key={ci.id} className="flex items-center justify-between text-xs p-1.5 rounded border" data-testid={`row-checkin-detail-${ci.id}`}>
                <span className="capitalize">{(ci.check_in_type || "").replace(/_/g, " ")} — {formatDate(ci.scheduled_date)}</span>
                <Badge
                  variant={ci.status === "completed" ? "default" : ci.scheduled_date < today ? "destructive" : "outline"}
                  className="text-[10px] h-4 px-1.5 capitalize"
                >
                  {ci.status}
                </Badge>
              </div>
            ))}
            {checkIns.length > 8 && (
              <p className="text-xs text-muted-foreground text-center">+{checkIns.length - 8} more</p>
            )}
          </div>
        )}
      </div>

      {goals.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Goals ({goals.length})</p>
          <div className="space-y-2">
            {goals.map((g: any) => (
              <div key={g.id} className="border rounded-lg p-3 space-y-1.5" data-testid={`card-goal-detail-${g.id}`}>
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-medium">{g.title}</p>
                  <Badge variant="outline" className="text-xs capitalize shrink-0">{g.category}</Badge>
                </div>
                {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                {g.target_metric && (
                  <p className="text-xs text-muted-foreground">Target: <span className="font-medium text-foreground">{g.target_metric}</span></p>
                )}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span><span>{g.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full" style={{ width: `${g.progress}%` }} />
                  </div>
                </div>
                {g.notes && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">{g.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {canClose && (plan.status === "active" || plan.status === "pending") && (
        <div className="pt-4 border-t">
          <Button variant="destructive" onClick={onClosePlan} className="w-full" data-testid="button-close-plan">
            Close Plan &amp; Record Outcome
          </Button>
        </div>
      )}
    </div>
  );
}

function ClosePlanModal({ plan, open, onClose, onSuccess }: {
  plan: HRPlan;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const outcomeOptions = OUTCOME_OPTIONS[plan.plan_type] || [];
  const selectedOption = outcomeOptions.find(o => o.value === selectedOutcome);

  const closeMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/hr/plans/${plan.id}`, { status: "closed", outcome: selectedOutcome }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/plans"] });
      onSuccess();
      onClose();
      const name = plan.employee_name || "The employee";
      if (EXTENDED_OUTCOMES.has(selectedOutcome)) {
        toast({
          title: "Plan closed — Extended",
          description: `${name}'s plan is closed. Redirecting to Addendum Generator…`,
          duration: 7000,
        });
        // probation_extension is the only supported extension addendum type; PIP extended
        // routes to the addendum tab without presetting a type so HR can pick the right one.
        const addendumParam = plan.plan_type === "probation"
          ? `&amendment_type=probation_extension`
          : "";
        setTimeout(() => setLocation(`/admin/hr/tools?tab=addendums&employee_id=${plan.employee_id}${addendumParam}`), 1800);
      } else if (RELIEVING_OUTCOMES.has(selectedOutcome)) {
        toast({
          title: `Plan closed — ${selectedOutcome === "released" ? "Released" : "Terminated"}`,
          description: `${name}'s plan is closed. Redirecting to Letter Generator…`,
          duration: 7000,
        });
        setTimeout(() => setLocation(`/admin/hr/tools?tab=letter-generator&employee_id=${plan.employee_id}`), 1800);
      } else {
        toast({
          title: "Plan closed successfully",
          description: `${name}'s ${planTypeLabel(plan.plan_type)} plan closed as ${selectedOutcome}.`,
        });
      }
    },
    onError: () => toast({ title: "Failed to close plan", variant: "destructive" }),
  });

  function handleClose() {
    setSelectedOutcome("");
    setStep("pick");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent data-testid="modal-close-plan">
        <DialogHeader>
          <DialogTitle>Close Plan — Record Outcome</DialogTitle>
          <DialogDescription>
            {plan.employee_name} · {planTypeLabel(plan.plan_type)} Plan
          </DialogDescription>
        </DialogHeader>

        {step === "pick" && (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium">Select outcome:</p>
              <RadioGroup value={selectedOutcome} onValueChange={setSelectedOutcome} data-testid="radio-outcome">
                {outcomeOptions.map(opt => (
                  <div key={opt.value} className="flex items-start gap-3 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value={opt.value} id={`outcome-${opt.value}`} className="mt-0.5" />
                    <Label htmlFor={`outcome-${opt.value}`} className="cursor-pointer">
                      <span className="font-medium capitalize">{opt.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button disabled={!selectedOutcome} onClick={() => setStep("confirm")} data-testid="button-next-outcome">
                Next
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "confirm" && selectedOption && (
          <>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-medium">Outcome: <span className="capitalize">{selectedOption.label}</span></p>
              <p className="text-sm text-muted-foreground">{selectedOption.description}</p>
              {EXTENDED_OUTCOMES.has(selectedOutcome) && (
                <p className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1 text-amber-700 dark:text-amber-300">
                  You will be redirected to HR Tools → Addendum Generator after closing.
                </p>
              )}
              {RELIEVING_OUTCOMES.has(selectedOutcome) && (
                <p className="text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded px-2 py-1 text-red-700 dark:text-red-300">
                  You will be redirected to HR Tools → Letter Generator after closing.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("pick")}>Back</Button>
              <Button
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                variant={RELIEVING_OUTCOMES.has(selectedOutcome) ? "destructive" : "default"}
                data-testid="button-confirm-close-plan"
              >
                {closeMutation.isPending ? "Closing…" : "Confirm & Close Plan"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function HRPlansOverview() {
  const { user } = useAuth();

  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterManager, setFilterManager] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [sortCol, setSortCol] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const canClose = ["super_admin", "admin", "hr"].includes(user?.role || "");

  const plansQuery = useQuery<HRPlan[]>({ queryKey: ["/api/hr/plans"] });

  const detailQuery = useQuery<PlanDetail>({
    queryKey: ["/api/hr/plans", selectedPlanId],
    enabled: !!selectedPlanId,
  });

  const handleSort = useCallback((col: string) => {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => d === "asc" ? "desc" : "asc"); return col; }
      setSortDir("asc"); return col;
    });
  }, []);

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40 inline" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary inline" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary inline" />;
  };

  const managerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (plansQuery.data || []).forEach(p => {
      if (p.manager_id && p.manager_name) seen.set(p.manager_id, p.manager_name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [plansQuery.data]);

  const deptOptions = useMemo(() => {
    const seen = new Set<string>();
    (plansQuery.data || []).forEach(p => { if (p.department_name) seen.add(p.department_name); });
    return Array.from(seen).sort();
  }, [plansQuery.data]);

  const filteredPlans = useMemo(() => {
    const filtered = (plansQuery.data || []).filter(p => {
      if (filterType !== "all" && p.plan_type !== filterType) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterManager !== "all" && p.manager_id !== filterManager) return false;
      if (filterDept !== "all" && (p.department_name || "") !== filterDept) return false;
      if (search && !(p.employee_name || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    // Apply column sort
    filtered.sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sortCol) {
        case "employee_name": va = (a.employee_name || "").toLowerCase(); vb = (b.employee_name || "").toLowerCase(); break;
        case "plan_type": va = a.plan_type; vb = b.plan_type; break;
        case "manager_name": va = (a.manager_name || "").toLowerCase(); vb = (b.manager_name || "").toLowerCase(); break;
        case "department_name": va = (a.department_name || "").toLowerCase(); vb = (b.department_name || "").toLowerCase(); break;
        case "start_date": va = a.start_date; vb = b.start_date; break;
        case "end_date": va = a.end_date; vb = b.end_date; break;
        case "days_remaining": va = daysRemaining(a.end_date); vb = daysRemaining(b.end_date); break;
        case "compliance": va = compliancePct(a.completed_checkins, a.total_checkins); vb = compliancePct(b.completed_checkins, b.total_checkins); break;
        case "status": va = a.status; vb = b.status; break;
        default: va = a.created_at || ""; vb = b.created_at || "";
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [plansQuery.data, filterType, filterStatus, filterManager, filterDept, search, sortCol, sortDir]);

  const selectedPlan = useMemo(
    () => (plansQuery.data || []).find(p => p.id === selectedPlanId) || null,
    [plansQuery.data, selectedPlanId],
  );

  const hasFilters = filterType !== "all" || filterStatus !== "all" || filterManager !== "all" || filterDept !== "all" || search;

  if (plansQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center" data-testid="plans-filters">
        <Input
          placeholder="Search employee…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-44"
          data-testid="input-plans-search"
        />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36" data-testid="select-filter-type">
            <SelectValue placeholder="Plan Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="probation">Probation</SelectItem>
            <SelectItem value="growth">Growth</SelectItem>
            <SelectItem value="pip">PIP</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="extended">Extended</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        {managerOptions.length > 0 && (
          <Select value={filterManager} onValueChange={setFilterManager}>
            <SelectTrigger className="w-40" data-testid="select-filter-manager">
              <SelectValue placeholder="Manager" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Managers</SelectItem>
              {managerOptions.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {deptOptions.length > 0 && (
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-40" data-testid="select-filter-dept">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {deptOptions.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterType("all"); setFilterStatus("all"); setFilterManager("all"); setFilterDept("all"); setSearch(""); }}
            data-testid="button-clear-filters"
          >
            Clear filters
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          {filteredPlans.length} plan{filteredPlans.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filteredPlans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No plans found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left select-none">
                {([
                  ["employee_name", "Employee"],
                  ["plan_type", "Type"],
                  ["manager_name", "Manager"],
                  ["department_name", "Department"],
                  ["start_date", "Start"],
                  ["end_date", "End"],
                  ["days_remaining", "Days Left"],
                  ["compliance", "Compliance"],
                  ["status", "Status"],
                ] as [string, string][]).map(([col, label]) => (
                  <th
                    key={col}
                    className="px-3 py-2 font-medium cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                    onClick={() => handleSort(col)}
                    data-testid={`th-sort-${col}`}
                  >
                    {label}
                    <SortIcon col={col} />
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map(plan => {
                const pct = compliancePct(plan.completed_checkins, plan.total_checkins);
                const days = daysRemaining(plan.end_date);
                return (
                  <tr
                    key={plan.id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedPlanId(plan.id)}
                    data-testid={`row-plan-${plan.id}`}
                  >
                    <td className="px-3 py-2.5 font-medium">{plan.employee_name || "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={planTypeBadge(plan.plan_type)} className="capitalize text-xs">
                        {planTypeLabel(plan.plan_type)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{plan.manager_name || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{plan.department_name || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(plan.start_date)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(plan.end_date)}</td>
                    <td className="px-3 py-2.5">
                      {plan.status === "closed" || plan.status === "completed" ? "—" : days > 0 ? (
                        <span className={days <= 14 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>{days}d</span>
                      ) : (
                        <span className="text-red-600 text-xs">Ended</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={statusBadge(plan.status)} className="capitalize text-xs">{plan.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs capitalize">{plan.outcome || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!selectedPlanId} onOpenChange={v => !v && setSelectedPlanId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="sheet-plan-detail">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Plan Detail
              {selectedPlan && (
                <Badge variant={planTypeBadge(selectedPlan.plan_type)} className="capitalize ml-1">
                  {planTypeLabel(selectedPlan.plan_type)}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              {selectedPlan?.employee_name || "Employee"} — Read-only overview
            </SheetDescription>
          </SheetHeader>

          {detailQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : detailQuery.data && selectedPlan ? (
            <PlanDetailPanel
              detail={{ ...detailQuery.data, plan: { ...detailQuery.data.plan, ...selectedPlan } }}
              canClose={canClose}
              onClosePlan={() => setShowCloseModal(true)}
            />
          ) : selectedPlan ? (
            <PlanDetailPanel
              detail={{ plan: selectedPlan, goals: [], checkIns: [] }}
              canClose={canClose}
              onClosePlan={() => setShowCloseModal(true)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {selectedPlan && (
        <ClosePlanModal
          plan={selectedPlan}
          open={showCloseModal}
          onClose={() => setShowCloseModal(false)}
          onSuccess={() => setSelectedPlanId(null)}
        />
      )}
    </div>
  );
}
