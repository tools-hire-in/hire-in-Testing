import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  ClipboardList, CalendarCheck, Target, AlertCircle, Clock, Send, CheckCircle2, Zap, PenLine,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

interface PlanGoal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  progress: number;
  notes: string | null;
  plan_id: string;
  goal_metric_type?: string | null;
  goal_progress_source?: string | null;
  goal_progress_updated_at?: string | null;
  suggested_progress?: number | null;
  progress_pending_review?: boolean | null;
  progress_anomaly_flagged?: boolean | null;
  suggested_progress_at?: string | null;
}

interface CheckIn {
  id: string;
  check_in_type: string;
  scheduled_date: string;
  status: string;
  employee_notes: string | null;
  manager_notes: string | null;
}

interface CoachingEntry {
  id: string;
  note: string;
  entry_date: string;
  author_name: string | null;
}

interface PlanData {
  plan: {
    id: string;
    plan_type: string;
    department_scope: string;
    status: string;
    start_date: string;
    end_date: string;
    duration_days: number;
    manager_name: string | null;
    acknowledged_at: string | null;
  };
  goals: PlanGoal[];
  checkIns: CheckIn[];
  weeklyUpdates: CheckIn[];
  coachingLog?: CoachingEntry[];
}

function planTypeLabel(t: string) {
  if (t === "probation") return "Probation Plan";
  if (t === "growth") return "Growth Plan";
  if (t === "pip") return "Performance Improvement Plan";
  return t;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysRemaining(endDate: string): number {
  const ms = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function isCurrentWeekUpdate(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return d >= weekStart && d < weekEnd;
}

function checkInMarkerColor(ci: CheckIn): string {
  if (ci.status === "completed") return "bg-green-500 border-green-600";
  const today = new Date().toISOString().split("T")[0];
  if (ci.scheduled_date < today) return "bg-red-500 border-red-600";
  return "bg-gray-300 border-gray-400";
}

function checkInMarkerTextColor(ci: CheckIn): string {
  if (ci.status === "completed") return "text-green-700 dark:text-green-400";
  const today = new Date().toISOString().split("T")[0];
  if (ci.scheduled_date < today) return "text-red-700 dark:text-red-400";
  return "text-muted-foreground";
}

const PROBATION_MILESTONE_LABELS: Record<number, string> = {
  30: "Calibration & Correction",
  60: "Consistency Check",
  90: "Confirmation Review",
};

function markerPercent(startDate: string, endDate: string, markerDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const marker = new Date(markerDate).getTime();
  if (end <= start) return 0;
  return Math.min(100, Math.max(0, ((marker - start) / (end - start)) * 100));
}

function PlanTimeline({ plan, checkIns }: { plan: PlanData["plan"]; checkIns: CheckIn[] }) {
  const milestones = checkIns.filter(ci => ci.check_in_type === "milestone");
  if (milestones.length === 0) return null;

  const todayPercent = markerPercent(plan.start_date, plan.end_date, new Date().toISOString().split("T")[0]);

  return (
    <div className="space-y-2" data-testid="plan-timeline">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check-In Timeline</p>
      <div className="relative h-6 mx-2">
        {/* Base track */}
        <div className="absolute top-2.5 left-0 right-0 h-1 bg-muted rounded-full" />
        {/* Progress fill */}
        <div
          className="absolute top-2.5 left-0 h-1 bg-primary/40 rounded-full"
          style={{ width: `${Math.min(100, todayPercent)}%` }}
        />
        {/* Today marker */}
        <div
          className="absolute top-0.5 w-0.5 h-4 bg-primary/60"
          style={{ left: `${Math.min(100, todayPercent)}%` }}
          title="Today"
        />
        {/* Milestone markers */}
        {milestones.map((ci, i) => {
          const pct = markerPercent(plan.start_date, plan.end_date, ci.scheduled_date);
          const color = checkInMarkerColor(ci);
          const dayNum = Math.round((new Date(ci.scheduled_date).getTime() - new Date(plan.start_date).getTime()) / (1000 * 60 * 60 * 24));
          const milestoneLabel = plan.plan_type === "probation" ? PROBATION_MILESTONE_LABELS[dayNum] : undefined;
          const markerTitle = milestoneLabel
            ? `Day ${dayNum} — ${milestoneLabel} Review · ${formatDate(ci.scheduled_date)} — ${ci.status}`
            : `${formatDate(ci.scheduled_date)} — ${ci.status}`;
          return (
            <div
              key={ci.id}
              className="absolute flex flex-col items-center"
              style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
              data-testid={`marker-checkin-${ci.id}`}
            >
              <div className={`w-3 h-3 rounded-full border-2 ${color}`} title={markerTitle} />
              <span className="text-[9px] text-muted-foreground mt-0.5 whitespace-nowrap">D{dayNum}</span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex gap-3 mt-1">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Completed
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Overdue
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />Upcoming
        </span>
      </div>
    </div>
  );
}

function GoalRow({
  goal,
  planId,
  readOnly,
}: {
  goal: PlanGoal;
  planId: string;
  readOnly: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  // Only manager-capable roles can review/confirm Goodhart-guard suggestions.
  // Employees see the pending state as informational, but cannot approve/adjust.
  const canReview = ["manager", "hr", "admin", "super_admin"].includes(user?.role ?? "");
  const [localProgress, setLocalProgress] = useState(goal.progress);
  const [localNotes, setLocalNotes] = useState(goal.notes ?? "");

  const saveGoal = useCallback(
    async (progress: number, notes: string) => {
      const prev = qc.getQueryData<PlanData | null>(["/api/hr/my-plan"]);
      if (prev) {
        qc.setQueryData<PlanData | null>(["/api/hr/my-plan"], {
          ...prev,
          goals: prev.goals.map(g =>
            g.id === goal.id ? { ...g, progress, notes: notes || null } : g
          ),
        });
      }
      try {
        await apiRequest("PATCH", `/api/hr/plans/${planId}/goals/${goal.id}`, { progress, notes: notes || null });
      } catch {
        if (prev) qc.setQueryData(["/api/hr/my-plan"], prev);
        toast({ title: "Failed to save goal update", variant: "destructive" });
      }
    },
    [goal.id, planId, qc, toast]
  );

  const isAutoTracked = goal.goal_metric_type && goal.goal_metric_type !== "manual";
  const isSystemVerified = isAutoTracked && goal.goal_progress_source === "auto";
  const lastUpdated = goal.goal_progress_updated_at
    ? new Date(goal.goal_progress_updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  const sourceLabel: Record<string, string> = {
    submission_count: "submissions data",
    ats_compliance: "ATS update records",
    attendance_consistency: "attendance records",
    sop_completion: "SOP acknowledgements",
    training_completion: "training completions",
  };
  const sourceName = goal.goal_metric_type ? (sourceLabel[goal.goal_metric_type] ?? goal.goal_metric_type) : "system data";

  // Goodhart Guard — pending review state
  const hasPendingReview = goal.progress_pending_review && goal.suggested_progress != null;
  const isAnomalyFlagged = !!goal.progress_anomaly_flagged;
  const [adjProgress, setAdjProgress] = useState<number>(goal.suggested_progress ?? goal.progress);
  const [showAdjust, setShowAdjust] = useState(false);

  const confirmMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/hr/goals/${goal.id}/confirm-progress`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/my-plan"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/goals/pending-review"] });
      toast({ title: "Progress confirmed" });
    },
    onError: () => toast({ title: "Failed to confirm", variant: "destructive" }),
  });

  const adjustMutation = useMutation({
    mutationFn: (progress: number) => apiRequest("POST", `/api/hr/goals/${goal.id}/adjust-progress`, { progress }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/my-plan"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/goals/pending-review"] });
      setShowAdjust(false);
      toast({ title: "Progress adjusted" });
    },
    onError: () => toast({ title: "Failed to adjust", variant: "destructive" }),
  });

  return (
    <div className="border rounded-lg p-3 space-y-2" data-testid={`card-goal-${goal.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" data-testid={`text-goal-title-${goal.id}`}>{goal.title}</p>
          {goal.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{goal.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isAutoTracked && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border font-medium cursor-default ${
                      isSystemVerified
                        ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300"
                        : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300"
                    }`}
                    data-testid={`badge-progress-source-${goal.id}`}
                  >
                    {isSystemVerified
                      ? <><Zap className="h-2.5 w-2.5" /> System verified</>
                      : <><PenLine className="h-2.5 w-2.5" /> Manager entered</>
                    }
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {isSystemVerified
                    ? `Progress calculated automatically from ${sourceName}${lastUpdated ? ` — last updated ${lastUpdated}` : ""}.`
                    : `Progress last entered manually by a manager${lastUpdated ? ` on ${lastUpdated}` : ""}. Auto-sync will resume when progress differs by more than 5 points.`
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!isAutoTracked && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border border-muted-foreground/20 text-muted-foreground font-medium cursor-default"
                    data-testid={`badge-progress-source-${goal.id}`}
                  >
                    <PenLine className="h-2.5 w-2.5" /> Manager entered
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Progress updated manually by a manager or employee.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Badge variant="outline" className="text-xs capitalize">{goal.category}</Badge>
        </div>
      </div>

      {/* Goodhart Guard — pending review banner (manager-only action) */}
      {hasPendingReview && canReview && (
        <div
          className={`rounded-lg border p-2.5 space-y-2 text-xs ${
            isAnomalyFlagged
              ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
              : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
          }`}
          data-testid={`goodhart-guard-${goal.id}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-medium">
              {isAnomalyFlagged ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              ) : (
                <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
              <span className={isAnomalyFlagged ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}>
                {isAnomalyFlagged ? "Anomaly flagged — manual review required" : "⚡ System suggests:"}
              </span>
              {!isAnomalyFlagged && (
                <span className="font-bold text-blue-600 dark:text-blue-400">{goal.suggested_progress}%</span>
              )}
            </div>
            {isAnomalyFlagged && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] shrink-0">Anomaly</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {isAnomalyFlagged
              ? `The system flagged an unusual progress jump to ${goal.suggested_progress}%. Review manually — auto-commit is disabled for anomaly-flagged goals.`
              : `Current: ${goal.progress}% → Suggested: ${goal.suggested_progress}%. Confirm or adjust within 96h (then auto-committed).`
            }
          </p>
          {showAdjust ? (
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={adjProgress}
                onChange={e => setAdjProgress(Number(e.target.value))}
                className="flex-1 accent-primary"
                data-testid={`slider-adjust-gg-${goal.id}`}
              />
              <span className="w-10 text-right font-medium">{adjProgress}%</span>
              <Button
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => adjustMutation.mutate(adjProgress)}
                disabled={adjustMutation.isPending}
                data-testid={`button-save-gg-adjust-${goal.id}`}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setShowAdjust(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {!isAnomalyFlagged && (
                <Button
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending}
                  data-testid={`button-confirm-gg-${goal.id}`}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Confirm {goal.suggested_progress}%
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2"
                onClick={() => { setAdjProgress(goal.suggested_progress ?? goal.progress); setShowAdjust(true); }}
                data-testid={`button-adjust-gg-${goal.id}`}
              >
                Adjust &amp; Accept
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Progress slider */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span data-testid={`text-goal-progress-${goal.id}`}>{localProgress}%</span>
        </div>
        {readOnly ? (
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary/60 rounded-full" style={{ width: `${localProgress}%` }} />
          </div>
        ) : (
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={localProgress}
            onChange={e => setLocalProgress(parseInt(e.target.value))}
            onBlur={() => saveGoal(localProgress, localNotes)}
            className="w-full h-2 accent-primary cursor-pointer"
            data-testid={`slider-goal-${goal.id}`}
          />
        )}
      </div>

      {/* Notes */}
      {!readOnly && (
        <div>
          <Textarea
            value={localNotes}
            onChange={e => setLocalNotes(e.target.value)}
            onBlur={() => saveGoal(localProgress, localNotes)}
            placeholder="Add context, blockers, or updates..."
            rows={2}
            className="text-xs resize-none"
            data-testid={`textarea-goal-notes-${goal.id}`}
          />
        </div>
      )}
      {readOnly && goal.notes && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">{goal.notes}</p>
      )}
    </div>
  );
}

function WeeklyUpdateSection({ planId, weeklyUpdates, onPosted }: {
  planId: string;
  weeklyUpdates: CheckIn[];
  onPosted: () => void;
}) {
  const { toast } = useToast();
  const [note, setNote] = useState("");

  const alreadyPostedThisWeek = weeklyUpdates.some(u => isCurrentWeekUpdate(u.scheduled_date));

  const post = useMutation({
    mutationFn: () => apiRequest("POST", `/api/hr/plans/${planId}/weekly-update`, { note }),
    onSuccess: () => {
      setNote("");
      onPosted();
      toast({ title: "Weekly update posted!" });
    },
    onError: async (err: any) => {
      let msg = "Failed to post update";
      try { const b = await err.response?.json?.(); msg = b?.error ?? msg; } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Send className="h-4 w-4" />
          This Week's Update
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            What did you accomplish this week? Any blockers? (min. 50 characters)
          </p>
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="This week I completed… The main challenge was… Next week I plan to…"
            rows={4}
            className="resize-none text-sm"
            disabled={alreadyPostedThisWeek}
            data-testid="textarea-weekly-update"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {alreadyPostedThisWeek
                ? "✓ Update already posted this week"
                : `${note.length} / 50 min`}
            </span>
            <Button
              size="sm"
              onClick={() => post.mutate()}
              disabled={alreadyPostedThisWeek || note.trim().length < 50 || post.isPending}
              data-testid="button-submit-weekly-update"
            >
              {post.isPending ? "Posting…" : "Submit"}
            </Button>
          </div>
        </div>

        {/* Recent weekly updates */}
        {weeklyUpdates.length > 0 && (
          <div className="space-y-2 pt-1 border-t">
            <p className="text-xs text-muted-foreground font-medium pt-1">Recent updates</p>
            {weeklyUpdates.map(w => (
              <div key={w.id} className="border rounded px-3 py-2 text-xs space-y-0.5" data-testid={`row-weekly-${w.id}`}>
                <div className="flex justify-between text-muted-foreground">
                  <span>Week of {formatDate(w.scheduled_date)}</span>
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                </div>
                <p className="text-foreground line-clamp-3">{w.employee_notes}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── PIP Acknowledgement Blocking Modal ─────────────────────────────────────
// Shown automatically when a PIP plan is in "pending" state.
// The modal cannot be dismissed — the employee must type their full name and
// accept before the plan becomes active.
function PIPAcknowledgementModal({ plan, goals, onAcknowledged }: {
  plan: PlanData["plan"];
  goals: PlanGoal[];
  onAcknowledged: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [nameInput, setNameInput] = useState("");

  const expectedName = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  const nameMatches = nameInput.trim() === expectedName;

  const ack = useMutation({
    mutationFn: () => apiRequest("POST", `/api/hr/plans/${plan.id}/acknowledge`, { typed_name: nameInput.trim() }),
    onSuccess: () => {
      toast({ title: "Plan acknowledged — it is now active" });
      onAcknowledged();
    },
    onError: (err: any) => toast({
      title: "Failed to acknowledge plan",
      description: err?.message || undefined,
      variant: "destructive",
    }),
  });

  return (
    <Dialog
      open={true}
      onOpenChange={() => {}}
    >
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] flex flex-col"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
        data-testid="modal-pip-acknowledge"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Performance Improvement Plan — Acknowledgement Required
          </DialogTitle>
          <DialogDescription>
            You must review and acknowledge this PIP before it becomes active. This modal cannot be dismissed.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-4 py-1">
          {/* Duration summary */}
          <div className="border rounded-lg p-3 bg-muted/30 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="font-medium">{formatDate(plan.start_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">End Date</p>
              <p className="font-medium">{formatDate(plan.end_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="font-medium">{plan.duration_days} days</p>
            </div>
            {plan.manager_name && (
              <div>
                <p className="text-xs text-muted-foreground">Reporting Manager</p>
                <p className="font-medium">{plan.manager_name}</p>
              </div>
            )}
          </div>

          {/* Goals & targets */}
          {goals.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Goals &amp; Targets ({goals.length})
              </p>
              {goals.map(g => (
                <div key={g.id} className="border rounded p-2.5 text-xs space-y-0.5" data-testid={`row-pip-goal-${g.id}`}>
                  <p className="font-medium text-sm">{g.title}</p>
                  {g.description && <p className="text-muted-foreground">{g.description}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Consequences clause */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-1">
            <p className="font-semibold text-sm text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Consequences of Non-Compliance
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Failure to meet the targets specified in this Performance Improvement Plan may result in an extension
              of the plan period, a change in role or responsibilities, or termination of employment in accordance
              with company policy.
            </p>
          </div>
        </div>

        {/* Name confirmation */}
        <div className="shrink-0 space-y-2 pt-3 border-t">
          <p className="text-sm font-medium">
            Type your full name exactly as shown to confirm you have read and understood this plan:
          </p>
          <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">
            Expected: <strong>{expectedName}</strong>
          </p>
          <Input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            placeholder="Enter your full name"
            data-testid="input-ack-name"
          />
        </div>

        <DialogFooter className="shrink-0">
          <Button
            onClick={() => ack.mutate()}
            disabled={!nameMatches || ack.isPending}
            className="w-full"
            data-testid="button-confirm-acknowledge"
          >
            {ack.isPending ? "Acknowledging…" : "I acknowledge and accept this Performance Improvement Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MyPlanView() {
  const { data, isLoading, refetch } = useQuery<PlanData | null>({
    queryKey: ["/api/hr/my-plan"],
  });

  const { toast } = useToast();

  const acknowledgePlan = useMutation({
    mutationFn: (planId: string) => apiRequest("POST", `/api/hr/plans/${planId}/acknowledge`, {}),
    onSuccess: () => {
      refetch();
      toast({ title: "Plan acknowledged — it is now active" });
    },
    onError: () => toast({ title: "Failed to acknowledge plan", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="my-plan-loading">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-60 w-full rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card data-testid="my-plan-empty">
        <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No active plan</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            You don't have an active or pending plan right now. Your manager or HR will create one when needed.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { plan, goals, checkIns, weeklyUpdates } = data;
  const coachingLog = data.coachingLog ?? [];
  const isPending = plan.status === "pending";
  const isPIP = plan.plan_type === "pip";
  const remaining = daysRemaining(plan.end_date);
  const today = new Date().toISOString().split("T")[0];

  // Next scheduled milestone check-in
  const nextCheckIn = checkIns
    .filter(ci => ci.check_in_type === "milestone" && ci.status === "scheduled")
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0] ?? null;

  const nextIsOverdue = nextCheckIn && nextCheckIn.scheduled_date < today;

  return (
    <div className="space-y-4" data-testid="my-plan-view">
      {/* PIP blocking acknowledgement modal — shown on load when pip + pending */}
      {isPIP && isPending && (
        <PIPAcknowledgementModal
          plan={plan}
          goals={goals}
          onAcknowledged={refetch}
        />
      )}

      {/* Header card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                {planTypeLabel(plan.plan_type)}
                {plan.department_scope && (
                  <span className="text-xs font-normal text-muted-foreground capitalize">({plan.department_scope})</span>
                )}
              </CardTitle>
              {plan.manager_name && (
                <p className="text-xs text-muted-foreground mt-0.5">Manager: {plan.manager_name}</p>
              )}
            </div>
            <Badge
              variant={plan.status === "active" ? "default" : plan.status === "pending" ? "secondary" : "outline"}
              className="capitalize"
              data-testid="badge-plan-status"
            >
              {plan.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date row + days remaining */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Start</p>
              <p className="font-medium" data-testid="text-plan-start">{formatDate(plan.start_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">End</p>
              <p className="font-medium" data-testid="text-plan-end">{formatDate(plan.end_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Days left</p>
              <p className="font-medium" data-testid="text-plan-days-remaining">
                {remaining > 0 ? `${remaining}d` : "Ended"}
              </p>
            </div>
          </div>

          {/* Next check-in callout */}
          {nextCheckIn && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border ${
                nextIsOverdue
                  ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                  : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
              }`}
              data-testid="next-checkin-callout"
            >
              <CalendarCheck className={`h-4 w-4 shrink-0 ${nextIsOverdue ? "text-red-600" : "text-blue-600"}`} />
              <div>
                <span className={`font-medium ${nextIsOverdue ? "text-red-700 dark:text-red-300" : "text-blue-700 dark:text-blue-300"}`}>
                  Next check-in:
                </span>{" "}
                <span className={`${nextIsOverdue ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
                  {formatDate(nextCheckIn.scheduled_date)}
                  {nextIsOverdue && " — overdue"}
                </span>
              </div>
              <Badge variant="outline" className={`ml-auto text-xs shrink-0 ${nextIsOverdue ? "border-red-400 text-red-600" : ""}`}>
                {nextIsOverdue ? "Overdue" : "Upcoming"}
              </Badge>
            </div>
          )}

          {/* Horizontal timeline */}
          <PlanTimeline plan={plan} checkIns={checkIns} />

          {/* Pending acknowledgement — PIP uses blocking modal; other plan types use inline banner */}
          {isPending && !isPIP && (
            <div className="flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300 flex-1">
                Your plan is pending your acknowledgement. Review the goals below and confirm to make it active.
              </p>
              <Button
                size="sm"
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => acknowledgePlan.mutate(plan.id)}
                disabled={acknowledgePlan.isPending}
                data-testid="button-acknowledge-plan"
              >
                Acknowledge
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goals */}
      {goals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              Goals ({goals.length})
              {isPIP && (
                <Badge variant="outline" className="text-xs ml-1">Read-only</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {goals.map(g => (
              <GoalRow key={g.id} goal={g} planId={plan.id} readOnly={isPIP} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Coaching notes from manager/HR (read-only) */}
      {coachingLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Coaching Notes ({coachingLog.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {coachingLog.map(c => (
              <div key={c.id} className="border rounded-lg p-2.5 text-xs space-y-1" data-testid={`row-coaching-${c.id}`}>
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-medium text-foreground">{c.author_name || "Manager"}</span>
                  <span>{formatDate(c.entry_date)}</span>
                </div>
                <p className="text-foreground whitespace-pre-wrap">{c.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* PIP: no weekly update input; manager owns PIP reviews */}
      {!isPIP && plan.status === "active" && (
        <WeeklyUpdateSection
          planId={plan.id}
          weeklyUpdates={weeklyUpdates}
          onPosted={() => refetch()}
        />
      )}
    </div>
  );
}
