import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus, Trash2, Check, ChevronUp, ChevronDown, Flag, MessageSquare, Loader2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface GoalMilestone {
  id: string;
  goalId: string;
  title: string;
  targetDate: string | null;
  done: boolean;
  completedAt: string | null;
  sortOrder: number;
}

interface GoalCheckIn {
  id: string;
  scheduledDate: string;
  status: string | null;
  managerNotes: string | null;
  employeeNotes: string | null;
  managerName?: string | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function GoalDetailPanel({
  goalId,
  autoProgressFromMilestones,
  canEdit,
  onGoalChanged,
}: {
  goalId: string;
  autoProgressFromMilestones: boolean;
  canEdit: boolean;
  onGoalChanged?: () => void;
}) {
  const { toast } = useToast();
  const [newTitle, setNewTitle] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");

  const milestonesKey = ["/api/performance/goals", goalId, "milestones"];
  const checkInsKey = ["/api/performance/goals", goalId, "check-ins"];

  const { data: milestones, isLoading: milestonesLoading } = useQuery<GoalMilestone[]>({
    queryKey: milestonesKey,
  });

  const { data: checkIns, isLoading: checkInsLoading } = useQuery<GoalCheckIn[]>({
    queryKey: checkInsKey,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: milestonesKey });
    queryClient.invalidateQueries({ queryKey: checkInsKey });
    onGoalChanged?.();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/performance/goals/${goalId}/milestones`, {
        title: newTitle.trim(),
        targetDate: newTargetDate || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setNewTitle("");
      setNewTargetDate("");
      invalidateAll();
    },
    onError: () => toast({ title: "Could not add milestone", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const res = await apiRequest("PATCH", `/api/performance/milestones/${id}`, { done });
      return res.json();
    },
    onSuccess: invalidateAll,
    onError: () => toast({ title: "Could not update milestone", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/performance/milestones/${id}`);
    },
    onSuccess: invalidateAll,
    onError: () => toast({ title: "Could not delete milestone", variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await apiRequest("POST", `/api/performance/goals/${goalId}/milestones/reorder`, { orderedIds });
      return res.json();
    },
    onSuccess: invalidateAll,
    onError: () => toast({ title: "Could not reorder milestones", variant: "destructive" }),
  });

  const autoProgressMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await apiRequest("PATCH", `/api/performance/goals/${goalId}`, {
        autoProgressFromMilestones: value,
      });
      return res.json();
    },
    onSuccess: invalidateAll,
    onError: () => toast({ title: "Could not update goal", variant: "destructive" }),
  });

  const sorted = (milestones || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const doneCount = sorted.filter(m => m.done).length;

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const ids = sorted.map(m => m.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  }

  return (
    <div className="mt-4 border-t pt-3 space-y-4" data-testid={`goal-detail-${goalId}`}>
      {/* Milestones */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
            <Flag className="h-3.5 w-3.5" /> Milestones
            {sorted.length > 0 && (
              <span className="text-muted-foreground font-normal">({doneCount}/{sorted.length})</span>
            )}
          </span>
          {canEdit && (
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
              <Sparkles className="h-3 w-3" /> Auto-progress
              <Switch
                checked={autoProgressFromMilestones}
                onCheckedChange={(v) => autoProgressMutation.mutate(v)}
                data-testid={`switch-auto-progress-${goalId}`}
              />
            </label>
          )}
        </div>

        {milestonesLoading ? (
          <p className="text-xs text-muted-foreground py-1 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading milestones…
          </p>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">No milestones yet.</p>
        ) : (
          <ul className="space-y-1">
            {sorted.map((m, idx) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 bg-white dark:bg-slate-900"
                data-testid={`milestone-${m.id}`}
              >
                <Checkbox
                  checked={m.done}
                  disabled={!canEdit || toggleMutation.isPending}
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: m.id, done: !!checked })}
                  data-testid={`checkbox-milestone-${m.id}`}
                />
                <div className="flex-1 min-w-0">
                  <span className={`text-xs ${m.done ? "line-through text-muted-foreground" : ""}`} data-testid={`text-milestone-title-${m.id}`}>
                    {m.title}
                  </span>
                  {m.targetDate && (
                    <span className="text-[10px] text-muted-foreground ml-2">Target {formatDate(m.targetDate)}</span>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="h-6 w-6"
                      disabled={idx === 0 || reorderMutation.isPending}
                      onClick={() => move(idx, -1)}
                      data-testid={`btn-milestone-up-${m.id}`}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="h-6 w-6"
                      disabled={idx === sorted.length - 1 || reorderMutation.isPending}
                      onClick={() => move(idx, 1)}
                      data-testid={`btn-milestone-down-${m.id}`}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-700"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(m.id)}
                      data-testid={`btn-milestone-delete-${m.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="flex items-center gap-2 mt-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New milestone…"
              className="h-7 text-xs flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) {
                  e.preventDefault();
                  createMutation.mutate();
                }
              }}
              data-testid={`input-new-milestone-${goalId}`}
            />
            <Input
              type="date"
              value={newTargetDate}
              onChange={(e) => setNewTargetDate(e.target.value)}
              className="h-7 text-xs w-36"
              data-testid={`input-new-milestone-date-${goalId}`}
            />
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              disabled={!newTitle.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid={`btn-add-milestone-${goalId}`}
            >
              {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>
        )}
      </div>

      {/* Linked check-ins */}
      <div>
        <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-200 mb-2">
          <MessageSquare className="h-3.5 w-3.5" /> Linked Check-ins
          {(checkIns?.length || 0) > 0 && (
            <span className="text-muted-foreground font-normal">({checkIns!.length})</span>
          )}
        </span>
        {checkInsLoading ? (
          <p className="text-xs text-muted-foreground py-1 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading check-ins…
          </p>
        ) : (checkIns?.length || 0) === 0 ? (
          <p className="text-xs text-muted-foreground py-1">No check-ins linked to this goal.</p>
        ) : (
          <ul className="space-y-1">
            {checkIns!.map((ci) => (
              <li
                key={ci.id}
                className="rounded-md border px-2 py-1.5 bg-white dark:bg-slate-900"
                data-testid={`goal-checkin-${ci.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{formatDate(ci.scheduledDate)}</span>
                  {ci.managerName && (
                    <span className="text-[10px] text-muted-foreground">with {ci.managerName}</span>
                  )}
                </div>
                {(ci.managerNotes || ci.employeeNotes) && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                    {ci.managerNotes || ci.employeeNotes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
