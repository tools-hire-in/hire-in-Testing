import { useQuery } from "@tanstack/react-query";
import {
  Target,
  Calendar,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface PlanGoal {
  id: string;
  title: string;
  description?: string | null;
  progress: number;
  status: string;
  startDate?: string | null;
  targetDate?: string | null;
  weight?: number;
}

interface PlanCheckIn {
  id: string;
  scheduledDate: string;
  status: string;
  checkInType?: string;
  managerNotes?: string | null;
  rating?: number | null;
  completedAt?: string | null;
}

interface PlanData {
  plan: {
    id: string;
    planType: string;
    status: string;
    startDate: string;
    endDate: string;
    durationDays?: number;
    employeeName?: string;
    managerName?: string;
  };
  goals: PlanGoal[];
  checkIns: PlanCheckIn[];
}

const PLAN_TYPE_LABELS: Record<string, string> = {
  probation: "Probation",
  growth: "Growth Plan",
  pip: "PIP",
};

const PLAN_TYPE_COLORS: Record<string, string> = {
  probation: "bg-blue-100 text-blue-700",
  growth: "bg-emerald-100 text-emerald-700",
  pip: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  terminated: "Terminated",
  paused: "Paused",
};

const GOAL_STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-blue-100 text-blue-700",
  on_track: "bg-blue-100 text-blue-700",
  at_risk: "bg-amber-100 text-amber-700",
  not_started: "bg-gray-100 text-gray-600",
  cancelled: "bg-gray-100 text-gray-400",
};

const CHECKIN_STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700",
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-400",
};

function daysRemaining(endDate: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const msPerDay = 86400000;
  return Math.floor((new Date(endDate).getTime() - new Date(today).getTime()) / msPerDay);
}

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function computePhases(
  planType: string,
  startDate: string,
  durationDays?: number,
): Array<{ label: string; startDay: number; endDay: number; startDate: string; endDate: string }> {
  const dur = durationDays ?? (planType === "pip" ? 30 : 90);
  const msPerDay = 86400000;
  const start = new Date(startDate).getTime();
  const phaseCount = 3;
  const phaseLen = Math.ceil(dur / phaseCount);
  return Array.from({ length: phaseCount }, (_, i) => {
    const phaseStart = i * phaseLen + 1;
    const phaseEnd = Math.min((i + 1) * phaseLen, dur);
    const phaseStartDate = new Date(start + (phaseStart - 1) * msPerDay).toISOString().slice(0, 10);
    const phaseEndDate = new Date(start + (phaseEnd - 1) * msPerDay).toISOString().slice(0, 10);
    return { label: `Day ${phaseStart}–${phaseEnd}`, startDay: phaseStart, endDay: phaseEnd, startDate: phaseStartDate, endDate: phaseEndDate };
  });
}

function goalPhaseIndex(goal: PlanGoal, startDate: string, phases: ReturnType<typeof computePhases>): number {
  if (!goal.startDate) return 0;
  const msPerDay = 86400000;
  const planStart = new Date(startDate).getTime();
  const gStart = new Date(goal.startDate).getTime();
  const dayOffset = Math.floor((gStart - planStart) / msPerDay);
  for (let i = 0; i < phases.length; i++) {
    if (dayOffset < phases[i].endDay) return i;
  }
  return phases.length - 1;
}

export function PlanDetailDialog({
  planId,
  open,
  onOpenChange,
}: {
  planId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery<PlanData>({
    queryKey: ["/api/hr/plans", planId],
    queryFn: async () => {
      const res = await fetch(`/api/hr/plans/${planId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load plan");
      const raw = await res.json();
      const plan = raw.plan ?? {};
      const goals: PlanGoal[] = (raw.goals ?? []).map((g: any) => ({
        id: String(g.id),
        title: String(g.title),
        description: g.description ?? null,
        progress: Number(g.progress ?? 0),
        status: String(g.status ?? "not_started"),
        startDate: g.start_date ?? g.startDate ?? null,
        targetDate: g.target_date ?? g.targetDate ?? null,
        weight: g.weight ?? 1,
      }));
      const checkIns: PlanCheckIn[] = (raw.checkIns ?? raw.check_ins ?? []).map((c: any) => ({
        id: String(c.id),
        scheduledDate: String(c.scheduled_date ?? c.scheduledDate ?? ""),
        status: String(c.status ?? "scheduled"),
        checkInType: c.check_in_type ?? c.checkInType ?? null,
        managerNotes: c.manager_notes ?? c.managerNotes ?? null,
        rating: c.rating ?? null,
        completedAt: c.completed_at ?? c.completedAt ?? null,
      }));
      return {
        plan: {
          id: String(plan.id ?? planId),
          planType: String(plan.plan_type ?? plan.planType ?? "probation"),
          status: String(plan.status ?? "active"),
          startDate: String(plan.start_date ?? plan.startDate ?? ""),
          endDate: String(plan.end_date ?? plan.endDate ?? ""),
          durationDays: plan.duration_days ? Number(plan.duration_days) : undefined,
          employeeName: plan.employee_name ?? plan.employeeName ?? null,
          managerName: plan.manager_name ?? plan.managerName ?? null,
        },
        goals,
        checkIns,
      };
    },
    enabled: !!planId && open,
  });

  const today = new Date().toISOString().slice(0, 10);

  const content = () => {
    if (isLoading) {
      return (
        <div className="space-y-4 py-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      );
    }

    if (!data) {
      return <div className="text-center py-8 text-muted-foreground text-sm">Failed to load plan details.</div>;
    }

    const { plan, goals, checkIns } = data;
    const remaining = plan.endDate ? daysRemaining(plan.endDate) : null;
    const phases = plan.startDate ? computePhases(plan.planType, plan.startDate, plan.durationDays) : [];

    const goalsByPhase: PlanGoal[][] = phases.map(() => []);
    for (const g of goals) {
      const idx = goalPhaseIndex(g, plan.startDate, phases);
      goalsByPhase[idx].push(g);
    }

    const upcomingCheckIns = [...checkIns].filter(c => c.status !== "completed" && c.status !== "cancelled")
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    const completedCheckIns = [...checkIns].filter(c => c.status === "completed")
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

    const currentPhaseIdx = phases.findIndex(p => p.startDate <= today && today <= p.endDate);

    return (
      <div className="space-y-6 py-2">
        {/* Phase Timeline */}
        {phases.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ChevronRight className="h-4 w-4" /> Plan Timeline
            </h3>
            <div className="flex gap-2" data-testid="section-phase-timeline">
              {phases.map((phase, idx) => {
                const isCurrentPhase = idx === currentPhaseIdx;
                const isPastPhase = phase.endDate < today;
                const isFuturePhase = phase.startDate > today;
                return (
                  <div
                    key={idx}
                    data-testid={`phase-${idx}`}
                    className={`flex-1 rounded-md px-3 py-2 border text-center transition-colors ${
                      isCurrentPhase
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : isPastPhase
                        ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700"
                        : "border-muted bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <div className="text-xs font-medium">{phase.label}</div>
                    <div className="text-[10px] mt-0.5">
                      {isPastPhase ? "✓ Done" : isCurrentPhase ? "In progress" : isFuturePhase ? "Upcoming" : ""}
                    </div>
                    <div className="text-[10px] mt-0.5 opacity-70">
                      {goalsByPhase[idx]?.length ?? 0} goal{(goalsByPhase[idx]?.length ?? 0) !== 1 ? "s" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Goals grouped by phase */}
        {goals.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" /> Goals ({goals.length})
            </h3>
            <div className="space-y-4">
              {phases.map((phase, idx) => {
                const phaseGoals = goalsByPhase[idx];
                if (phaseGoals.length === 0) return null;
                const isCurrentPhase = idx === currentPhaseIdx;
                return (
                  <div key={idx} data-testid={`phase-goals-${idx}`}>
                    <div className={`text-xs font-semibold mb-2 px-2 py-1 rounded-md inline-flex items-center gap-1.5 ${
                      isCurrentPhase ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {isCurrentPhase && <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />}
                      {phase.label}
                    </div>
                    <div className="space-y-2">
                      {phaseGoals.map((g) => {
                        const isOverdue = g.targetDate && g.targetDate < today && !["completed", "cancelled"].includes(g.status);
                        return (
                          <div key={g.id} className={`border rounded-lg p-3 space-y-2 ${isOverdue ? "border-orange-300" : ""}`} data-testid={`plan-goal-${g.id}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium flex items-center gap-1.5">
                                  {g.title}
                                  {isOverdue && (
                                    <Badge className="text-[10px] h-4 bg-orange-100 text-orange-700 border-orange-200">
                                      Overdue
                                    </Badge>
                                  )}
                                </div>
                                {g.description && (
                                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{g.description}</div>
                                )}
                                {g.targetDate && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">Due {formatDate(g.targetDate)}</div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="text-xs font-semibold">{g.progress}%</span>
                                <Badge className={`text-[10px] h-4 ${GOAL_STATUS_COLORS[g.status] ?? ""}`}>
                                  {g.status.replace(/_/g, " ")}
                                </Badge>
                              </div>
                            </div>
                            <Progress value={g.progress} className="h-1.5" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {/* Goals without a start_date or outside phases */}
              {phases.length === 0 && goals.map((g) => (
                <div key={g.id} className="border rounded-lg p-3 space-y-2" data-testid={`plan-goal-${g.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium">{g.title}</div>
                    <span className="text-xs font-semibold">{g.progress}%</span>
                  </div>
                  <Progress value={g.progress} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Check-Ins */}
        {upcomingCheckIns.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Upcoming Check-Ins
            </h3>
            <div className="space-y-2">
              {upcomingCheckIns.map((ci) => {
                const isOverdue = ci.scheduledDate < today;
                return (
                  <div
                    key={ci.id}
                    data-testid={`plan-ci-upcoming-${ci.id}`}
                    className={`border rounded-lg p-3 flex items-center justify-between gap-3 ${isOverdue ? "border-red-200 bg-red-50/50 dark:border-red-800/30" : ""}`}
                  >
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        {ci.checkInType?.replace(/_/g, " ") ?? "Check-In"}
                        {isOverdue && <Badge className="bg-red-100 text-red-700 text-[10px] h-4">Overdue</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDate(ci.scheduledDate)}</div>
                    </div>
                    <Badge className={CHECKIN_STATUS_COLORS[ci.status] ?? CHECKIN_STATUS_COLORS.scheduled}>
                      {ci.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Check-Ins */}
        {completedCheckIns.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <History className="h-4 w-4" /> Check-In History
            </h3>
            <div className="space-y-2">
              {completedCheckIns.map((ci) => (
                <div key={ci.id} data-testid={`plan-ci-completed-${ci.id}`} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        {ci.checkInType?.replace(/_/g, " ") ?? "Check-In"}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDate(ci.scheduledDate)}</div>
                    </div>
                    {ci.rating != null && (
                      <span className="text-sm font-semibold text-amber-600">{ci.rating}/5 ★</span>
                    )}
                  </div>
                  {ci.managerNotes && (
                    <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/40 rounded px-2 py-1">{ci.managerNotes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {goals.length === 0 && upcomingCheckIns.length === 0 && completedCheckIns.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No goals or check-ins scheduled yet.
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap" data-testid="text-plan-detail-title">
            {data && (
              <Badge className={PLAN_TYPE_COLORS[data.plan.planType] ?? "bg-gray-100 text-gray-700"}>
                {PLAN_TYPE_LABELS[data.plan.planType] ?? data.plan.planType}
              </Badge>
            )}
            <span>{data?.plan.employeeName ?? "Plan Details"}</span>
          </DialogTitle>
          {data && (
            <DialogDescription className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span><strong>Start:</strong> {formatDate(data.plan.startDate)}</span>
              <span><strong>End:</strong> {formatDate(data.plan.endDate)}</span>
              {data.plan.endDate && (() => {
                const rem = daysRemaining(data.plan.endDate);
                return (
                  <span className={rem < 0 ? "text-red-600 font-medium" : rem <= 7 ? "text-amber-600 font-medium" : ""}>
                    {rem < 0 ? `${Math.abs(rem)} days overdue` : `${rem} days remaining`}
                  </span>
                );
              })()}
              <Badge variant="outline" className="text-[10px]">
                {STATUS_LABELS[data.plan.status] ?? data.plan.status}
              </Badge>
            </DialogDescription>
          )}
        </DialogHeader>
        {content()}
      </DialogContent>
    </Dialog>
  );
}
