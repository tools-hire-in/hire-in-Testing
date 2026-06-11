import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Target,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Calendar,
  Weight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  ExternalLink,
  GraduationCap,
  Rows3,
  ChevronDown,
  ChevronRight,
  Flag,
} from "lucide-react";
import { GoalDetailPanel } from "@/components/performance/GoalDetailPanel";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { BulkAddGoalsDialog } from "@/components/performance/BulkAddGoalsDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface PerformanceGoal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: string;
  startDate: string;
  targetDate: string;
  weight: number;
  progress: number;
  status: string;
  successCriteria: string | null;
  rayoAcademyTrackId: string | null;
  autoProgressFromMilestones: boolean;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  "professional_development",
  "project_delivery",
  "leadership",
  "technical_skills",
  "communication",
  "innovation",
  "other",
];

const CATEGORY_LABELS: Record<string, string> = {
  professional_development: "Professional Development",
  project_delivery: "Project Delivery",
  leadership: "Leadership",
  technical_skills: "Technical Skills",
  communication: "Communication",
  innovation: "Innovation",
  other: "Other",
};

const STATUS_OPTIONS = [
  "not_started",
  "in_progress",
  "on_track",
  "at_risk",
  "completed",
  "cancelled",
];

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  on_track: "On Track",
  at_risk: "At Risk",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  on_track: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  at_risk: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getProgressColor(progress: number) {
  if (progress >= 80) return "bg-emerald-500";
  if (progress >= 50) return "bg-blue-500";
  if (progress >= 25) return "bg-amber-500";
  return "bg-slate-400";
}

interface GoalFormData {
  title: string;
  description: string;
  category: string;
  startDate: string;
  targetDate: string;
  weight: number;
  progress: number;
  status: string;
  successCriteria: string;
  rayoAcademyTrackId: string;
}

const defaultFormData: GoalFormData = {
  title: "",
  description: "",
  category: "professional_development",
  startDate: new Date().toISOString().split("T")[0],
  targetDate: "",
  weight: 3,
  progress: 0,
  status: "not_started",
  successCriteria: "",
  rayoAcademyTrackId: "",
};

function GoalFormDialog({
  open,
  onOpenChange,
  editGoal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editGoal: PerformanceGoal | null;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<GoalFormData>(defaultFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof GoalFormData, string>>>({});

  const { data: rayoStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/rayo-academy/status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/rayo-academy/status", { credentials: "include" });
        if (!res.ok) return { enabled: false };
        return res.json();
      } catch { return { enabled: false }; }
    },
    staleTime: 60000,
  });
  const isRayoEnabled = rayoStatus?.enabled === true;

  const { data: rayoTracks } = useQuery<{ tracks: any[]; fromApi: boolean }>({
    queryKey: ["/api/rayo-academy/tracks"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/rayo-academy/tracks", { credentials: "include" });
        if (!res.ok) return { tracks: [], fromApi: false };
        return res.json();
      } catch { return { tracks: [], fromApi: false }; }
    },
    enabled: isRayoEnabled,
  });

  useEffect(() => {
    if (editGoal) {
      setForm({
        title: editGoal.title,
        description: editGoal.description || "",
        category: editGoal.category,
        startDate: editGoal.startDate?.split("T")[0] || "",
        targetDate: editGoal.targetDate?.split("T")[0] || "",
        weight: editGoal.weight,
        progress: editGoal.progress,
        status: editGoal.status,
        successCriteria: editGoal.successCriteria || "",
        rayoAcademyTrackId: editGoal.rayoAcademyTrackId || "",
      });
    } else {
      setForm(defaultFormData);
    }
  }, [editGoal]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof GoalFormData, string>> = {};
    if (!form.title.trim()) newErrors.title = "Title is required";
    if (!form.targetDate) newErrors.targetDate = "Target date is required";
    if (!form.startDate) newErrors.startDate = "Start date is required";
    if (form.startDate && form.targetDate && form.startDate > form.targetDate) {
      newErrors.targetDate = "Target date must be after start date";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: async (data: GoalFormData) => {
      const res = await apiRequest("POST", "/api/performance/goals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/goals"] });
      toast({ title: "Goal created successfully" });
      onOpenChange(false);
      setForm(defaultFormData);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create goal", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: GoalFormData) => {
      const res = await apiRequest("PATCH", `/api/performance/goals/${editGoal!.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/goals"] });
      toast({ title: "Goal updated successfully" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update goal", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!validate()) return;
    if (editGoal) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-goal-dialog-title">
            {editGoal ? "Edit Goal" : "Create New Goal"}
          </DialogTitle>
          <DialogDescription>
            {editGoal ? "Update your performance goal details." : "Set a new performance goal to track your progress."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-title">Title *</Label>
            <Input
              id="goal-title"
              data-testid="input-goal-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Complete AWS Certification"
            />
            {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-description">Description</Label>
            <Textarea
              id="goal-description"
              data-testid="input-goal-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe your goal in detail..."
              rows={3}
            />
          </div>

          {isRayoEnabled && rayoTracks && rayoTracks.tracks.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="goal-rayo-track">Link to Rayo Academy Track (optional)</Label>
              <Select
                value={form.rayoAcademyTrackId || "none"}
                onValueChange={(val) => setForm({ ...form, rayoAcademyTrackId: val === "none" ? "" : val })}
              >
                <SelectTrigger data-testid="select-goal-rayo-track">
                  <SelectValue placeholder="No linked track" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked track</SelectItem>
                  {rayoTracks.tracks.map((track: any) => (
                    <SelectItem key={track.id} value={track.id}>
                      {track.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Linking a Rayo Academy track helps track training progress alongside your performance goal.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal-category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(val) => setForm({ ...form, category: val })}
              >
                <SelectTrigger data-testid="select-goal-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(val) => setForm({ ...form, status: val })}
              >
                <SelectTrigger data-testid="select-goal-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal-start-date">Start Date *</Label>
              <Input
                id="goal-start-date"
                data-testid="input-goal-start-date"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
              {errors.startDate && <p className="text-xs text-red-600">{errors.startDate}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-target-date">Target Date *</Label>
              <Input
                id="goal-target-date"
                data-testid="input-goal-target-date"
                type="date"
                value={form.targetDate}
                onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
              />
              {errors.targetDate && <p className="text-xs text-red-600">{errors.targetDate}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Weight (1-5): {form.weight}</Label>
            <Slider
              data-testid="slider-goal-weight"
              value={[form.weight]}
              onValueChange={([val]) => setForm({ ...form, weight: val })}
              min={1}
              max={5}
              step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Progress: {form.progress}%</Label>
            <Slider
              data-testid="slider-goal-progress"
              value={[form.progress]}
              onValueChange={([val]) => setForm({ ...form, progress: val })}
              min={0}
              max={100}
              step={5}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-success-criteria">Success Criteria</Label>
            <Textarea
              id="goal-success-criteria"
              data-testid="input-goal-success-criteria"
              value={form.successCriteria}
              onChange={(e) => setForm({ ...form, successCriteria: e.target.value })}
              placeholder="How will you measure success?"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-goal">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-goal">
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editGoal ? "Update Goal" : "Create Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RayoTrackProgressInline({ trackId }: { trackId: string }) {
  const { data } = useQuery<{ trackId: string; progressPct: number; status: string }>({
    queryKey: ["/api/rayo-academy/track-progress", trackId],
    queryFn: async () => {
      const res = await fetch(`/api/rayo-academy/track-progress/${trackId}`, { credentials: "include" });
      if (!res.ok) return { trackId, progressPct: 0, status: "unknown" };
      return res.json();
    },
    staleTime: 30000,
  });

  if (!data || data.status === "unknown") return null;

  return (
    <div className="mt-2 p-2 rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800" data-testid={`rayo-track-progress-${trackId}`}>
      <div className="flex items-center gap-2 text-xs">
        <GraduationCap className="h-3.5 w-3.5 text-indigo-600" />
        <span className="text-indigo-700 dark:text-indigo-300 font-medium">Rayo Academy Track</span>
        <span className="ml-auto font-medium text-indigo-700 dark:text-indigo-300">{data.progressPct}%</span>
      </div>
      <Progress value={data.progressPct} className="h-1.5 mt-1" />
      <button
        className="text-xs text-indigo-600 hover:text-indigo-800 mt-1 flex items-center gap-1"
        onClick={(e) => { e.stopPropagation(); window.open("https://rayo.academy", "_blank"); }}
      >
        <ExternalLink className="h-3 w-3" />
        Open in Rayo Academy
      </button>
    </div>
  );
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: PerformanceGoal;
  onEdit: (goal: PerformanceGoal) => void;
  onDelete: (goal: PerformanceGoal) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const statusIcon = () => {
    switch (goal.status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case "at_risk":
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case "in_progress":
      case "on_track":
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Target className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <Card data-testid={`card-goal-${goal.id}`} className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {statusIcon()}
              <h3 className="font-semibold text-base truncate" data-testid={`text-goal-title-${goal.id}`}>
                {goal.title}
              </h3>
            </div>

            {goal.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {goal.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge className={STATUS_COLORS[goal.status] || STATUS_COLORS.not_started} data-testid={`badge-goal-status-${goal.id}`}>
                {STATUS_LABELS[goal.status] || goal.status}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {CATEGORY_LABELS[goal.category] || goal.category}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Weight className="h-3 w-3" /> Weight: {goal.weight}
              </span>
              {goal.sourceRef && (
                <Badge variant="outline" className="text-[10px] h-5 border-amber-300 text-amber-700 bg-amber-50" data-testid={`badge-goal-source-${goal.id}`}>
                  Source: Addendum {goal.sourceRef}
                </Badge>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium" data-testid={`text-goal-progress-${goal.id}`}>{goal.progress}%</span>
              </div>
              <Progress value={goal.progress} className="h-2" />
            </div>

            {goal.rayoAcademyTrackId && (
              <RayoTrackProgressInline trackId={goal.rayoAcademyTrackId} />
            )}

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(goal.startDate)} - {formatDate(goal.targetDate)}
              </span>
              {goal.autoProgressFromMilestones && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <Flag className="h-3 w-3" /> Auto-progress
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 mt-2 px-2 text-xs text-muted-foreground"
              onClick={() => setShowDetail((s) => !s)}
              data-testid={`button-toggle-detail-${goal.id}`}
            >
              {showDetail ? <ChevronDown className="h-3.5 w-3.5 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 mr-1" />}
              Milestones & check-ins
            </Button>
          </div>

          <div className="flex flex-col gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(goal)}
              data-testid={`button-edit-goal-${goal.id}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(goal)}
              data-testid={`button-delete-goal-${goal.id}`}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>

        {showDetail && (
          <GoalDetailPanel
            goalId={goal.id}
            autoProgressFromMilestones={goal.autoProgressFromMilestones}
            canEdit={true}
            onGoalChanged={() => queryClient.invalidateQueries({ queryKey: ["/api/performance/goals"] })}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function MyGoalsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<PerformanceGoal | null>(null);
  const [deleteGoal, setDeleteGoal] = useState<PerformanceGoal | null>(null);

  const { data: goals, isLoading } = useQuery<PerformanceGoal[]>({
    queryKey: ["/api/performance/goals"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (goalId: string) => {
      await apiRequest("DELETE", `/api/performance/goals/${goalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/goals"] });
      toast({ title: "Goal deleted successfully" });
      setDeleteGoal(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete goal", description: err.message, variant: "destructive" });
    },
  });

  const handleEdit = (goal: PerformanceGoal) => {
    setEditGoal(goal);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditGoal(null);
    setDialogOpen(true);
  };

  const filteredGoals = (goals || []).filter((g) => {
    if (filter === "active") return !["completed", "cancelled"].includes(g.status);
    if (filter === "completed") return g.status === "completed";
    return true;
  });

  const stats = {
    total: (goals || []).length,
    completed: (goals || []).filter((g) => g.status === "completed").length,
    inProgress: (goals || []).filter((g) => ["in_progress", "on_track"].includes(g.status)).length,
    atRisk: (goals || []).filter((g) => g.status === "at_risk").length,
  };

  return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Target className="h-6 w-6 text-primary" />
              My Goals
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track and manage your performance goals
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)} data-testid="button-bulk-add-goals">
              <Rows3 className="h-4 w-4 mr-2" />
              Add Multiple
            </Button>
            <Button onClick={handleCreate} data-testid="button-create-goal">
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" data-testid="text-stat-total">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Goals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600" data-testid="text-stat-completed">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600" data-testid="text-stat-in-progress">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600" data-testid="text-stat-at-risk">{stats.atRisk}</p>
              <p className="text-xs text-muted-foreground">At Risk</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList data-testid="tabs-goal-filter">
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">Active</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredGoals.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-lg mb-1" data-testid="text-empty-state">No goals found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {filter === "all"
                  ? "Get started by creating your first performance goal."
                  : `No ${filter} goals to display.`}
              </p>
              {filter === "all" && (
                <Button onClick={handleCreate} data-testid="button-create-first-goal">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Goal
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={handleEdit}
                onDelete={setDeleteGoal}
              />
            ))}
          </div>
        )}

        <GoalFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditGoal(null);
          }}
          editGoal={editGoal}
        />

        <BulkAddGoalsDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          invalidateKey="/api/performance/goals"
        />

        <AlertDialog open={!!deleteGoal} onOpenChange={(open) => !open && setDeleteGoal(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Goal</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteGoal?.title}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteGoal && deleteMutation.mutate(deleteGoal.id)}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  );
}

export default function MyGoals() {
  return (
    <AdminLayout>
      <MyGoalsContent />
    </AdminLayout>
  );
}
