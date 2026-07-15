import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyGoal {
  id: string;
  title: string;
  description: string | null;
  progress: number;
  status: string;
  start_date: string | null;
  target_date: string | null;
  milestone_count: number;
  milestones_done: number;
  financial_label: string | null;
  target_amount: string | null;
  actual_amount: string | null;
  currency: string | null;
}

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="secondary" className="text-[9px] px-1 h-4 bg-green-100 text-green-700 border-green-200">
          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
          Done
        </Badge>
      );
    case "at_risk":
      return (
        <Badge variant="secondary" className="text-[9px] px-1 h-4 bg-amber-100 text-amber-700 border-amber-200">
          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
          At Risk
        </Badge>
      );
    case "overdue":
      return (
        <Badge variant="secondary" className="text-[9px] px-1 h-4 bg-red-100 text-red-700 border-red-200">
          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
          Overdue
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="secondary" className="text-[9px] px-1 h-4 bg-blue-100 text-blue-700 border-blue-200">
          <Clock className="h-2.5 w-2.5 mr-0.5" />
          In Progress
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[9px] px-1 h-4">
          {status.replace(/_/g, " ")}
        </Badge>
      );
  }
}

function progressColor(status: string, progress: number) {
  if (status === "completed") return "bg-green-500";
  if (status === "overdue") return "bg-red-500";
  if (status === "at_risk") return "bg-amber-500";
  if (progress >= 70) return "bg-green-500";
  if (progress >= 40) return "bg-blue-500";
  return "bg-slate-400";
}

export default function CompanyGoalStrip() {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: goals, isLoading } = useQuery<CompanyGoal[]>({
    queryKey: ["/api/ceo/goals"],
    enabled: !!user && user.role === "super_admin",
    refetchInterval: 120000,
  });

  if (!user || user.role !== "super_admin") return null;
  if (isLoading || !goals || goals.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="company-goal-strip">
      <div className="flex items-center gap-2">
        <Target className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company Goals</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {goals.map((goal) => {
          const isExpanded = expandedId === goal.id;
          const pct = Math.min(100, Math.max(0, goal.progress));
          const progColor = progressColor(goal.status, pct);

          return (
            <div
              key={goal.id}
              className={cn(
                "border border-border rounded-lg bg-card transition-all cursor-pointer shrink-0",
                isExpanded ? "w-72" : "w-48"
              )}
              data-testid={`company-goal-card-${goal.id}`}
            >
              {/* Compact row */}
              <div
                className="px-3 py-2 flex items-start gap-2"
                onClick={() => setExpandedId(isExpanded ? null : goal.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {statusBadge(goal.status)}
                    <button className="ml-auto text-muted-foreground">
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </div>
                  <p className="text-xs font-medium text-foreground leading-tight truncate" title={goal.title}>
                    {goal.title}
                  </p>
                  {/* Progress bar */}
                  <div className="mt-1.5 space-y-0.5">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", progColor)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>{pct}%</span>
                      {goal.target_date && (
                        <span>{new Date(goal.target_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-border pt-2" data-testid={`goal-detail-${goal.id}`}>
                  {goal.description && (
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{goal.description}</p>
                  )}

                  {goal.milestone_count > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>
                        {goal.milestones_done}/{goal.milestone_count} milestones
                      </span>
                    </div>
                  )}

                  {goal.financial_label && (
                    <div className="text-[10px] text-muted-foreground">
                      <span className="font-medium">Target: </span>
                      {goal.financial_label}
                    </div>
                  )}

                  {goal.target_date && (
                    <div className="text-[10px] text-muted-foreground">
                      <span className="font-medium">Due: </span>
                      {new Date(goal.target_date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
