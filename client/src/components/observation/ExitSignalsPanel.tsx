import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ChevronDown, ChevronRight, ArrowRight, Clock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SignalActionDialog, type SignalActionResult } from "./SignalActionDialog";
import { cn } from "@/lib/utils";

interface DecliningCheckIn {
  employee_id: string;
  employee_name: string;
  department: string;
  manager_id: string | null;
  manager_name: string;
  ratings: number[];
}

interface StalledPip {
  plan_id: string;
  employee_id: string;
  employee_name: string;
  last_coaching_date: string;
  days_since_last_note: number;
  end_date: string | null;
}

interface ExpiringPlan {
  plan_id: string;
  plan_type: string;
  employee_id: string;
  end_date: string;
  employee_name: string;
  days_remaining: number;
}

interface ExitSignalData {
  decliningCheckIns: DecliningCheckIn[];
  stalledPips: StalledPip[];
  expiringPlans: ExpiringPlan[];
}

interface ActionedRecord {
  employeeOrPlanId: string;
  employeeName: string;
  action: string;
  timestamp: string;
}

function RatingDot({ rating }: { rating: number }) {
  const color = rating >= 3 ? "bg-green-500" : "bg-red-500";
  return (
    <span
      className={cn("inline-block w-2.5 h-2.5 rounded-full", color)}
      title={`Rating: ${rating}`}
    />
  );
}

function planTypeBadge(type: string) {
  switch (type) {
    case "probation": return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
    case "growth": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "pip": return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    default: return "bg-muted text-muted-foreground";
  }
}

interface ActionedTodayProps {
  records: ActionedRecord[];
}

function ActionedToday({ records }: ActionedTodayProps) {
  const [open, setOpen] = useState(false);
  if (records.length === 0) return null;

  return (
    <div className="border-t border-dashed border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-left hover:bg-muted/30 transition-colors"
        data-testid="toggle-actioned-today"
      >
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Actioned today ({records.length})
        </span>
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>
      {open && (
        <div className="divide-y divide-border">
          {records.map((r) => (
            <div
              key={r.employeeOrPlanId}
              className="px-3 py-1.5 flex items-center justify-between gap-2 opacity-60 bg-muted/20"
              data-testid={`actioned-row-${r.employeeOrPlanId}`}
            >
              <span className="text-xs truncate">{r.employeeName}</span>
              <span className="text-[10px] text-muted-foreground italic shrink-0">
                {r.action === "create_goal" ? "Goal created" : "Note added"} · {r.timestamp}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  actionedRecords: ActionedRecord[];
  defaultOpen?: boolean;
}

function Section({ title, count, children, actionedRecords, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
        data-testid={`section-toggle-${title.replace(/\s+/g, "-").toLowerCase()}`}
      >
        <span className="text-xs font-semibold">{title}</span>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center",
            count === 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
          )}>
            {count}
          </span>
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <>
          <div className="divide-y divide-border">{children}</div>
          <ActionedToday records={actionedRecords} />
        </>
      )}
    </div>
  );
}

export function ExitSignalsPanel() {
  const { data, isLoading, refetch } = useQuery<ExitSignalData>({
    queryKey: ["/api/observation/exit-signals", "org"],
    queryFn: async () => {
      const res = await fetch("/api/observation/exit-signals?scope=org", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch exit signals");
      return res.json();
    },
    staleTime: 60000,
  });

  const [actionDialog, setActionDialog] = useState<{
    mode: "create_goal" | "add_coaching_note";
    employeeId: string;
    employeeName: string;
    context: string;
    planId?: string;
    rowKey: string;
    sectionKey: "declining" | "pip";
  } | null>(null);

  const [actionedBySection, setActionedBySection] = useState<{
    declining: Record<string, ActionedRecord>;
    pip: Record<string, ActionedRecord>;
  }>({ declining: {}, pip: {} });

  function handleActionSuccess(result: SignalActionResult) {
    if (!actionDialog) return;
    const record: ActionedRecord = {
      employeeOrPlanId: actionDialog.rowKey,
      employeeName: actionDialog.employeeName,
      action: result.action,
      timestamp: new Date(result.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
    setActionedBySection((prev) => ({
      ...prev,
      [actionDialog.sectionKey]: {
        ...prev[actionDialog.sectionKey],
        [actionDialog.rowKey]: record,
      },
    }));
    setActionDialog(null);
  }

  const allEmpty =
    (data?.decliningCheckIns?.length ?? 0) === 0 &&
    (data?.stalledPips?.length ?? 0) === 0 &&
    (data?.expiringPlans?.length ?? 0) === 0;

  const decliningActioned = actionedBySection.declining;
  const pipActioned = actionedBySection.pip;

  return (
    <div className="bg-card border border-border rounded-xl p-4" data-testid="exit-signals-panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Exit Signals</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => refetch()}
          data-testid="button-refresh-exit-signals"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : allEmpty ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
            <span className="text-green-600 text-lg">✓</span>
          </div>
          <p className="text-xs font-medium text-green-700 dark:text-green-400">No exit signals — org looks healthy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Declining Check-ins */}
          <Section
            title="Declining Check-ins"
            count={(data?.decliningCheckIns ?? []).filter((r) => !decliningActioned[r.employee_id]).length}
            actionedRecords={Object.values(decliningActioned)}
          >
            {(data?.decliningCheckIns ?? []).filter((r) => !decliningActioned[r.employee_id]).map((row) => (
              <div key={row.employee_id} className="px-3 py-2 flex items-center justify-between gap-2" data-testid={`signal-row-declining-${row.employee_id}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium">{row.employee_name}</span>
                    {row.department && (
                      <span className="text-[10px] text-muted-foreground">{row.department}</span>
                    )}
                    {row.manager_name && (
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        · Mgr: {row.manager_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {row.ratings.map((r, i) => <RatingDot key={i} rating={r} />)}
                    <span className="text-[10px] text-muted-foreground ml-1">({row.ratings.join(", ")})</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] shrink-0"
                  onClick={() =>
                    setActionDialog({
                      mode: "create_goal",
                      employeeId: row.employee_id,
                      employeeName: row.employee_name,
                      context: `Repeated low check-in scores (last 3 ratings: ${row.ratings.join(", ")})`,
                      rowKey: row.employee_id,
                      sectionKey: "declining",
                    })
                  }
                  data-testid={`button-create-goal-declining-${row.employee_id}`}
                >
                  Create Goal
                </Button>
              </div>
            ))}
            {(data?.decliningCheckIns ?? []).filter((r) => !decliningActioned[r.employee_id]).length === 0 && Object.keys(decliningActioned).length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">None</div>
            )}
          </Section>

          {/* Stalled PIPs */}
          <Section
            title="Stalled PIPs"
            count={(data?.stalledPips ?? []).filter((r) => !pipActioned[r.plan_id]).length}
            actionedRecords={Object.values(pipActioned)}
          >
            {(data?.stalledPips ?? []).filter((r) => !pipActioned[r.plan_id]).map((row) => (
              <div key={row.plan_id} className="px-3 py-2 flex items-center justify-between gap-2" data-testid={`signal-row-pip-${row.plan_id}`}>
                <div className="min-w-0">
                  <span className="text-xs font-medium truncate block">{row.employee_name}</span>
                  <span className="text-[10px] text-muted-foreground">{row.days_since_last_note}d since last coaching note</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] shrink-0"
                  onClick={() =>
                    setActionDialog({
                      mode: "add_coaching_note",
                      employeeId: row.employee_id,
                      employeeName: row.employee_name,
                      context: `Coaching note — PIP stalled for ${row.days_since_last_note} days`,
                      planId: row.plan_id,
                      rowKey: row.plan_id,
                      sectionKey: "pip",
                    })
                  }
                  data-testid={`button-add-note-pip-${row.plan_id}`}
                >
                  Add Note
                </Button>
              </div>
            ))}
            {(data?.stalledPips ?? []).filter((r) => !pipActioned[r.plan_id]).length === 0 && Object.keys(pipActioned).length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">None</div>
            )}
          </Section>

          {/* Expiring Plans */}
          <Section
            title="Expiring Plans"
            count={(data?.expiringPlans ?? []).length}
            actionedRecords={[]}
            defaultOpen={true}
          >
            {(data?.expiringPlans ?? []).map((row) => (
              <div key={row.plan_id} className="px-3 py-2 flex items-center justify-between gap-2" data-testid={`signal-row-expiring-${row.plan_id}`}>
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-xs font-medium truncate">{row.employee_name}</span>
                  <Badge className={cn("text-[10px] px-1.5 h-4 shrink-0", planTypeBadge(row.plan_type))}>
                    {row.plan_type}
                  </Badge>
                  {row.days_remaining == null && (
                    <span className="text-[10px] text-amber-600 italic shrink-0">outcome pending</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn("text-[11px]", row.days_remaining <= 3 ? "text-red-600 font-medium" : "text-muted-foreground")}>
                    {row.days_remaining}d left
                  </span>
                  <Link href={`/admin/hr/my-team?tab=plans&employeeId=${row.employee_id}`}>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" data-testid={`button-view-plan-${row.plan_id}`}>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
            {(data?.expiringPlans ?? []).length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">None</div>
            )}
          </Section>
        </div>
      )}

      {/* Signal Action Dialog */}
      {actionDialog && (
        <SignalActionDialog
          open={!!actionDialog}
          onOpenChange={(v) => { if (!v) setActionDialog(null); }}
          mode={actionDialog.mode}
          employeeId={actionDialog.employeeId}
          employeeName={actionDialog.employeeName}
          context={actionDialog.context}
          planId={actionDialog.planId}
          onSuccess={handleActionSuccess}
        />
      )}
    </div>
  );
}
