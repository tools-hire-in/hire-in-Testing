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
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
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
  createdAt: string;
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
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function MemberGoalsSection({ member }: { member: TeamMemberGoals }) {
  const [isOpen, setIsOpen] = useState(false);

  const completedCount = member.goals.filter((g) => g.status === "completed").length;
  const totalCount = member.goals.length;
  const avgProgress =
    totalCount > 0
      ? Math.round(member.goals.reduce((sum, g) => sum + g.progress, 0) / totalCount)
      : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card data-testid={`card-team-member-${member.userId}`}>
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
              <div className="space-y-3">
                {member.goals.map((goal) => (
                  <div
                    key={goal.id}
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

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function TeamGoals() {
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const allowedRoles = ["super_admin", "admin", "hr", "manager"];
  const hasAccess = user?.role && allowedRoles.includes(user.role);

  const { data, isLoading } = useQuery<TeamGoalsResponse>({
    queryKey: ["/api/performance/team-goals"],
    enabled: hasAccess,
  });

  if (!hasAccess) {
    return (
      <AdminLayout>
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
      </AdminLayout>
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
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
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
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-team-goal">
            <Plus className="h-4 w-4 mr-2" />
            Assign Goal
          </Button>
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
          members={data?.members || []}
        />
      </div>
    </AdminLayout>
  );
}
