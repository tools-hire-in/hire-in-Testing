import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { ActionRequiredFeed, type ActionItem } from "@/components/admin/governance/ActionRequiredFeed";
import GovernanceSettingsPanel from "@/components/admin/governance/GovernanceSettingsPanel";
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  BookOpen,
  Target,
  ClipboardList,
  GraduationCap,
  CalendarCheck,
  Loader2,
  TrendingDown,
  Settings2,
} from "lucide-react";

interface GovernancePulse {
  sop: {
    totalAssigned: number;
    acknowledged: number;
    overdue: number;
    waves: Array<{
      waveNumber: number;
      name: string;
      activated: boolean;
      sopCount: number;
      ackPercent: number;
    }>;
  };
  training: {
    totalActive: number;
    compliant: number;
    overdue: number;
    locked: number;
  };
  plans: {
    pip: { active: number; acknowledged: number; overdueCoaching: number; noCoachingInThreshold: number; checkInsInProgress: number };
    growth: { active: number };
    probation: { active: number; overdueCoaching: number };
    perManager: Array<{
      managerId: string;
      managerName: string;
      pipsActive: number;
      pipsStalled: number;
      growthPlansActive: number;
      probationActive: number;
      checkInsOverdue: number;
    }>;
  };
  probation: {
    dueSoon: Array<{ employeeId: string; employeeName: string; milestoneDay: number; daysUntilDue: number }>;
    missedRecently: Array<{ employeeId: string; employeeName: string; milestoneDay: number; missedDaysAgo: number; strikeCount: number }>;
  };
  goals: {
    healthSplit: { onTrack: number; atRisk: number; overdue: number; total: number };
    escalatedWithCoachingGap: Array<{ goalId: string; goalTitle: string; employeeName: string; daysSinceLastCoaching: number; daysOverdue: number }>;
  };
  checkins: {
    org: { scheduled: number; completed: number; missed: number; completionRate: number };
    perManager: Array<{ managerId: string; managerName: string; scheduled: number; completed: number; missed: number; missRate: number; consecutiveMisses: number }>;
  };
  action_items: ActionItem[];
  generatedAt: string;
}

function PulseStatCard({
  title,
  icon: Icon,
  value,
  label,
  sub,
  severity,
  onClick,
}: {
  title: string;
  icon: typeof ShieldCheck;
  value: number | string;
  label: string;
  sub?: string;
  severity?: "ok" | "warn" | "critical";
  onClick?: () => void;
}) {
  const colors = {
    ok: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20",
    warn: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20",
    critical: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20",
  };
  const valueColors = {
    ok: "text-green-700 dark:text-green-300",
    warn: "text-amber-700 dark:text-amber-300",
    critical: "text-red-700 dark:text-red-300",
  };
  const iconBg = {
    ok: "bg-green-100 dark:bg-green-900/40 text-green-600",
    warn: "bg-amber-100 dark:bg-amber-900/40 text-amber-600",
    critical: "bg-red-100 dark:bg-red-900/40 text-red-600",
  };
  const s = severity ?? "ok";

  return (
    <button
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-shadow hover:shadow-md",
        colors[s],
        onClick && "cursor-pointer",
      )}
      onClick={onClick}
      data-testid={`pulse-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("rounded-lg p-2 shrink-0", iconBg[s])}>
          <Icon className="h-4 w-4" />
        </div>
        <span className={cn("text-2xl font-bold tabular-nums", valueColors[s])}>{value}</span>
      </div>
      <div className="mt-2">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </button>
  );
}

export default function GovernanceHub() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const role = user?.role;

  const ALLOWED_ROLES = ["super_admin", "admin", "hr"];
  const canAccess = !!role && ALLOWED_ROLES.includes(role);
  const isHrReadOnly = role === "hr";

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { setLocation("/admin/login"); return; }
    if (!canAccess) { setLocation("/admin"); return; }
  }, [authLoading, isAuthenticated, canAccess, setLocation]);

  const { data: pulse, isLoading } = useQuery<GovernancePulse>({
    queryKey: ["/api/governance/pulse"],
    enabled: isAuthenticated && canAccess,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (authLoading || !isAuthenticated || !canAccess) return null;

  const actionItems: ActionItem[] = pulse?.action_items ?? [];
  const criticalCount = actionItems.filter((i) => i.severity === "critical").length;
  const warningCount = actionItems.filter((i) => i.severity === "warning").length;

  const sopAckPct = pulse
    ? pulse.sop.totalAssigned > 0
      ? Math.round((pulse.sop.acknowledged / pulse.sop.totalAssigned) * 100)
      : 100
    : 0;

  const trainingCompliantPct = pulse
    ? pulse.training.totalActive > 0
      ? Math.round((pulse.training.compliant / pulse.training.totalActive) * 100)
      : 100
    : 0;

  const checkinRate = pulse?.checkins.org.completionRate ?? 100;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-governance-hub-title">
                Governance Hub
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Org-wide compliance health across SOPs, training, PIPs, probation, goals, and check-ins.
              </p>
            </div>
          </div>
          {(criticalCount > 0 || warningCount > 0) && (
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <Badge className="bg-red-500 text-white hover:bg-red-500 gap-1" data-testid="badge-critical-count">
                  <AlertTriangle className="h-3 w-3" />
                  {criticalCount} critical
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-amber-500 text-white hover:bg-amber-500" data-testid="badge-warning-count">
                  {warningCount} warning{warningCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {pulse && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" data-testid="pulse-cards">
              <PulseStatCard
                title="SOP Compliance"
                icon={BookOpen}
                value={`${sopAckPct}%`}
                label={`${pulse.sop.acknowledged}/${pulse.sop.totalAssigned} acknowledged`}
                sub={pulse.sop.overdue > 0 ? `${pulse.sop.overdue} overdue` : undefined}
                severity={pulse.sop.overdue > 10 ? "critical" : pulse.sop.overdue > 0 ? "warn" : "ok"}
                onClick={() => setLocation("#action-required-feed")}
              />
              <PulseStatCard
                title="Training"
                icon={GraduationCap}
                value={`${trainingCompliantPct}%`}
                label={`${pulse.training.compliant}/${pulse.training.totalActive} compliant`}
                sub={pulse.training.locked > 0 ? `${pulse.training.locked} locked` : undefined}
                severity={pulse.training.locked > 0 ? "critical" : pulse.training.overdue > 0 ? "warn" : "ok"}
                onClick={() => setLocation("#action-required-feed")}
              />
              <PulseStatCard
                title="Active PIPs"
                icon={ClipboardList}
                value={pulse.plans.pip.active}
                label={`${pulse.plans.pip.overdueCoaching} coaching overdue`}
                sub={`${pulse.plans.pip.noCoachingInThreshold} no recent coaching`}
                severity={pulse.plans.pip.overdueCoaching > 0 ? "critical" : pulse.plans.pip.noCoachingInThreshold > 0 ? "warn" : "ok"}
                onClick={() => setLocation("#action-required-feed")}
              />
              <PulseStatCard
                title="Probation"
                icon={Users}
                value={pulse.plans.probation.active}
                label={`${pulse.probation.missedRecently.length} milestones missed`}
                sub={pulse.probation.dueSoon.length > 0 ? `${pulse.probation.dueSoon.length} due soon` : undefined}
                severity={pulse.probation.missedRecently.length > 0 ? "warn" : "ok"}
                onClick={() => setLocation("#action-required-feed")}
              />
              <PulseStatCard
                title="Goals"
                icon={Target}
                value={pulse.goals.healthSplit.total}
                label={`${pulse.goals.healthSplit.onTrack} on track`}
                sub={pulse.goals.healthSplit.overdue > 0 ? `${pulse.goals.healthSplit.overdue} overdue` : undefined}
                severity={pulse.goals.healthSplit.overdue > 0 ? "warn" : "ok"}
                onClick={() => setLocation("#action-required-feed")}
              />
              <PulseStatCard
                title="Check-ins"
                icon={CalendarCheck}
                value={`${checkinRate}%`}
                label={`${pulse.checkins.org.completed}/${pulse.checkins.org.scheduled} completed`}
                sub={pulse.checkins.org.missed > 0 ? `${pulse.checkins.org.missed} missed` : undefined}
                severity={checkinRate < 50 ? "critical" : checkinRate < 75 ? "warn" : "ok"}
                onClick={() => setLocation("#action-required-feed")}
              />
            </div>

            {pulse.plans.perManager.length > 0 && (
              <Card data-testid="manager-breakdown-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    Manager Breakdown — Plans & Check-ins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="manager-breakdown-table">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="text-left pb-2 font-medium">Manager</th>
                          <th className="text-center pb-2 font-medium">PIPs</th>
                          <th className="text-center pb-2 font-medium">Stalled</th>
                          <th className="text-center pb-2 font-medium">Growth</th>
                          <th className="text-center pb-2 font-medium">Probation</th>
                          <th className="text-center pb-2 font-medium">Check-ins Overdue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {pulse.plans.perManager.map((m) => (
                          <tr key={m.managerId} className="hover:bg-muted/30" data-testid={`mgr-row-${m.managerId}`}>
                            <td className="py-2 font-medium">{m.managerName}</td>
                            <td className="text-center py-2">{m.pipsActive}</td>
                            <td className="text-center py-2">
                              {m.pipsStalled > 0 ? (
                                <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-semibold">{m.pipsStalled}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="text-center py-2">{m.growthPlansActive}</td>
                            <td className="text-center py-2">{m.probationActive}</td>
                            <td className="text-center py-2">
                              {m.checkInsOverdue > 0 ? (
                                <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">{m.checkInsOverdue}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3" id="action-required-feed">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h2 className="text-lg font-semibold" data-testid="text-action-required-heading">
                  Action Required
                </h2>
                {actionItems.length > 0 && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-action-count">
                    {actionItems.length}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground -mt-1">
                Ranked by urgency. Use Nudge to notify the responsible manager, or Escalate to create an HR request.
              </p>
              <ActionRequiredFeed
                items={actionItems}
                isLoading={false}
                isHrReadOnly={isHrReadOnly}
              />
            </div>
          </>
        )}

        {/* Governance enforcement settings — configure cadences, thresholds, and escalation rules */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Enforcement Settings</h2>
          </div>
          <p className="text-sm text-muted-foreground -mt-1">
            Configure governance enforcement across SOPs, PIPs, growth plans, and probation milestones.
          </p>
          <GovernanceSettingsPanel />
        </div>
      </div>
    </AdminLayout>
  );
}
