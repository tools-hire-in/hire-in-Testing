import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PulseData {
  plansByType: Record<string, { active: number; overdue: number; escalated: number }>;
  overdueCheckIns: number;
}

interface ExitSignalData {
  expiringPlans: Array<{
    plan_id: string;
    plan_type: string;
    employee_id: string;
    end_date: string;
    employee_name: string;
    days_remaining: number;
  }>;
  stalledPips: Array<{
    plan_id: string;
    employee_id: string;
    employee_name: string;
    last_coaching_date: string;
    days_since_last_note: number;
    end_date: string | null;
  }>;
}

function countColor(n: number) {
  if (n === 0) return "text-green-600 bg-green-50 dark:bg-green-950/30";
  if (n <= 3) return "text-amber-600 bg-amber-50 dark:bg-amber-950/30";
  return "text-red-600 bg-red-50 dark:bg-red-950/30";
}

function planTypeBadge(type: string) {
  switch (type) {
    case "probation": return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
    case "growth": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "pip": return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    default: return "bg-muted text-muted-foreground";
  }
}

interface CountCardProps {
  label: string;
  value: number;
}

function CountCard({ label, value }: CountCardProps) {
  return (
    <div
      className={cn("rounded-lg p-3 border border-border flex flex-col items-center gap-1", countColor(value))}
      data-testid={`count-card-${label.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <span className="text-2xl font-bold leading-none">{value}</span>
      <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PlansBoard() {
  const { data: pulse, isLoading: pulseLoading, refetch: refetchPulse } = useQuery<PulseData>({
    queryKey: ["/api/observation/pulse", "org"],
    queryFn: async () => {
      const res = await fetch("/api/observation/pulse?scope=org", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pulse");
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: signals, isLoading: signalsLoading, refetch: refetchSignals } = useQuery<ExitSignalData>({
    queryKey: ["/api/observation/exit-signals", "org"],
    queryFn: async () => {
      const res = await fetch("/api/observation/exit-signals?scope=org", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch exit signals");
      return res.json();
    },
    staleTime: 60000,
  });

  const isLoading = pulseLoading || signalsLoading;

  const probActive = pulse?.plansByType?.probation?.active ?? 0;
  const growthActive = pulse?.plansByType?.growth?.active ?? 0;
  const pipActive = pulse?.plansByType?.pip?.active ?? 0;
  const overdueCheckIns = pulse?.overdueCheckIns ?? 0;
  const escalated = Object.values(pulse?.plansByType ?? {}).reduce((sum, p) => sum + (p.escalated ?? 0), 0);

  // Build last-coaching-date lookup from stalledPips
  const lastCoachingByPlanId: Record<string, string> = {};
  (signals?.stalledPips ?? []).forEach((p) => {
    lastCoachingByPlanId[p.plan_id] = p.last_coaching_date;
  });

  function daysUntil(isoDate: string | null | undefined): number | null {
    if (!isoDate) return null;
    const end = new Date(isoDate);
    if (isNaN(end.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - today.getTime()) / 86400000);
  }

  const atRiskRows = [
    ...(signals?.stalledPips ?? []).map((p) => {
      const dr = daysUntil(p.end_date);
      return {
        id: p.plan_id,
        employeeId: p.employee_id,
        employeeName: p.employee_name,
        planType: "pip",
        daysRemaining: dr,
        detail: dr !== null ? `${dr}d left · ${p.days_since_last_note}d stalled` : `${p.days_since_last_note}d stalled`,
        lastCheckIn: p.last_coaching_date,
      };
    }),
    ...(signals?.expiringPlans ?? []).map((p) => ({
      id: `exp-${p.plan_id}`,
      employeeId: p.employee_id,
      employeeName: p.employee_name,
      planType: p.plan_type,
      daysRemaining: p.days_remaining,
      detail: `${p.days_remaining}d left`,
      lastCheckIn: lastCoachingByPlanId[p.plan_id] ?? null,
    })),
  ].slice(0, 5);

  return (
    <div className="bg-card border border-border rounded-xl p-4" data-testid="plans-board">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Plans Board</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => { refetchPulse(); refetchSignals(); }}
          data-testid="button-refresh-plans"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
          <Skeleton className="h-24 rounded-lg" />
        </div>
      ) : (
        <>
          {/* 2-col on mobile, 3-col on sm, 5-col on xl */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 mb-4">
            <CountCard label="Active Probation" value={probActive} />
            <CountCard label="Active Growth" value={growthActive} />
            <CountCard label="Active PIP" value={pipActive} />
            <CountCard label="Overdue Check-ins" value={overdueCheckIns} />
            <CountCard label="Escalated Plans" value={escalated} />
          </div>

          {atRiskRows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No at-risk plans</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 grid grid-cols-[1fr_auto_auto_auto] px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide gap-3">
                <span>Employee</span>
                <span className="text-center">Type</span>
                <span className="text-right">Last Check-in</span>
                <span className="text-right">Status</span>
              </div>
              <div className="divide-y divide-border">
                {atRiskRows.map((row) => (
                  <Link
                    key={row.id}
                    href={`/admin/hr/my-team?tab=plans&employeeId=${row.employeeId}`}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center px-3 py-2 text-xs hover:bg-accent/50 transition-colors gap-3"
                    data-testid={`row-at-risk-plan-${row.id}`}
                  >
                    <span className="font-medium truncate">{row.employeeName}</span>
                    <Badge className={cn("text-[10px] px-1.5 h-4 shrink-0", planTypeBadge(row.planType))}>
                      {row.planType}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground text-right shrink-0">
                      {formatDate(row.lastCheckIn)}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 justify-end">
                      {row.daysRemaining !== null && row.daysRemaining <= 7 && (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      )}
                      <span className={cn("text-[11px]", row.daysRemaining !== null && row.daysRemaining <= 7 ? "text-red-600 font-medium" : "text-muted-foreground")}>
                        {row.detail}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
