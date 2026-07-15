import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Bell,
  AlertTriangle,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { useLocation } from "wouter";

export type ActionItemCategory = "sop" | "pip" | "probation" | "goal" | "training" | "checkin";
export type ActionItemSeverity = "critical" | "warning" | "info";

export interface ActionItem {
  id: string;
  category: ActionItemCategory;
  severity: ActionItemSeverity;
  employeeName: string;
  employeeId: string;
  managerId: string | null;
  managerName: string | null;
  description: string;
  daysOverdue: number;
  deepLinkPath: string;
}

type FilterOption = "all" | "critical" | ActionItemCategory;

const FILTER_PILLS: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "sop", label: "SOP" },
  { value: "pip", label: "PIP" },
  { value: "probation", label: "Probation" },
  { value: "goal", label: "Goals" },
  { value: "training", label: "Training" },
  { value: "checkin", label: "Check-ins" },
];

const CATEGORY_LABELS: Record<ActionItemCategory, string> = {
  sop: "SOP",
  pip: "PIP",
  probation: "Probation",
  goal: "Goal",
  training: "Training",
  checkin: "Check-in",
};

const CATEGORY_COLORS: Record<ActionItemCategory, string> = {
  sop: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  pip: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  probation: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  goal: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  training: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  checkin: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
};

const SEVERITY_DOT: Record<ActionItemSeverity, string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-400",
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface NudgeState {
  pending: boolean;
  nudgedAt: string | null;
}

interface EscalateState {
  pending: boolean;
  alreadyOpen: boolean;
  requestId: string | null;
}

interface ActionRequiredFeedProps {
  items: ActionItem[];
  isLoading?: boolean;
  isHrReadOnly?: boolean;
}

export function ActionRequiredFeed({ items, isLoading, isHrReadOnly }: ActionRequiredFeedProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterOption>("all");
  const [nudgeStates, setNudgeStates] = useState<Record<string, NudgeState>>({});
  const [escalateStates, setEscalateStates] = useState<Record<string, EscalateState>>({});

  const nudgeMutation = useMutation({
    mutationFn: async ({ item }: { item: ActionItem }) => {
      const res = await apiRequest("POST", "/api/governance/nudge", {
        actionItemId: item.id,
        managerId: item.managerId,
        employeeId: item.employeeId || undefined,
        category: item.category,
        daysOverdue: item.daysOverdue > 0 ? item.daysOverdue : undefined,
        context: item.description || undefined,
      });
      return res.json() as Promise<{ sent: boolean; alreadyNudged?: boolean; sentAt: string }>;
    },
    onMutate: ({ item }) => {
      setNudgeStates((prev) => ({ ...prev, [item.id]: { pending: true, nudgedAt: null } }));
    },
    onSuccess: (data, { item }) => {
      if (data.alreadyNudged) {
        setNudgeStates((prev) => ({
          ...prev,
          [item.id]: { pending: false, nudgedAt: data.sentAt },
        }));
        toast({ title: "Already nudged", description: "You nudged this manager within the last 24 hours." });
      } else {
        setNudgeStates((prev) => ({
          ...prev,
          [item.id]: { pending: false, nudgedAt: data.sentAt },
        }));
        toast({ title: "Nudge sent", description: "The manager has been notified." });
      }
    },
    onError: (_err, { item }) => {
      setNudgeStates((prev) => ({ ...prev, [item.id]: { pending: false, nudgedAt: null } }));
      toast({ title: "Nudge failed", description: "Could not send the nudge. Try again.", variant: "destructive" });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async ({ item }: { item: ActionItem }) => {
      const res = await apiRequest("POST", "/api/governance/escalate", {
        actionItemId: item.id,
        employeeId: item.employeeId || undefined,
        category: item.category,
        description: item.description,
      });
      return res.json() as Promise<{ created?: boolean; alreadyOpen?: boolean; requestId: string }>;
    },
    onMutate: ({ item }) => {
      setEscalateStates((prev) => ({ ...prev, [item.id]: { pending: true, alreadyOpen: false, requestId: null } }));
    },
    onSuccess: (data, { item }) => {
      if (data.alreadyOpen) {
        setEscalateStates((prev) => ({
          ...prev,
          [item.id]: { pending: false, alreadyOpen: true, requestId: data.requestId },
        }));
        toast({ title: "Already escalated", description: "An open escalation already exists for this issue." });
      } else {
        setEscalateStates((prev) => ({
          ...prev,
          [item.id]: { pending: false, alreadyOpen: false, requestId: data.requestId },
        }));
        toast({ title: "Escalated to HR", description: "A request has been created in the HR queue." });
        queryClient.invalidateQueries({ queryKey: ["/api/governance/pulse"] });
      }
    },
    onError: (_err, { item }) => {
      setEscalateStates((prev) => ({
        ...prev,
        [item.id]: { pending: false, alreadyOpen: false, requestId: null },
      }));
      toast({ title: "Escalation failed", description: "Could not escalate. Try again.", variant: "destructive" });
    },
  });

  const filtered = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "critical") return item.severity === "critical";
    return item.category === filter;
  });

  const criticalCount = items.filter((i) => i.severity === "critical").length;

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="action-feed-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4" id="action-required-feed" data-testid="action-required-feed">
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_PILLS.map((pill) => {
          const isActive = filter === pill.value;
          const isCriticalPill = pill.value === "critical";
          return (
            <button
              key={pill.value}
              onClick={() => setFilter(pill.value)}
              data-testid={`filter-${pill.value}`}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/40",
              )}
            >
              {pill.label}
              {isCriticalPill && criticalCount > 0 && (
                <span className={cn("rounded-full px-1 text-[10px] font-bold", isActive ? "bg-white/20" : "bg-red-100 text-red-700")}>
                  {criticalCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center" data-testid="action-feed-empty">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <div>
            <p className="font-semibold text-foreground">No action items — governance is on track</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter !== "all" ? "Try switching the filter to All to see more." : "Everything looks good right now."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2" data-testid="action-feed-list">
          {filtered.map((item) => {
            const nudgeState = nudgeStates[item.id];
            const escalateState = escalateStates[item.id];
            const isCheckin = item.category === "checkin";
            const primaryName = isCheckin ? (item.managerName || "Unknown Manager") : (item.employeeName || "Unknown");
            const secondaryName = isCheckin ? null : item.managerName;

            const canEscalate = item.severity === "critical" || item.severity === "warning";
            const escalateDisabled = isHrReadOnly || !!escalateState?.alreadyOpen || !!escalateState?.requestId;
            const nudgeDisabled = isHrReadOnly || !!nudgeState?.nudgedAt;

            return (
              <div
                key={item.id}
                data-testid={`action-item-${item.id}`}
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <span
                  className={cn("h-2.5 w-2.5 rounded-full shrink-0 mt-0.5", SEVERITY_DOT[item.severity])}
                  data-testid={`severity-dot-${item.id}`}
                  title={item.severity}
                />

                <span
                  className={cn("rounded-md px-2 py-0.5 text-xs font-semibold shrink-0", CATEGORY_COLORS[item.category])}
                  data-testid={`category-badge-${item.id}`}
                >
                  {CATEGORY_LABELS[item.category]}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
                    <button
                      className="font-semibold text-foreground hover:underline truncate"
                      onClick={() => setLocation(item.deepLinkPath)}
                      data-testid={`name-link-${item.id}`}
                    >
                      {primaryName}
                    </button>
                    {secondaryName && (
                      <span className="text-muted-foreground text-xs shrink-0">
                        via{" "}
                        <button
                          className="hover:underline"
                          onClick={() => setLocation(item.deepLinkPath)}
                          data-testid={`manager-link-${item.id}`}
                        >
                          {secondaryName}
                        </button>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate" data-testid={`description-${item.id}`}>
                    {item.description}
                  </p>
                </div>

                {item.daysOverdue > 0 && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                      item.severity === "critical"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                    )}
                    data-testid={`overdue-chip-${item.id}`}
                  >
                    {item.daysOverdue}d overdue
                  </span>
                )}

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.managerId && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={nudgeDisabled || nudgeMutation.isPending}
                          onClick={() => nudgeMutation.mutate({ item })}
                          data-testid={`btn-nudge-${item.id}`}
                        >
                          {nudgeState?.pending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Bell className="h-3 w-3" />
                          )}
                          <span className="ml-1">
                            {nudgeState?.nudgedAt ? `Nudged ${formatTimeAgo(nudgeState.nudgedAt)}` : "Nudge"}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {nudgeState?.nudgedAt
                          ? `Manager was nudged ${formatTimeAgo(nudgeState.nudgedAt)}. You can nudge again after 24 hours.`
                          : "Send a notification to the manager asking them to take action."}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {canEscalate && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant={escalateState?.alreadyOpen || escalateState?.requestId ? "ghost" : "outline"}
                          className={cn(
                            "h-7 px-2 text-xs",
                            (escalateState?.alreadyOpen || escalateState?.requestId) &&
                              "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20",
                          )}
                          disabled={escalateDisabled || escalateMutation.isPending}
                          onClick={() => escalateMutation.mutate({ item })}
                          data-testid={`btn-escalate-${item.id}`}
                        >
                          {escalateState?.pending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ShieldAlert className="h-3 w-3" />
                          )}
                          <span className="ml-1">
                            {escalateState?.alreadyOpen || escalateState?.requestId ? "Escalated" : "Escalate"}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {escalateState?.alreadyOpen
                          ? "An open HR escalation already exists for this issue."
                          : escalateState?.requestId
                          ? "This issue has been escalated to HR."
                          : "Create a request in the HR queue for this issue."}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
