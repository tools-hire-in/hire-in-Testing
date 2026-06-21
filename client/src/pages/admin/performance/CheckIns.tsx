import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  MessageSquare,
  Plus,
  Calendar,
  User,
  Loader2,
  CheckCircle2,
  Clock,
  Star,
  ListChecks,
  Edit,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface CheckIn {
  id: string;
  employeeId: string;
  managerId: string;
  employeeName: string;
  managerName: string;
  scheduledDate: string;
  status: string;
  discussionTopics: string | null;
  employeeNotes: string | null;
  managerNotes: string | null;
  actionItems: string | null;
  rating: number | null;
  completedAt: string | null;
  createdAt: string;
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface CheckInsResponse {
  checkIns: CheckIn[];
  teamMembers: TeamMember[];
  userRole: string;
}

interface TeamGoalsResponse {
  members: {
    userId: string;
    goals: { id: string; title: string }[];
  }[];
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (val: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
          data-testid={`star-rating-${star}`}
        >
          <Star
            className={`h-5 w-5 ${
              star <= value
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function CreateCheckInDialog({
  open,
  onOpenChange,
  teamMembers,
  userRole,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: TeamMember[];
  userRole: string;
  userId: string;
}) {
  const { toast } = useToast();
  const isManager = ["super_admin", "admin", "hr", "manager"].includes(userRole);

  const [form, setForm] = useState({
    employeeId: isManager ? "" : userId,
    scheduledDate: "",
    discussionTopics: "",
    goalId: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Goals available to link, scoped to the chosen employee.
  const { data: ownGoals } = useQuery<{ id: string; title: string }[]>({
    queryKey: ["/api/performance/goals"],
    enabled: open && !isManager,
  });
  const { data: teamGoalsResp } = useQuery<TeamGoalsResponse>({
    queryKey: ["/api/performance/team-goals"],
    enabled: open && isManager,
  });

  const linkableGoals: { id: string; title: string }[] = isManager
    ? (teamGoalsResp?.members.find((m) => m.userId === form.employeeId)?.goals ?? []).map((g) => ({ id: g.id, title: g.title }))
    : (ownGoals ?? []).map((g) => ({ id: g.id, title: g.title }));

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (isManager && !form.employeeId) newErrors.employeeId = "Please select a team member";
    if (!form.scheduledDate) newErrors.scheduledDate = "Please select a date";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/performance/check-ins", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/check-ins"] });
      toast({ title: "Check-in scheduled successfully" });
      onOpenChange(false);
      setForm({ employeeId: isManager ? "" : userId, scheduledDate: "", discussionTopics: "", goalId: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create check-in", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-create-checkin-title">Schedule Check-In</DialogTitle>
          <DialogDescription>
            Schedule a 1:1 check-in meeting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isManager && (
            <div className="space-y-2">
              <Label>Team Member *</Label>
              <Select
                value={form.employeeId}
                onValueChange={(val) => setForm({ ...form, employeeId: val })}
              >
                <SelectTrigger data-testid="select-checkin-employee">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.firstName} {m.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.employeeId && <p className="text-xs text-red-600">{errors.employeeId}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label>Date *</Label>
            <Input
              data-testid="input-checkin-date"
              type="date"
              value={form.scheduledDate}
              onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
            />
            {errors.scheduledDate && <p className="text-xs text-red-600">{errors.scheduledDate}</p>}
          </div>

          <div className="space-y-2">
            <Label>Linked Goal (optional)</Label>
            <Select
              value={form.goalId || "none"}
              onValueChange={(val) => setForm({ ...form, goalId: val === "none" ? "" : val })}
              disabled={isManager && !form.employeeId}
            >
              <SelectTrigger data-testid="select-checkin-goal">
                <SelectValue placeholder="No goal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No goal</SelectItem>
                {linkableGoals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isManager && !form.employeeId && (
              <p className="text-[11px] text-muted-foreground">Select a team member to link a goal.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Discussion Topics</Label>
            <Textarea
              data-testid="input-checkin-topics"
              value={form.discussionTopics}
              onChange={(e) => setForm({ ...form, discussionTopics: e.target.value })}
              placeholder="Topics to discuss during the check-in..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-checkin">
            Cancel
          </Button>
          <Button
            onClick={() => validate() && createMutation.mutate()}
            disabled={createMutation.isPending}
            data-testid="button-save-checkin"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckInDetailDialog({
  open,
  onOpenChange,
  checkIn,
  userRole,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkIn: CheckIn | null;
  userRole: string;
  userId: string;
}) {
  const { toast } = useToast();
  const isManager = ["super_admin", "admin", "hr", "manager"].includes(userRole);
  const isEmployee = checkIn?.employeeId === userId;

  const [employeeNotes, setEmployeeNotes] = useState(checkIn?.employeeNotes || "");
  const [managerNotes, setManagerNotes] = useState(checkIn?.managerNotes || "");
  const [actionItems, setActionItems] = useState(checkIn?.actionItems || "");
  const [rating, setRating] = useState(checkIn?.rating || 0);
  const [discussionTopics, setDiscussionTopics] = useState(checkIn?.discussionTopics || "");

  useState(() => {
    if (checkIn) {
      setEmployeeNotes(checkIn.employeeNotes || "");
      setManagerNotes(checkIn.managerNotes || "");
      setActionItems(checkIn.actionItems || "");
      setRating(checkIn.rating || 0);
      setDiscussionTopics(checkIn.discussionTopics || "");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { discussionTopics };
      if (isEmployee || isManager) body.employeeNotes = employeeNotes;
      if (isManager) {
        body.managerNotes = managerNotes;
        body.actionItems = actionItems;
        body.rating = rating || null;
      }
      const res = await apiRequest("PATCH", `/api/performance/check-ins/${checkIn!.id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/check-ins"] });
      toast({ title: "Check-in updated" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update check-in", description: err.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        status: "completed",
        employeeNotes,
        managerNotes,
        actionItems,
        rating: rating || null,
        discussionTopics,
      };
      const res = await apiRequest("PATCH", `/api/performance/check-ins/${checkIn!.id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/check-ins"] });
      toast({ title: "Check-in marked as completed" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to complete check-in", description: err.message, variant: "destructive" });
    },
  });

  if (!checkIn) return null;

  const isCompleted = checkIn.status === "completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-checkin-detail-title">
            Check-In Details
          </DialogTitle>
          <DialogDescription>
            {formatDate(checkIn.scheduledDate)} — {checkIn.employeeName} &amp; {checkIn.managerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={STATUS_COLORS[checkIn.status]} data-testid="badge-checkin-status">
              {STATUS_LABELS[checkIn.status] || checkIn.status}
            </Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {checkIn.employeeName}
            </span>
            <span className="text-sm text-muted-foreground">↔</span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {checkIn.managerName}
            </span>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Discussion Topics</Label>
            {isCompleted ? (
              <p className="text-sm bg-muted/50 rounded-md p-3">
                {checkIn.discussionTopics || "No topics recorded."}
              </p>
            ) : (
              <Textarea
                data-testid="input-detail-topics"
                value={discussionTopics}
                onChange={(e) => setDiscussionTopics(e.target.value)}
                placeholder="Topics discussed or to discuss..."
                rows={2}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Employee Notes</Label>
            {isCompleted ? (
              <p className="text-sm bg-muted/50 rounded-md p-3">
                {checkIn.employeeNotes || "No notes from employee."}
              </p>
            ) : (
              <Textarea
                data-testid="input-employee-notes"
                value={employeeNotes}
                onChange={(e) => setEmployeeNotes(e.target.value)}
                placeholder="Employee's notes and reflections..."
                rows={3}
                disabled={!isEmployee && !isManager}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Manager Notes</Label>
            {isCompleted ? (
              <p className="text-sm bg-muted/50 rounded-md p-3">
                {checkIn.managerNotes || "No notes from manager."}
              </p>
            ) : (
              <Textarea
                data-testid="input-manager-notes"
                value={managerNotes}
                onChange={(e) => setManagerNotes(e.target.value)}
                placeholder="Manager's feedback and observations..."
                rows={3}
                disabled={!isManager}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Action Items / Next Steps</Label>
            {isCompleted ? (
              <p className="text-sm bg-muted/50 rounded-md p-3">
                {checkIn.actionItems || "No action items recorded."}
              </p>
            ) : (
              <Textarea
                data-testid="input-action-items"
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
                placeholder="Action items and follow-up tasks..."
                rows={2}
                disabled={!isManager}
              />
            )}
          </div>

          {(isManager || isCompleted) && (
            <div className="space-y-2">
              <Label>Rating</Label>
              <StarRating
                value={rating}
                onChange={isCompleted ? undefined : setRating}
                readonly={isCompleted || !isManager}
              />
            </div>
          )}
        </div>

        {!isCompleted && (
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-detail">
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              data-testid="button-save-checkin-notes"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Notes
            </Button>
            {isManager && (
              <Button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                data-testid="button-complete-checkin"
              >
                {completeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CheckInCard({
  checkIn,
  onClick,
}: {
  checkIn: CheckIn;
  onClick: () => void;
}) {
  const actionItemCount = checkIn.actionItems
    ? checkIn.actionItems.split("\n").filter((l) => l.trim()).length
    : 0;

  return (
    <Card
      data-testid={`card-checkin-${checkIn.id}`}
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm" data-testid={`text-checkin-date-${checkIn.id}`}>
                {formatDate(checkIn.scheduledDate)}
              </span>
              <Badge
                className={STATUS_COLORS[checkIn.status] || STATUS_COLORS.scheduled}
                data-testid={`badge-checkin-status-${checkIn.id}`}
              >
                {STATUS_LABELS[checkIn.status] || checkIn.status}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <User className="h-3.5 w-3.5" />
              <span data-testid={`text-checkin-employee-${checkIn.id}`}>{checkIn.employeeName}</span>
              <span>↔</span>
              <span data-testid={`text-checkin-manager-${checkIn.id}`}>{checkIn.managerName}</span>
            </div>

            {checkIn.discussionTopics && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                {checkIn.discussionTopics}
              </p>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {actionItemCount > 0 && (
                <span className="flex items-center gap-1">
                  <ListChecks className="h-3 w-3" />
                  {actionItemCount} action item{actionItemCount !== 1 ? "s" : ""}
                </span>
              )}
              {checkIn.rating && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {checkIn.rating}/5
                </span>
              )}
            </div>
          </div>
          <Edit className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function CheckIns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("upcoming");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckIn | null>(null);

  const { data, isLoading } = useQuery<CheckInsResponse>({
    queryKey: ["/api/performance/check-ins"],
  });

  const checkIns = data?.checkIns || [];
  const teamMembers = data?.teamMembers || [];
  const userRole = data?.userRole || user?.role || "employee";

  const today = new Date().toISOString().split("T")[0];

  const upcoming = checkIns.filter(
    (c) => c.status !== "completed" && c.status !== "cancelled"
  );
  const past = checkIns.filter(
    (c) => c.status === "completed" || c.status === "cancelled"
  );

  const stats = {
    total: checkIns.length,
    upcoming: upcoming.length,
    completed: past.filter((c) => c.status === "completed").length,
  };

  return (
    <AdminLayout>
      <div className="v2-surface p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <MessageSquare className="h-6 w-6 text-primary" />
              Check-Ins
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              1:1 meetings and performance conversations
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-checkin">
            <Plus className="h-4 w-4 mr-2" />
            Schedule Check-In
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" data-testid="text-stat-total-checkins">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Check-Ins</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600" data-testid="text-stat-upcoming">{stats.upcoming}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600" data-testid="text-stat-completed-checkins">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList data-testid="tabs-checkin-filter">
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">
              <Clock className="h-4 w-4 mr-1" />
              Upcoming ({upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Past ({past.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-1" data-testid="text-empty-upcoming">
                    No upcoming check-ins
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Schedule a check-in to start tracking your 1:1 conversations.
                  </p>
                  <Button onClick={() => setCreateOpen(true)} data-testid="button-schedule-first">
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule Your First Check-In
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcoming
                  .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
                  .map((checkIn) => (
                    <CheckInCard
                      key={checkIn.id}
                      checkIn={checkIn}
                      onClick={() => setSelectedCheckIn(checkIn)}
                    />
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : past.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-1" data-testid="text-empty-past">
                    No past check-ins
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Completed check-ins will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {past
                  .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
                  .map((checkIn) => (
                    <CheckInCard
                      key={checkIn.id}
                      checkIn={checkIn}
                      onClick={() => setSelectedCheckIn(checkIn)}
                    />
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <CreateCheckInDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          teamMembers={teamMembers}
          userRole={userRole}
          userId={user?.id || ""}
        />

        <CheckInDetailDialog
          open={!!selectedCheckIn}
          onOpenChange={(open) => !open && setSelectedCheckIn(null)}
          checkIn={selectedCheckIn}
          userRole={userRole}
          userId={user?.id || ""}
        />
      </div>
    </AdminLayout>
  );
}
