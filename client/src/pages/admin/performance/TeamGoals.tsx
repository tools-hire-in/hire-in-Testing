import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Target,
  Users,
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  Calendar,
  Weight,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Rows3,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { formatLocalDate } from "@/lib/dateUtils";

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
  autoProgressFromMilestones: boolean;
  sourceRef: string | null;
  createdAt: string;
  updatedAt?: string;
  lastEscalatedAt?: string | null;
  planId?: string | null;
  planStartDate?: string | null;
  planDurationDays?: number | null;
}

function computeGoalPhaseLabel(goal: PerformanceGoal): string | null {
  if (!goal.planId || !goal.planStartDate || !goal.startDate) return null;
  const dur = goal.planDurationDays ?? 90;
  const phaseLen = Math.ceil(dur / 3);
  const msPerDay = 86400000;
  const offset = Math.max(0, Math.floor(
    (new Date(goal.startDate).getTime() - new Date(goal.planStartDate).getTime()) / msPerDay
  ));
  const phaseIdx = Math.min(2, Math.floor(offset / phaseLen));
  const phaseStart = phaseIdx * phaseLen + 1;
  const phaseEnd = Math.min((phaseIdx + 1) * phaseLen, dur);
  return `Day ${phaseStart}–${phaseEnd}`;
}

interface TeamMemberGoals {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string | null;
  goals: PerformanceGoal[];
}

interface TeamGoalsResponse {
  members: TeamMemberGoals[];
  summary: {
    totalGoals: number;
    completedGoals: number;
    inProgressGoals: number;
    atRiskGoals: number;
  };
}

interface PerformanceMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string | null;
  role: string;
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

const STATUS_OPTIONS = [
  "not_started",
  "in_progress",
  "on_track",
  "at_risk",
  "completed",
  "cancelled",
];

function formatDate(dateStr: string | null) {
  return formatLocalDate(dateStr, "en-US", { year: "numeric", month: "short", day: "numeric" });
}

interface CreateGoalFormData {
  userId: string;
  title: string;
  description: string;
  category: string;
  startDate: string;
  targetDate: string;
  weight: number;
  status: string;
  successCriteria: string;
}

function CreateGoalForMemberDialog({
  open,
  onOpenChange,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMemberGoals[];
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<CreateGoalFormData>({
    userId: "",
    title: "",
    description: "",
    category: "professional_development",
    startDate: new Date().toISOString().split("T")[0],
    targetDate: "",
    weight: 3,
    status: "not_started",
    successCriteria: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateGoalFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CreateGoalFormData, string>> = {};
    if (!form.userId) newErrors.userId = "Please select a team member";
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
    mutationFn: async (data: CreateGoalFormData) => {
      const res = await apiRequest("POST", "/api/performance/goals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/team-goals"] });
      toast({ title: "Goal created for team member" });
      onOpenChange(false);
      setForm({
        userId: "",
        title: "",
        description: "",
        category: "professional_development",
        startDate: new Date().toISOString().split("T")[0],
        targetDate: "",
        weight: 3,
        status: "not_started",
        successCriteria: "",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create goal", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!validate()) return;
    createMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-team-goal-dialog-title">Create Goal for Team Member</DialogTitle>
          <DialogDescription>
            Assign a performance goal to one of your direct reports.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Team Member *</Label>
            <Select value={form.userId} onValueChange={(val) => setForm({ ...form, userId: val })}>
              <SelectTrigger data-testid="select-team-member">
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.firstName} {m.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.userId && <p className="text-xs text-red-600">{errors.userId}</p>}
          </div>

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              data-testid="input-team-goal-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Improve quarterly metrics"
            />
            {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              data-testid="input-team-goal-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Goal details..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(val) => setForm({ ...form, category: val })}>
                <SelectTrigger data-testid="select-team-goal-category">
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
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val })}>
                <SelectTrigger data-testid="select-team-goal-status">
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
              <Label>Start Date *</Label>
              <Input
                data-testid="input-team-goal-start-date"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
              {errors.startDate && <p className="text-xs text-red-600">{errors.startDate}</p>}
            </div>
            <div className="space-y-2">
              <Label>Target Date *</Label>
              <Input
                data-testid="input-team-goal-target-date"
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
              data-testid="slider-team-goal-weight"
              value={[form.weight]}
              onValueChange={([val]) => setForm({ ...form, weight: val })}
              min={1}
              max={5}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Success Criteria</Label>
            <Textarea
              data-testid="input-team-goal-success-criteria"
              value={form.successCriteria}
              onChange={(e) => setForm({ ...form, successCriteria: e.target.value })}
              placeholder="How will success be measured?"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-team-goal">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-save-team-goal">
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Goal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamGoalRow({
  goal,
  expandedGoals,
  toggleGoal,
  canEdit,
}: {
  goal: PerformanceGoal;
  expandedGoals: Set<string>;
  toggleGoal: (id: string) => void;
  canEdit: boolean;
}) {
  return (
    <div
      className="border rounded-lg p-4 space-y-2"
      data-testid={`card-team-goal-${goal.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h4 className="font-medium text-sm">{goal.title}</h4>
          {goal.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {goal.description}
            </p>
          )}
        </div>
        <Badge
          className={STATUS_COLORS[goal.status] || STATUS_COLORS.not_started}
          data-testid={`badge-team-goal-status-${goal.id}`}
        >
          {STATUS_LABELS[goal.status] || goal.status}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Progress value={goal.progress} className="h-1.5 flex-1" />
        <span className="text-xs font-medium w-10 text-right">{goal.progress}%</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Due {formatDate(goal.targetDate)}
        </span>
        <span className="flex items-center gap-1">
          <Weight className="h-3 w-3" />
          Weight: {goal.weight}
        </span>
        <Badge variant="outline" className="text-[10px] h-5">
          {CATEGORY_LABELS[goal.category] || goal.category}
        </Badge>
        {goal.sourceRef && (
          <Badge variant="outline" className="text-[10px] h-5 border-amber-300 text-amber-700 bg-amber-50" data-testid={`badge-team-goal-source-${goal.id}`}>
            Source: Addendum {goal.sourceRef}
          </Badge>
        )}
        {goal.autoProgressFromMilestones && (
          <span className="flex items-center gap-1 text-emerald-600 text-[10px]">
            <Flag className="h-3 w-3" /> Auto-progress
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground"
        onClick={() => toggleGoal(goal.id)}
        data-testid={`button-toggle-team-detail-${goal.id}`}
      >
        {expandedGoals.has(goal.id) ? <ChevronDown className="h-3.5 w-3.5 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 mr-1" />}
        Milestones & check-ins
      </Button>

      {expandedGoals.has(goal.id) && (
        <GoalDetailPanel
          goalId={goal.id}
          autoProgressFromMilestones={goal.autoProgressFromMilestones}
          canEdit={canEdit}
          onGoalChanged={() => queryClient.invalidateQueries({ queryKey: ["/api/performance/team-goals"] })}
        />
      )}
    </div>
  );
}

function PhaseGroupedTeamGoalList({
  goals,
  expandedGoals,
  toggleGoal,
  canEdit,
}: {
  goals: PerformanceGoal[];
  expandedGoals: Set<string>;
  toggleGoal: (id: string) => void;
  canEdit: boolean;
}) {
  const planGoals = goals.filter((g) => !!g.planId);
  const standaloneGoals = goals.filter((g) => !g.planId);

  type PhaseGroup = { planId: string; phaseLabel: string; goals: PerformanceGoal[] };
  const groupMap = new Map<string, PhaseGroup>();
  for (const g of planGoals) {
    const label = computeGoalPhaseLabel(g) ?? "Plan Goals";
    const key = `${g.planId}||${label}`;
    if (!groupMap.has(key)) groupMap.set(key, { planId: g.planId!, phaseLabel: label, goals: [] });
    groupMap.get(key)!.goals.push(g);
  }
  const groups = Array.from(groupMap.values());

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={`${group.planId}-${group.phaseLabel}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full" data-testid={`phase-label-${group.phaseLabel.replace(/\s+/g, "-")}`}>
              {group.phaseLabel}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-3">
            {group.goals.map((goal) => (
              <TeamGoalRow key={goal.id} goal={goal} expandedGoals={expandedGoals} toggleGoal={toggleGoal} canEdit={canEdit} />
            ))}
          </div>
        </div>
      ))}
      {standaloneGoals.length > 0 && (
        <div>
          {groups.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded-full border">
                Standalone
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          <div className="space-y-3">
            {standaloneGoals.map((goal) => (
              <TeamGoalRow key={goal.id} goal={goal} expandedGoals={expandedGoals} toggleGoal={toggleGoal} canEdit={canEdit} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberGoalsSection({ member }: { member: TeamMemberGoals }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const canEdit = !!user?.role && ["super_admin", "admin", "hr", "manager"].includes(user.role);

  const toggleGoal = (goalId: string) =>
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId); else next.add(goalId);
      return next;
    });

  const completedCount = member.goals.filter((g) => g.status === "completed").length;
  const totalCount = member.goals.length;
  const avgProgress =
    totalCount > 0
      ? Math.round(member.goals.reduce((sum, g) => sum + g.progress, 0) / totalCount)
      : 0;

  // Action required: any goal was escalated (lastEscalatedAt set) and has not been
  // updated since escalation (or was escalated more than 5 days ago with no fresh update)
  const today = new Date();
  const msPerDay = 86400000;
  const actionRequiredGoals = member.goals.filter((g) => {
    if (!g.lastEscalatedAt || ["completed", "cancelled"].includes(g.status)) return false;
    const escalatedAt = new Date(g.lastEscalatedAt);
    const updatedAt = g.updatedAt ? new Date(g.updatedAt) : null;
    const daysSinceEscalation = Math.floor((today.getTime() - escalatedAt.getTime()) / msPerDay);
    // "No coaching action" = goal not updated AFTER the escalation date, or updated before escalation
    const noActionSinceEscalation = !updatedAt || updatedAt <= escalatedAt;
    return daysSinceEscalation >= 5 && noActionSinceEscalation;
  });
  const hasActionRequired = actionRequiredGoals.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card data-testid={`card-team-member-${member.userId}`} className={hasActionRequired ? "border-red-400" : ""}>
        {hasActionRequired && (
          <div className="px-5 pt-3 pb-0" data-testid={`banner-action-required-${member.userId}`}>
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-xs font-medium text-red-700 dark:text-red-400">
                Action required — {actionRequiredGoals.length} goal{actionRequiredGoals.length !== 1 ? "s" : ""} escalated with no coaching response in 5+ days
              </span>
            </div>
          </div>
        )}
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {member.firstName[0]}
                  {member.lastName[0]}
                </div>
                <div>
                  <CardTitle className="text-base" data-testid={`text-member-name-${member.userId}`}>
                    {member.firstName} {member.lastName}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {member.designation || member.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                  <p className="font-medium" data-testid={`text-member-goal-count-${member.userId}`}>
                    {completedCount}/{totalCount} completed
                  </p>
                  <p className="text-xs text-muted-foreground">Avg. {avgProgress}% progress</p>
                </div>
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {member.goals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No goals assigned yet.
              </p>
            ) : (
              <PhaseGroupedTeamGoalList
                goals={member.goals}
                expandedGoals={expandedGoals}
                toggleGoal={toggleGoal}
                canEdit={canEdit}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function TeamGoalsContent() {
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const allowedRoles = ["super_admin", "admin", "hr", "manager"];
  const hasAccess = user?.role && allowedRoles.includes(user.role);

  const { data, isLoading } = useQuery<TeamGoalsResponse>({
    queryKey: ["/api/performance/team-goals"],
    enabled: hasAccess,
  });

  // Independent picker source: full direct + indirect report list, including
  // employees who have no goals yet (avoids empty-picker bug).
  const { data: membersData } = useQuery<PerformanceMember[]>({
    queryKey: ["/api/performance/team-members"],
    enabled: hasAccess,
  });

  const pickerMembers: TeamMemberGoals[] = (membersData || []).map(m => ({
    userId: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    email: m.email,
    designation: m.designation,
    goals: [],
  }));

  if (!hasAccess) {
    return (
        <div className="p-6 max-w-5xl mx-auto">
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-lg mb-1">Access Restricted</h3>
              <p className="text-sm text-muted-foreground">
                Team goals are only visible to managers, HR, and admins.
              </p>
            </CardContent>
          </Card>
        </div>
    );
  }

  const summary = data?.summary || {
    totalGoals: 0,
    completedGoals: 0,
    inProgressGoals: 0,
    atRiskGoals: 0,
  };

  const completionPct =
    summary.totalGoals > 0
      ? Math.round((summary.completedGoals / summary.totalGoals) * 100)
      : 0;
  const inProgressPct =
    summary.totalGoals > 0
      ? Math.round((summary.inProgressGoals / summary.totalGoals) * 100)
      : 0;

  return (
      <div className="v2-surface p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Users className="h-6 w-6 text-primary" />
              Team Goals
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Overview of your team's performance goals
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)} data-testid="button-bulk-add-team-goals">
              <Rows3 className="h-4 w-4 mr-2" />
              Add Multiple
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-team-goal">
              <Plus className="h-4 w-4 mr-2" />
              Assign Goal
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" data-testid="text-team-total-goals">
                {summary.totalGoals}
              </p>
              <p className="text-xs text-muted-foreground">Total Goals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600" data-testid="text-team-completed-pct">
                {completionPct}%
              </p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600" data-testid="text-team-in-progress-pct">
                {inProgressPct}%
              </p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600" data-testid="text-team-at-risk">
                {summary.atRiskGoals}
              </p>
              <p className="text-xs text-muted-foreground">At Risk</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : (data?.members || []).length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-lg mb-1" data-testid="text-empty-state">
                No team members found
              </h3>
              <p className="text-sm text-muted-foreground">
                Your direct reports and their goals will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {(data?.members || []).map((member) => (
              <MemberGoalsSection key={member.userId} member={member} />
            ))}
          </div>
        )}

        <CreateGoalForMemberDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          members={pickerMembers}
        />

        <BulkAddGoalsDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          members={pickerMembers.map((m) => ({
            userId: m.userId,
            firstName: m.firstName,
            lastName: m.lastName,
          }))}
          invalidateKey="/api/performance/team-goals"
        />
      </div>
  );
}

export default function TeamGoals() {
  return (
    <AdminLayout>
      <TeamGoalsContent />
    </AdminLayout>
  );
}
