import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  RefreshCw, Plus, CheckCircle2, AlertTriangle, Clock, Target,
  Loader2, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
}

interface GoalTemplate {
  id: string;
  templateCode: string;
  title: string;
  description: string | null;
  suggestedMilestones: string[];
}

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="text-[10px] px-1.5 h-4 bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Done</Badge>;
    case "at_risk":
      return <Badge className="text-[10px] px-1.5 h-4 bg-amber-100 text-amber-700 border-amber-200"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />At Risk</Badge>;
    case "overdue":
      return <Badge className="text-[10px] px-1.5 h-4 bg-red-100 text-red-700 border-red-200"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Overdue</Badge>;
    case "in_progress":
      return <Badge className="text-[10px] px-1.5 h-4 bg-blue-100 text-blue-700 border-blue-200"><Clock className="h-2.5 w-2.5 mr-0.5" />In Progress</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] px-1.5 h-4">{status.replace(/_/g, " ")}</Badge>;
  }
}

function progressBarColor(status: string, pct: number) {
  if (status === "completed") return "bg-green-500";
  if (status === "overdue") return "bg-red-500";
  if (status === "at_risk") return "bg-amber-500";
  if (pct >= 70) return "bg-green-500";
  if (pct >= 40) return "bg-blue-500";
  return "bg-slate-400";
}

function GoalRow({ goal }: { goal: CompanyGoal }) {
  const { toast } = useToast();
  const [sliderOpen, setSliderOpen] = useState(false);
  const [optimisticProgress, setOptimisticProgress] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const displayProgress = optimisticProgress !== null ? optimisticProgress : goal.progress;
  const pct = Math.min(100, Math.max(0, displayProgress));
  const barColor = progressBarColor(goal.status, pct);

  async function commitProgress(value: number) {
    // Optimistic update immediately
    setOptimisticProgress(value);
    setIsSaving(true);
    try {
      const res = await apiRequest("PATCH", `/api/performance/goals/${goal.id}`, { progress: value });
      if (!res.ok) throw new Error("Failed to update");
      queryClient.invalidateQueries({ queryKey: ["/api/ceo/goals"] });
      setSliderOpen(false);
    } catch (err) {
      // Revert optimistic update on failure
      setOptimisticProgress(null);
      toast({ title: "Couldn't save progress", description: String(err), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setSliderOpen(false);
      setOptimisticProgress(null);
    }
  }

  return (
    <div className="py-2.5 space-y-1.5" data-testid={`goal-row-${goal.id}`} onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          {statusBadge(goal.status)}
          <span className="text-xs font-medium truncate">{goal.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {goal.milestone_count > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3" />
              {goal.milestones_done}/{goal.milestone_count}
            </span>
          )}
          {goal.financial_label && (
            <span className="text-[10px] text-muted-foreground">{goal.financial_label}</span>
          )}
        </div>
      </div>

      {/* Progress bar — click to open inline slider */}
      <div
        className="cursor-pointer group"
        onClick={() => setSliderOpen((v) => !v)}
        title="Click to update progress"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSliderOpen((v) => !v); }}
        data-testid={`progress-bar-${goal.id}`}
      >
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-300", barColor, isSaving && "animate-pulse")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground w-8 text-right group-hover:text-foreground">
            {pct}%
          </span>
        </div>
      </div>

      {/* Inline slider — auto-saves on release (onValueCommit) or Enter key */}
      {sliderOpen && (
        <div className="pt-1 pb-0.5 space-y-1.5 bg-accent/40 rounded-md px-2 py-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              Drag to update · releases auto-save
              {isSaving && <span className="ml-1 italic">(saving…)</span>}
            </span>
            <span className="font-medium">{displayProgress}%</span>
          </div>
          <Slider
            value={[displayProgress]}
            onValueChange={([v]) => setOptimisticProgress(v)}
            onValueCommit={([v]) => commitProgress(v)}
            min={0}
            max={100}
            step={5}
            className="w-full"
            disabled={isSaving}
            data-testid={`slider-goal-progress-${goal.id}`}
          />
          <p className="text-[10px] text-muted-foreground text-center">
            Release slider to save · Esc to cancel
          </p>
        </div>
      )}
    </div>
  );
}

interface NewGoalDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

function NewGoalDialog({ open, onOpenChange, onCreated }: NewGoalDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"template" | "blank">("blank");
  const [selectedTemplate, setSelectedTemplate] = useState<GoalTemplate | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [financialLabel, setFinancialLabel] = useState("");

  const { data: templates = [], isLoading: templatesLoading } = useQuery<GoalTemplate[]>({
    queryKey: ["/api/observation/company-goal-templates"],
    enabled: open,
    staleTime: 300000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title,
        description: description || undefined,
        targetDate: targetDate || undefined,
        financialTarget: financialLabel || undefined,
        category: "company",
        status: "in_progress",
        progress: 0,
      };
      const res = await apiRequest("POST", "/api/ceo/copilot/create-goal", body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed to create goal");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Company goal created" });
      onCreated();
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setTargetDate("");
      setFinancialLabel("");
      setSelectedTemplate(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create goal", description: err.message, variant: "destructive" });
    },
  });

  function selectTemplate(t: GoalTemplate) {
    setSelectedTemplate(t);
    setTitle(t.title);
    setDescription(t.description ?? "");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-new-goal-dialog-title">New Company Goal</DialogTitle>
          <DialogDescription>Create a company-level goal to track on the Observation Tower.</DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/40">
          {(["blank", "template"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 text-xs py-1.5 rounded-md transition-colors",
                activeTab === tab
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`tab-new-goal-${tab}`}
            >
              {tab === "blank" ? "Blank" : <><BookOpen className="h-3.5 w-3.5 inline mr-1" />From Template</>}
            </button>
          ))}
        </div>

        {activeTab === "template" && (
          <div className="space-y-2">
            {templatesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : templates.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No templates available</p>
            ) : (
              <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className={cn(
                      "text-left border rounded-lg px-3 py-2 text-xs transition-colors",
                      selectedTemplate?.id === t.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-accent/50",
                    )}
                    data-testid={`template-card-${t.id}`}
                  >
                    <p className="font-medium">{t.title}</p>
                    {t.description && (
                      <p className="text-muted-foreground line-clamp-1 mt-0.5">{t.description}</p>
                    )}
                    {t.suggestedMilestones?.length > 0 && (
                      <p className="text-muted-foreground mt-0.5">{t.suggestedMilestones.length} suggested milestones</p>
                    )}
                  </button>
                ))}
              </div>
            )}
            {selectedTemplate && (
              <p className="text-[11px] text-muted-foreground">
                Selected: <span className="font-medium">{selectedTemplate.title}</span>. Edit fields below.
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input
              data-testid="input-new-goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Achieve 95% client retention"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              data-testid="input-new-goal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional details…"
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Target Date</Label>
              <Input
                data-testid="input-new-goal-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Financial Label (optional)</Label>
              <Input
                data-testid="input-new-goal-financial-label"
                value={financialLabel}
                onChange={(e) => setFinancialLabel(e.target.value)}
                placeholder="e.g., $2M ARR"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-new-goal">
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !title.trim()}
            data-testid="button-save-new-goal"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Goal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GoalsMilestonesPanel() {
  const [newGoalOpen, setNewGoalOpen] = useState(false);

  const { data: goals, isLoading, refetch } = useQuery<CompanyGoal[]>({
    queryKey: ["/api/ceo/goals"],
    staleTime: 60000,
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4" data-testid="goals-milestones-panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Target className="h-4 w-4 text-primary" />
          Goals & Milestones
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => refetch()}
            data-testid="button-refresh-goals"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setNewGoalOpen(true)}
            data-testid="button-new-goal"
          >
            <Plus className="h-3.5 w-3.5" />
            New Goal
          </Button>
        </div>
      </div>

      <NewGoalDialog
        open={newGoalOpen}
        onOpenChange={setNewGoalOpen}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/ceo/goals"] });
        }}
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : !goals || goals.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No company goals yet.</p>
          <p className="text-[11px]">Create one to start tracking.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  );
}
