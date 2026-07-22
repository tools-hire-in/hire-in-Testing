import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  BellOff,
  Users,
  Trash2,
  Filter,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TrackStep {
  id: string;
  title: string;
  stepNumber: number;
}

interface OnboardingUserRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  track: string;
  totalSteps: number;
  completedSteps: number;
  completedStepIds: string[];
  steps: TrackStep[];
  knowledgeChecksPassed: Record<string, boolean>;
  completedAt: string | null;
  startedAt: string | null;
  snoozed: boolean;
  lastActivityAt: string | null;
}

interface DashboardResponse {
  users: OnboardingUserRow[];
}

type StatusFilter = "all" | "not-started" | "in-progress" | "snoozed" | "complete";
type SortKey = "name" | "role" | "completion" | "last-activity" | "stuck";

function getStatus(row: OnboardingUserRow): StatusFilter {
  if (row.completedAt) return "complete";
  if (row.snoozed) return "snoozed";
  if (row.startedAt) return "in-progress";
  return "not-started";
}

function isStuck(row: OnboardingUserRow): boolean {
  if (row.snoozed) return true;
  if (!row.startedAt || row.completedAt) return false;
  const startedAt = new Date(row.startedAt);
  const hoursSinceStart = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceStart > 48 && row.completedSteps < row.totalSteps;
}

function StatusBadge({ row }: { row: OnboardingUserRow }) {
  const status = getStatus(row);
  const stuck = isStuck(row);

  if (status === "complete") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0" data-testid="badge-onboarding-complete">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Complete
      </Badge>
    );
  }
  if (status === "snoozed") {
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0" data-testid="badge-onboarding-snoozed">
        <BellOff className="h-3 w-3 mr-1" />
        Snoozed
      </Badge>
    );
  }
  if (status === "not-started") {
    return (
      <Badge variant="outline" className="text-muted-foreground" data-testid="badge-onboarding-not-started">
        Not Started
      </Badge>
    );
  }
  return (
    <Badge className={`border-0 ${stuck ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`} data-testid="badge-onboarding-in-progress">
      <Clock className="h-3 w-3 mr-1" />
      {stuck ? "Stalled" : "In Progress"}
    </Badge>
  );
}

function ExpandedRow({ row }: { row: OnboardingUserRow }) {
  const kcKeys = Object.keys(row.knowledgeChecksPassed);
  const kcPassed = kcKeys.filter((k) => row.knowledgeChecksPassed[k]).length;

  const completedSet = new Set(row.completedStepIds);
  const completedSteps = row.steps.filter((s) => completedSet.has(s.id));
  const pendingSteps = row.steps.filter((s) => !completedSet.has(s.id));

  return (
    <div className="px-4 py-4 bg-muted/30 border-t space-y-4 text-sm" data-testid={`expanded-row-${row.userId}`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Completed steps */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1.5">
            Completed Steps <span className="text-foreground">({completedSteps.length})</span>
          </p>
          <div className="space-y-0.5">
            {completedSteps.length === 0 ? (
              <span className="text-muted-foreground text-xs italic">None yet</span>
            ) : (
              completedSteps.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="text-foreground">{s.stepNumber}. {s.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending steps */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1.5">
            Pending Steps <span className="text-foreground">({pendingSteps.length})</span>
          </p>
          <div className="space-y-0.5">
            {pendingSteps.length === 0 ? (
              <span className="text-emerald-600 text-xs font-medium">All done ✓</span>
            ) : (
              pendingSteps.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{s.stepNumber}. {s.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Knowledge checks */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1.5">Knowledge Checks</p>
          <p className="text-sm font-semibold">
            {kcPassed} / {kcKeys.length} passed
          </p>
          {kcKeys.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {kcKeys.map((k) => {
                const step = row.steps.find((s) => s.id === k);
                const label = step ? `${step.stepNumber}.` : k.slice(0, 6);
                return (
                  <Badge
                    key={k}
                    variant="outline"
                    title={step?.title ?? k}
                    className={`text-[10px] ${row.knowledgeChecksPassed[k] ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20" : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20"}`}
                  >
                    {label} {row.knowledgeChecksPassed[k] ? "✓" : "✗"}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1.5">Timeline</p>
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {row.startedAt && (
              <p>Started: {new Date(row.startedAt).toLocaleDateString()}</p>
            )}
            {row.completedAt && (
              <p className="text-emerald-600 font-medium">Completed: {new Date(row.completedAt).toLocaleDateString()}</p>
            )}
            {row.snoozed && !row.completedAt && (
              <p className="text-amber-600">Snoozed — not resumed yet</p>
            )}
            {!row.startedAt && !row.snoozed && (
              <p className="italic">Not started</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const TRACK_LABELS: Record<string, string> = {
  employee: "Employee",
  manager: "Manager",
  hr: "HR",
  executive: "Executive",
  admin: "Admin",
};

interface TrackSummary {
  track: string;
  total: number;
  completed: number;
  pct: number;
}

function buildTrackSummaries(users: OnboardingUserRow[]): TrackSummary[] {
  const map: Record<string, { total: number; completed: number }> = {};
  for (const u of users) {
    if (!map[u.track]) map[u.track] = { total: 0, completed: 0 };
    map[u.track].total++;
    if (u.completedAt) map[u.track].completed++;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([track, { total, completed }]) => ({
      track,
      total,
      completed,
      pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    }));
}

export function OnboardingDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr";

  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [showStuck, setShowStuck] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [wipeTarget, setWipeTarget] = useState<OnboardingUserRow | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<DashboardResponse>({
    queryKey: ["/api/onboarding/dashboard"],
    refetchInterval: 60000,
  });

  const wipeMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/onboarding/progress/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/dashboard"] });
      toast({ title: "Progress wiped", description: "The user's onboarding progress has been reset." });
      setWipeTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const users = data?.users ?? [];

  const totalOnboarded = users.filter((u) => u.completedAt).length;
  const totalSnoozed = users.filter((u) => u.snoozed && !u.completedAt).length;
  const completionPct = users.length > 0 ? Math.round((totalOnboarded / users.length) * 100) : 0;
  const trackSummaries = buildTrackSummaries(users);

  const tracks = Array.from(new Set(users.map((u) => u.track))).sort();
  const roles = Array.from(new Set(users.map((u) => u.role))).sort();

  const filtered = users
    .filter((u) => {
      if (showStuck && !isStuck(u)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      if (trackFilter !== "all" && u.track !== trackFilter) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && getStatus(u) !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortKey) {
        case "role": return a.role.localeCompare(b.role);
        case "completion": {
          const pctA = a.totalSteps ? a.completedSteps / a.totalSteps : 0;
          const pctB = b.totalSteps ? b.completedSteps / b.totalSteps : 0;
          return pctB - pctA;
        }
        case "last-activity": {
          const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
          return tb - ta;
        }
        case "stuck": {
          const sa = isStuck(a) ? 1 : 0;
          const sb = isStuck(b) ? 1 : 0;
          return sb - sa;
        }
        default: return a.name.localeCompare(b.name);
      }
    });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4" data-testid="onboarding-dashboard">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3" data-testid="onboarding-stats">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Onboarded</p>
          <p className="text-2xl font-bold mt-0.5">{totalOnboarded} <span className="text-sm font-normal text-muted-foreground">/ {users.length}</span></p>
          <Progress value={completionPct} className="h-1 mt-1.5" />
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Completion</p>
          <p className="text-2xl font-bold mt-0.5">{completionPct}<span className="text-sm font-normal text-muted-foreground">%</span></p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Snoozed / Stalled</p>
          <p className="text-2xl font-bold mt-0.5 text-amber-600">{totalSnoozed}</p>
        </div>
      </div>

      {/* Per-track completion summary strip */}
      {trackSummaries.length > 0 && (
        <div className="rounded-lg border bg-card px-4 py-3" data-testid="onboarding-track-summary">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Completion by Track</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {trackSummaries.map((ts) => (
              <button
                key={ts.track}
                type="button"
                className={`text-left rounded-md border px-3 py-2 transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring ${trackFilter === ts.track ? "border-primary bg-primary/5" : "bg-muted/20"}`}
                onClick={() => setTrackFilter(trackFilter === ts.track ? "all" : ts.track)}
                data-testid={`track-summary-${ts.track}`}
              >
                <p className="text-xs font-medium text-foreground">{TRACK_LABELS[ts.track] ?? ts.track}</p>
                <p className="text-lg font-bold mt-0.5 leading-none">
                  {ts.pct}<span className="text-xs font-normal text-muted-foreground">%</span>
                </p>
                <Progress value={ts.pct} className="h-1 mt-1.5" />
                <p className="text-[10px] text-muted-foreground mt-1">{ts.completed}/{ts.total} done</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters & controls */}
      <div className="flex flex-wrap items-center gap-2" data-testid="onboarding-filters">
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm w-48"
          data-testid="input-onboarding-search"
        />

        <Select value={trackFilter} onValueChange={setTrackFilter}>
          <SelectTrigger className="h-8 text-sm w-36" data-testid="select-track-filter">
            <SelectValue placeholder="Track" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tracks</SelectItem>
            {tracks.map((t) => (
              <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-8 text-sm w-36" data-testid="select-role-filter">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-8 text-sm w-36" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not-started">Not Started</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="snoozed">Snoozed</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={showStuck ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setShowStuck((v) => !v)}
          data-testid="button-stuck-filter"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Stuck
        </Button>

        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="h-8 text-sm w-40" data-testid="select-sort">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="stuck">Sort: Stuck First</SelectItem>
            <SelectItem value="role">Sort: Role</SelectItem>
            <SelectItem value="completion">Sort: Completion %</SelectItem>
            <SelectItem value="last-activity">Sort: Last Activity</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-onboarding"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground" data-testid="onboarding-loading">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading onboarding data…</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-lg" data-testid="onboarding-empty">
          <Users className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">{users.length === 0 ? "No users found." : "No users match the current filters."}</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" data-testid="onboarding-table">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_2fr_1fr_1fr] gap-2 px-4 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
            <span>Name</span>
            <span>Role</span>
            <span>Track</span>
            <span>Progress</span>
            <span>Last Activity</span>
            <span>Status</span>
          </div>

          {filtered.map((row) => {
            const expanded = expandedIds.has(row.userId);
            const pct = row.totalSteps ? Math.round((row.completedSteps / row.totalSteps) * 100) : 0;
            const kcCount = Object.values(row.knowledgeChecksPassed).filter(Boolean).length;

            return (
              <div key={row.userId} className="border-b last:border-0" data-testid={`onboarding-row-${row.userId}`}>
                <div
                  className="grid grid-cols-[2fr_1fr_1fr_2fr_1fr_1fr] gap-2 px-4 py-3 items-center cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(row.userId)}
                >
                  {/* Name + expand indicator */}
                  <div className="flex items-center gap-2 min-w-0">
                    <button className="text-muted-foreground hover:text-foreground flex-shrink-0" data-testid={`button-expand-${row.userId}`}>
                      {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{row.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="text-sm text-muted-foreground capitalize">{row.role.replace("_", " ")}</div>

                  {/* Track */}
                  <div className="text-sm text-muted-foreground capitalize">{row.track}</div>

                  {/* Steps + progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{row.completedSteps}/{row.totalSteps} steps</span>
                      <span>{kcCount} K-checks</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>

                  {/* Last activity */}
                  <div className="text-xs text-muted-foreground">
                    {row.lastActivityAt
                      ? formatDistanceToNow(new Date(row.lastActivityAt), { addSuffix: true })
                      : "—"}
                  </div>

                  {/* Status + wipe action */}
                  <div className="flex items-center gap-2">
                    <StatusBadge row={row} />
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWipeTarget(row);
                        }}
                        title="Wipe progress"
                        data-testid={`button-wipe-${row.userId}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {expanded && <ExpandedRow row={row} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Wipe confirmation dialog */}
      <AlertDialog open={!!wipeTarget} onOpenChange={(o) => !o && setWipeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wipe onboarding progress?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all onboarding progress for <strong>{wipeTarget?.name}</strong>. They will restart from step 1 on their next login. This action is audit-logged and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-wipe-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => wipeTarget && wipeMutation.mutate(wipeTarget.userId)}
              disabled={wipeMutation.isPending}
              data-testid="button-wipe-confirm"
            >
              {wipeMutation.isPending ? "Wiping…" : "Wipe Progress"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
