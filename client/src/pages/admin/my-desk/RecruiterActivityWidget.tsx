/**
 * Task #1115 — Daily Activity Widget for recruiters/operations roles.
 * Shows today's call & screen counts with inline +/- editing.
 * Managers see a compact team summary below.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Phone, Monitor, Users, ChevronUp, ChevronDown, Edit2, Check, X, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface ActivityLog {
  id?: string;
  recruiterId: string;
  logDate: string;
  callsMade: number;
  screensConducted: number;
  notes?: string | null;
}

interface TeamActivityRow {
  recruiterId: string;
  callsMade: number;
  screensConducted: number;
  firstName: string;
  lastName: string;
}

const RECRUITER_ROLES = new Set(["super_admin", "admin", "hr", "operations", "manager", "recruiter"]);
const MANAGER_ROLES = new Set(["super_admin", "admin", "hr", "manager"]);

export default function RecruiterActivityWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [editing, setEditing] = useState(false);
  const [editCalls, setEditCalls] = useState("");
  const [editScreens, setEditScreens] = useState("");

  const role = user?.role || "";
  const isRecruiter = RECRUITER_ROLES.has(role);
  const isManager = MANAGER_ROLES.has(role);

  const today = new Date().toISOString().split("T")[0];
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  })();

  // Today's activity
  const { data: todayActivity, isLoading: todayLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/recruiter/activity", { from: today, to: today }],
    queryFn: async () => {
      const res = await fetch(`/api/recruiter/activity?from=${today}&to=${today}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isRecruiter,
    refetchInterval: 60000,
  });

  // Yesterday's activity (reference numbers)
  const { data: yesterdayActivity } = useQuery<ActivityLog[]>({
    queryKey: ["/api/recruiter/activity", { from: yesterday, to: yesterday }],
    queryFn: async () => {
      const res = await fetch(`/api/recruiter/activity?from=${yesterday}&to=${yesterday}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isRecruiter,
    staleTime: 300000,
  });

  // Manager team view
  const { data: teamActivity = [] } = useQuery<TeamActivityRow[]>({
    queryKey: ["/api/recruiter/activity/today-team"],
    enabled: isManager,
    refetchInterval: 60000,
  });

  const activityMutation = useMutation({
    mutationFn: (data: { callsMade: number; screensConducted: number }) =>
      apiRequest("POST", "/api/recruiter/activity", { ...data, logDate: today }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter/activity/today-team"] });
      setEditing(false);
      toast({ title: "Activity logged", description: "Your daily activity has been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message || "Try again", variant: "destructive" });
    },
  });

  const todayLog = todayActivity?.[0] ?? null;
  const yesterdayLog = yesterdayActivity?.[0] ?? null;

  const todayCalls = todayLog?.callsMade ?? 0;
  const todayScreens = todayLog?.screensConducted ?? 0;
  const yestCalls = yesterdayLog?.callsMade ?? null;
  const yestScreens = yesterdayLog?.screensConducted ?? null;

  function startEdit() {
    setEditCalls(String(todayCalls));
    setEditScreens(String(todayScreens));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function saveEdit() {
    const calls = Math.max(0, parseInt(editCalls, 10) || 0);
    const screens = Math.max(0, parseInt(editScreens, 10) || 0);
    activityMutation.mutate({ callsMade: calls, screensConducted: screens });
  }

  function quickIncrement(field: "calls" | "screens", delta: number) {
    const calls = field === "calls" ? Math.max(0, todayCalls + delta) : todayCalls;
    const screens = field === "screens" ? Math.max(0, todayScreens + delta) : todayScreens;
    activityMutation.mutate({ callsMade: calls, screensConducted: screens });
  }

  if (!isRecruiter && !isManager) return null;

  return (
    <Card className="border shadow-sm" data-testid="cc-recruiter-activity-widget">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Today's Activity
          </CardTitle>
          <div className="flex items-center gap-1">
            {!editing && isRecruiter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={startEdit}
                data-testid="cc-activity-edit-btn"
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => setLocation("/admin/my-desk?tab=pipeline")}
              data-testid="cc-activity-pipeline-btn"
            >
              My Pipeline →
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {todayLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : editing ? (
          <div className="space-y-3" data-testid="cc-activity-edit-form">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Calls Made
                </label>
                <Input
                  type="number"
                  min={0}
                  value={editCalls}
                  onChange={(e) => setEditCalls(e.target.value)}
                  className="h-8 text-sm"
                  data-testid="cc-activity-calls-input"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Monitor className="h-3 w-3" /> Screens Done
                </label>
                <Input
                  type="number"
                  min={0}
                  value={editScreens}
                  onChange={(e) => setEditScreens(e.target.value)}
                  className="h-8 text-sm"
                  data-testid="cc-activity-screens-input"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={saveEdit}
                disabled={activityMutation.isPending}
                data-testid="cc-activity-save-btn"
              >
                <Check className="h-3 w-3 mr-1" />
                {activityMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={cancelEdit}
                data-testid="cc-activity-cancel-btn"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : isRecruiter ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {/* Calls counter */}
              <div className="flex items-center gap-3" data-testid="cc-activity-calls">
                <div className="flex flex-col items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => quickIncrement("calls", 1)}
                    disabled={activityMutation.isPending}
                    data-testid="cc-activity-calls-inc"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => quickIncrement("calls", -1)}
                    disabled={activityMutation.isPending || todayCalls === 0}
                    data-testid="cc-activity-calls-dec"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-mono font-bold" data-testid="cc-activity-calls-count">{todayCalls}</span>
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Calls made</p>
                  {yestCalls !== null && (
                    <p className="text-[10px] text-muted-foreground/60">Yesterday: {yestCalls}</p>
                  )}
                </div>
              </div>

              {/* Screens counter */}
              <div className="flex items-center gap-3" data-testid="cc-activity-screens">
                <div className="flex flex-col items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => quickIncrement("screens", 1)}
                    disabled={activityMutation.isPending}
                    data-testid="cc-activity-screens-inc"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => quickIncrement("screens", -1)}
                    disabled={activityMutation.isPending || todayScreens === 0}
                    data-testid="cc-activity-screens-dec"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-mono font-bold" data-testid="cc-activity-screens-count">{todayScreens}</span>
                    <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Screens done</p>
                  {yestScreens !== null && (
                    <p className="text-[10px] text-muted-foreground/60">Yesterday: {yestScreens}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Log reminder if both still 0 */}
            {todayCalls === 0 && todayScreens === 0 && (
              <button
                onClick={startEdit}
                className="text-xs text-primary underline underline-offset-2"
                data-testid="cc-activity-log-nudge"
              >
                Log today's activity →
              </button>
            )}
          </div>
        ) : null}

        {/* Manager team summary */}
        {isManager && teamActivity.length > 0 && (
          <div className="mt-3 border-t pt-3 space-y-2" data-testid="cc-team-activity-summary">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
              <Users className="h-3.5 w-3.5" />
              Team Activity Today
            </div>
            <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
              {teamActivity.map((member) => (
                <div
                  key={member.recruiterId}
                  className="flex items-center justify-between text-xs"
                  data-testid={`cc-team-activity-${member.recruiterId}`}
                >
                  <span className="text-foreground font-medium">{member.firstName} {member.lastName}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {member.callsMade}
                    </span>
                    <span className="flex items-center gap-1">
                      <Monitor className="h-3 w-3" /> {member.screensConducted}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLocation("/admin/hr/my-team?tab=pipeline")}
              className="text-xs text-primary underline underline-offset-2"
              data-testid="cc-team-funnel-link"
            >
              View team pipeline →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
