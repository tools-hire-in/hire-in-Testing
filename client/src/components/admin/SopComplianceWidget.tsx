import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { ShieldCheck, AlertTriangle, ChevronRight, ExternalLink } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WaveHealth {
  waveNumber: number;
  waveName: string;
  dueDate: string | null;
  onTrack: number;
  lagging: number;
  overdue: number;
  notStarted: number;
  total: number;
  myGoalId: string | null;
  directReportBreakdown?: {
    userId: string;
    name: string;
    status: "on_track" | "lagging" | "overdue" | "not_started";
    goalId: string | null;
    daysRemaining: number | null;
    worstSopCode: string | null;
    worstSopTitle: string | null;
  }[];
}

interface ComplianceHealthResponse {
  waves: WaveHealth[];
  viewerRole: string;
  hasActiveSopGoals?: boolean;
  orgWide?: {
    byDepartment: {
      department: string | null;
      onTrack: number;
      lagging: number;
      overdue: number;
      total: number;
    }[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return d;
  }
}

// Stacked horizontal bar for a wave
function WaveBar({ wave, onGoalClick }: { wave: WaveHealth; onGoalClick: (goalId: string) => void }) {
  const total = wave.total || 1;
  const acknowledged = wave.onTrack;
  const lagging = wave.lagging;
  const overdue = wave.overdue;
  const notStarted = wave.notStarted;

  const ackW = (acknowledged / total) * 100;
  const lagW = (lagging / total) * 100;
  const ovdW = (overdue / total) * 100;
  const nsW = (notStarted / total) * 100;

  const overallStatus: "green" | "amber" | "red" =
    overdue > 0 ? "red" : lagging > 0 ? "amber" : "green";

  const statusColor = {
    green: "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20",
    amber: "border-amber-300 bg-amber-50 dark:bg-amber-950/20",
    red: "border-red-300 bg-red-50 dark:bg-red-950/20",
  }[overallStatus];

  return (
    <div
      className={`rounded border p-2.5 cursor-pointer hover:shadow-sm transition-shadow ${statusColor}`}
      onClick={() => wave.myGoalId && onGoalClick(wave.myGoalId)}
      data-testid={`sop-wave-bar-${wave.waveNumber}`}
    >
      <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
        <span className="text-xs font-medium truncate">
          Wave {wave.waveNumber} — {wave.waveName}
        </span>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
          {wave.dueDate && <span>Due {formatDate(wave.dueDate)}</span>}
          {wave.myGoalId && (
            <span className="inline-flex items-center gap-0.5 text-primary hover:underline">
              Goal <ExternalLink className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-muted/50 gap-px" data-testid={`wave-health-bar-${wave.waveNumber}`}>
        {ackW > 0 && (
          <div
            className="bg-emerald-500 rounded-full transition-all"
            style={{ width: `${ackW}%` }}
            title={`Acknowledged: ${acknowledged}`}
          />
        )}
        {lagW > 0 && (
          <div
            className="bg-amber-400 rounded-full transition-all"
            style={{ width: `${lagW}%` }}
            title={`In progress / lagging: ${lagging}`}
          />
        )}
        {ovdW > 0 && (
          <div
            className="bg-red-500 rounded-full transition-all"
            style={{ width: `${ovdW}%` }}
            title={`Overdue: ${overdue}`}
          />
        )}
        {nsW > 0 && (
          <div
            className="bg-muted-foreground/20 rounded-full transition-all"
            style={{ width: `${nsW}%` }}
            title={`Not started: ${notStarted}`}
          />
        )}
      </div>
      {total > 1 && (
        <div className="mt-1 flex gap-2.5 text-[10px] text-muted-foreground flex-wrap">
          {acknowledged > 0 && <span className="text-emerald-600">✓ {acknowledged} done</span>}
          {lagging > 0 && <span className="text-amber-600">⟳ {lagging} lagging</span>}
          {overdue > 0 && <span className="text-red-600">⚠ {overdue} overdue</span>}
          {notStarted > 0 && <span>{notStarted} not started</span>}
        </div>
      )}
    </div>
  );
}

// ─── Employee view ────────────────────────────────────────────────────────────

export function SopComplianceWidgetEmployee() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery<ComplianceHealthResponse>({
    queryKey: ["/api/sops/compliance-health"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <Card data-testid="sop-compliance-widget-employee">
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const waves = data?.waves ?? [];
  // Hide when the employee has no active SOP compliance goals
  if (!data?.hasActiveSopGoals) return null;

  const hasIssues = waves.some((w) => w.overdue > 0 || w.lagging > 0);

  const handleGoalClick = (goalId: string) => {
    setLocation(`/admin/growth?tab=goals&goalId=${goalId}`);
  };

  return (
    <Card
      className={hasIssues ? "border-amber-200 dark:border-amber-800" : ""}
      data-testid="sop-compliance-widget-employee"
    >
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">SOP Compliance Health</CardTitle>
          {hasIssues && (
            <Badge variant="outline" className="ml-auto text-amber-600 border-amber-400 text-[10px]">
              Action needed
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Your active SOP training goals</p>
      </CardHeader>
      <CardContent className="pt-0 pb-4 space-y-2">
        {waves.map((wave) => (
          <WaveBar key={wave.waveNumber} wave={wave} onGoalClick={handleGoalClick} />
        ))}
        <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Acknowledged</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> In progress</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Overdue</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Manager/HR view ──────────────────────────────────────────────────────────

export function SopComplianceWidgetManager() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();

  const { data, isLoading } = useQuery<ComplianceHealthResponse>({
    queryKey: ["/api/sops/compliance-health"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <Card data-testid="sop-compliance-widget-manager">
        <CardContent className="p-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const waves = data?.waves ?? [];
  if (waves.length === 0) return null;

  // Collect all lagging/overdue direct reports across all waves (SOP-specific context)
  const attentionNeeded: {
    userId: string; name: string; sopCode: string; sopTitle: string; waveName: string; dueDate: string | null;
    status: string; goalId: string | null; daysRemaining: number | null;
  }[] = [];
  for (const wave of waves) {
    for (const dr of wave.directReportBreakdown ?? []) {
      if (dr.status === "lagging" || dr.status === "overdue") {
        attentionNeeded.push({
          userId: dr.userId,
          name: dr.name,
          // Show the specific SOP code/title that caused the worst status
          sopCode: dr.worstSopCode ?? `Wave ${wave.waveNumber}`,
          sopTitle: dr.worstSopTitle ?? wave.waveName,
          waveName: wave.waveName,
          dueDate: wave.dueDate,
          status: dr.status,
          goalId: dr.goalId,
          daysRemaining: dr.daysRemaining ?? null,
        });
      }
    }
  }

  const handleGoalClick = (goalId: string) => {
    setLocation(`/admin/hr/my-team?tab=plans&goalId=${goalId}`);
  };

  return (
    <Card data-testid="sop-compliance-widget-manager">
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">SOP Compliance</CardTitle>
          {attentionNeeded.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-[10px]">
              {attentionNeeded.length} need attention
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Team SOP training progress</p>
      </CardHeader>
      <CardContent className="pt-0 pb-4 space-y-3">
        {waves.map((wave) => {
          const total = wave.total || 1;
          const ackW = (wave.onTrack / total) * 100;
          const lagW = (wave.lagging / total) * 100;
          const ovdW = (wave.overdue / total) * 100;
          const nsW = (wave.notStarted / total) * 100;

          return (
            <div key={wave.waveNumber} className="space-y-1" data-testid={`manager-wave-${wave.waveNumber}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Wave {wave.waveNumber} — {wave.waveName}</span>
                <span className="text-muted-foreground">
                  {wave.onTrack}/{wave.total} on track
                </span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-muted gap-px">
                {ackW > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${ackW}%` }} />}
                {lagW > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${lagW}%` }} />}
                {ovdW > 0 && <div className="bg-red-500 transition-all" style={{ width: `${ovdW}%` }} />}
                {nsW > 0 && <div className="bg-muted-foreground/20 transition-all" style={{ width: `${nsW}%` }} />}
              </div>
            </div>
          );
        })}

        {attentionNeeded.length > 0 && (
          <div className="mt-3 pt-2 border-t space-y-1" data-testid="sop-attention-list">
            <p className="text-xs font-medium text-muted-foreground">Needs your attention</p>
            {attentionNeeded.slice(0, 5).map((item, i) => {
              const daysLabel =
                item.daysRemaining == null ? null
                : item.daysRemaining < 0 ? `${Math.abs(item.daysRemaining)}d overdue`
                : item.daysRemaining === 0 ? "due today"
                : `${item.daysRemaining}d left`;

              return (
                <button
                  key={`${item.userId}-${item.waveName}`}
                  type="button"
                  className="w-full flex items-center gap-2 text-left hover:bg-muted/50 rounded p-1.5 transition-colors"
                  onClick={() => item.goalId && handleGoalClick(item.goalId)}
                  data-testid={`sop-attention-item-${i}`}
                >
                  <AlertTriangle className={`h-3 w-3 shrink-0 ${item.status === "overdue" ? "text-red-500" : "text-amber-500"}`} />
                  <span className="text-xs flex-1 truncate">
                    <span className="font-medium">{item.name}</span>
                    {/* Show specific SOP code/title for actionable context */}
                    <span className="text-muted-foreground ml-1">— {item.sopCode}{item.sopTitle !== item.sopCode ? `: ${item.sopTitle}` : ""}</span>
                  </span>
                  {daysLabel && (
                    <span className={`text-[10px] shrink-0 font-medium ${item.status === "overdue" ? "text-red-600" : "text-amber-600"}`}>
                      {daysLabel}
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize shrink-0 ${item.status === "overdue" ? "text-red-600 border-red-300" : "text-amber-600 border-amber-300"}`}
                  >
                    {item.status.replace("_", " ")}
                  </Badge>
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              );
            })}
            {attentionNeeded.length > 5 && (
              <p className="text-xs text-muted-foreground pl-1.5">+{attentionNeeded.length - 5} more</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> On track</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Lagging</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Overdue</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Org-wide panel (HR/Admin) ────────────────────────────────────────────────

export function SopComplianceOrgPanel() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery<ComplianceHealthResponse>({
    queryKey: ["/api/sops/compliance-health"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const orgWide = data?.orgWide;
  const waves = data?.waves ?? [];
  if (waves.length === 0 && !orgWide) return null;

  return (
    <div className="space-y-4" data-testid="sop-compliance-org-panel">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">SOP Compliance Health</h2>
      </div>

      {/* Per-wave compliance % bars */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {waves.map((wave) => {
          const total = wave.total || 1;
          const pct = Math.round((wave.onTrack / total) * 100);
          const color = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";

          return (
            <Card key={wave.waveNumber} data-testid={`org-wave-card-${wave.waveNumber}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium">Wave {wave.waveNumber} — {wave.waveName}</p>
                    {wave.dueDate && (
                      <p className="text-[10px] text-muted-foreground">Due {formatDate(wave.dueDate)}</p>
                    )}
                    <p className={`text-2xl font-bold mt-1 ${color}`}>{pct}%</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span className="text-emerald-600">{wave.onTrack} done</span>
                      {wave.lagging > 0 && <span className="text-amber-600">{wave.lagging} lagging</span>}
                      {wave.overdue > 0 && <span className="text-red-600">{wave.overdue} overdue</span>}
                      {wave.notStarted > 0 && <span>{wave.notStarted} not started</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex h-2 rounded-full overflow-hidden bg-muted gap-px">
                  {wave.onTrack > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${(wave.onTrack / total) * 100}%` }} />}
                  {wave.lagging > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(wave.lagging / total) * 100}%` }} />}
                  {wave.overdue > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(wave.overdue / total) * 100}%` }} />}
                  {wave.notStarted > 0 && <div className="bg-muted-foreground/20 transition-all" style={{ width: `${(wave.notStarted / total) * 100}%` }} />}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dept breakdown */}
      {orgWide && orgWide.byDepartment.length > 0 && (
        <Card data-testid="sop-dept-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Compliance by Department</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {orgWide.byDepartment.map((dept, i) => {
                const total = dept.total || 1;
                const pct = Math.round((dept.onTrack / total) * 100);
                const color = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
                return (
                  <div key={i} className="space-y-1" data-testid={`dept-row-${i}`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{dept.department ?? "No Department"}</span>
                      <span className={`font-semibold ${color}`}>{pct}%</span>
                    </div>
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted gap-px">
                      {dept.onTrack > 0 && <div className="bg-emerald-500" style={{ width: `${(dept.onTrack / total) * 100}%` }} />}
                      {dept.lagging > 0 && <div className="bg-amber-400" style={{ width: `${(dept.lagging / total) * 100}%` }} />}
                      {dept.overdue > 0 && <div className="bg-red-500" style={{ width: `${(dept.overdue / total) * 100}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
