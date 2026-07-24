import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useNewLook } from "@/hooks/use-new-look";
import { cn } from "@/lib/utils";
import { ShieldCheck, AlertTriangle, ChevronRight, ChevronDown, ChevronUp, ExternalLink, Users } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DirectReport {
  userId: string;
  name: string;
  status: "on_track" | "lagging" | "overdue" | "not_started";
  goalId: string | null;
  daysRemaining: number | null;
  worstSopCode: string | null;
  worstSopTitle: string | null;
}

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
  directReportBreakdown?: DirectReport[];
}

interface DeptRow {
  department: string | null;
  onTrack: number;
  lagging: number;
  overdue: number;
  total: number;
  employees?: {
    userId: string;
    name: string;
    status: "on_track" | "lagging" | "overdue" | "not_started";
    daysRemaining: number | null;
  }[];
}

interface WaveDeptBreakdown {
  waveNumber: number;
  waveName: string;
  depts: DeptRow[];
}

interface ComplianceHealthResponse {
  waves: WaveHealth[];
  viewerRole: string;
  hasActiveSopGoals?: boolean;
  orgWide?: {
    byDepartment: DeptRow[];
    byWaveDept?: WaveDeptBreakdown[];
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

function statusColor(s: string): string {
  switch (s) {
    case "on_track": return "text-emerald-600";
    case "lagging": return "text-amber-600";
    case "overdue": return "text-red-600";
    default: return "text-muted-foreground";
  }
}

// Stacked progress bar (reused across all scopes)
function StackedBar({
  onTrack, lagging, overdue, notStarted, total, height = "h-2", primaryFill,
}: {
  onTrack: number; lagging: number; overdue: number; notStarted: number; total: number;
  height?: string; primaryFill: string;
}) {
  const t = total || 1;
  return (
    <div className={cn("flex rounded-full overflow-hidden bg-muted gap-px", height)}>
      {onTrack > 0 && <div className={cn("transition-all", primaryFill)} style={{ width: `${(onTrack / t) * 100}%` }} title={`On track: ${onTrack}`} />}
      {lagging > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(lagging / t) * 100}%` }} title={`Lagging: ${lagging}`} />}
      {overdue > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(overdue / t) * 100}%` }} title={`Overdue: ${overdue}`} />}
      {notStarted > 0 && <div className="bg-muted-foreground/20 transition-all" style={{ width: `${(notStarted / t) * 100}%` }} title={`Not started: ${notStarted}`} />}
    </div>
  );
}

// ─── Employee scope ───────────────────────────────────────────────────────────

function EmployeeView({ data, isV2, primaryFill }: { data: ComplianceHealthResponse; isV2: boolean; primaryFill: string }) {
  const [, setLocation] = useLocation();

  if (!data.hasActiveSopGoals) return null;

  const waves = data.waves;
  const hasIssues = waves.some((w) => w.overdue > 0 || w.lagging > 0);

  return (
    <Card
      className={cn(hasIssues ? "border-amber-200 dark:border-amber-800" : "", isV2 && "v2-surface")}
      data-testid="sop-compliance-widget-employee"
    >
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className={cn("h-4 w-4", isV2 ? "text-[#F47C20]" : "text-primary")} />
          <CardTitle className={cn("text-sm font-semibold", isV2 && "text-[#1F3A6E]")}>
            SOP Compliance Health
          </CardTitle>
          {hasIssues && (
            <Badge variant="outline" className="ml-auto text-amber-600 border-amber-400 text-[10px]">
              Action needed
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Your active SOP training goals</p>
      </CardHeader>
      <CardContent className="pt-0 pb-4 space-y-2">
        {waves.map((wave) => {
          const overallStatus: "green" | "amber" | "red" = wave.overdue > 0 ? "red" : wave.lagging > 0 ? "amber" : "green";
          const statusCls = {
            green: "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20",
            amber: "border-amber-300 bg-amber-50 dark:bg-amber-950/20",
            red: "border-red-300 bg-red-50 dark:bg-red-950/20",
          }[overallStatus];

          return (
            <div
              key={wave.waveNumber}
              className={cn("rounded border p-2.5 cursor-pointer hover:shadow-sm transition-shadow", statusCls)}
              onClick={() => setLocation("/admin/hr?tab=goals&filter=sop_compliance")}
              data-testid={`sop-wave-bar-${wave.waveNumber}`}
            >
              <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                <span className={cn("text-xs font-medium truncate", isV2 && "text-[#1F3A6E]")}>
                  Wave {wave.waveNumber} — {wave.waveName}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                  {wave.dueDate && <span>Due {formatDate(wave.dueDate)}</span>}
                  {wave.myGoalId && (
                    <span className="inline-flex items-center gap-0.5 text-primary">
                      Goal <ExternalLink className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
              </div>
              <StackedBar
                onTrack={wave.onTrack} lagging={wave.lagging} overdue={wave.overdue}
                notStarted={wave.notStarted} total={wave.total} height="h-3" primaryFill={primaryFill}
              />
              {wave.total > 1 && (
                <div className="mt-1 flex gap-2.5 text-[10px] text-muted-foreground flex-wrap">
                  {wave.onTrack > 0 && <span className={isV2 ? "text-[#F47C20] font-medium" : "text-emerald-600"}>✓ {wave.onTrack} done</span>}
                  {wave.lagging > 0 && <span className="text-amber-600">⟳ {wave.lagging} lagging</span>}
                  {wave.overdue > 0 && <span className="text-red-600">⚠ {wave.overdue} overdue</span>}
                  {wave.notStarted > 0 && <span>{wave.notStarted} not started</span>}
                </div>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full inline-block", isV2 ? "bg-[#F47C20]" : "bg-emerald-500")} /> Acknowledged
          </span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> In progress</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Overdue</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Manager scope ────────────────────────────────────────────────────────────

function ManagerView({ data, isV2, primaryFill }: { data: ComplianceHealthResponse; isV2: boolean; primaryFill: string }) {
  const [, setLocation] = useLocation();
  const [showAll, setShowAll] = useState(false);

  const waves = data.waves;
  if (waves.length === 0) return null;

  const attentionNeeded: {
    userId: string; name: string; sopCode: string; sopTitle: string; waveName: string;
    status: string; daysRemaining: number | null;
  }[] = [];

  for (const wave of waves) {
    for (const dr of wave.directReportBreakdown ?? []) {
      if (dr.status === "lagging" || dr.status === "overdue") {
        attentionNeeded.push({
          userId: dr.userId,
          name: dr.name,
          sopCode: dr.worstSopCode ?? `Wave ${wave.waveNumber}`,
          sopTitle: dr.worstSopTitle ?? wave.waveName,
          waveName: wave.waveName,
          status: dr.status,
          daysRemaining: dr.daysRemaining ?? null,
        });
      }
    }
  }

  const visible = showAll ? attentionNeeded : attentionNeeded.slice(0, 5);

  return (
    <Card data-testid="sop-compliance-widget-manager" className={cn(isV2 && "v2-surface")}>
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className={cn("h-4 w-4", isV2 ? "text-[#F47C20]" : "text-primary")} />
          <CardTitle className={cn("text-sm font-semibold", isV2 && "text-[#1F3A6E]")}>
            SOP Compliance — Your Team
          </CardTitle>
          {attentionNeeded.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-[10px]">
              {attentionNeeded.length} need attention
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Team SOP training progress</p>
      </CardHeader>
      <CardContent className="pt-0 pb-4 space-y-3">
        {waves.map((wave) => (
          <div key={wave.waveNumber} className="space-y-1" data-testid={`manager-wave-${wave.waveNumber}`}>
            <div className="flex items-center justify-between text-xs">
              <span className={cn("font-medium", isV2 && "text-[#1F3A6E]")}>
                Wave {wave.waveNumber} — {wave.waveName}
              </span>
              <span className="text-muted-foreground">{wave.onTrack}/{wave.total} on track</span>
            </div>
            <StackedBar
              onTrack={wave.onTrack} lagging={wave.lagging} overdue={wave.overdue}
              notStarted={wave.notStarted} total={wave.total} primaryFill={primaryFill}
            />
          </div>
        ))}

        {attentionNeeded.length > 0 && (
          <div className="mt-3 pt-2 border-t space-y-1" data-testid="sop-attention-list">
            <p className={cn("text-xs font-medium", isV2 ? "text-[#1F3A6E]/70" : "text-muted-foreground")}>
              Needs your attention
            </p>
            {visible.map((item, i) => {
              const daysLabel =
                item.daysRemaining == null ? null
                : item.daysRemaining < 0 ? `${Math.abs(item.daysRemaining)}d overdue`
                : item.daysRemaining === 0 ? "due today"
                : `${item.daysRemaining}d left`;

              return (
                <button
                  key={`${item.userId}-${item.waveName}-${i}`}
                  type="button"
                  className="w-full flex items-center gap-2 text-left hover:bg-muted/50 rounded p-1.5 transition-colors"
                  onClick={() => setLocation(`/admin/hr/my-team?employee=${item.userId}`)}
                  data-testid={`sop-attention-item-${i}`}
                >
                  <AlertTriangle className={cn("h-3 w-3 shrink-0", item.status === "overdue" ? "text-red-500" : "text-amber-500")} />
                  <span className="text-xs flex-1 truncate">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground ml-1">
                      — {item.sopCode}{item.sopTitle !== item.sopCode ? `: ${item.sopTitle}` : ""}
                    </span>
                  </span>
                  {daysLabel && (
                    <span className={cn("text-[10px] shrink-0 font-medium", item.status === "overdue" ? "text-red-600" : "text-amber-600")}>
                      {daysLabel}
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] capitalize shrink-0", item.status === "overdue" ? "text-red-600 border-red-300" : "text-amber-600 border-amber-300")}
                  >
                    {item.status.replace("_", " ")}
                  </Badge>
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              );
            })}

            {attentionNeeded.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground"
                onClick={() => setShowAll((s) => !s)}
                data-testid="sop-attention-show-all"
              >
                {showAll ? (
                  <><ChevronUp className="h-3 w-3 mr-1" /> Show less</>
                ) : (
                  <><ChevronDown className="h-3 w-3 mr-1" /> Show all {attentionNeeded.length}</>
                )}
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full inline-block", isV2 ? "bg-[#F47C20]" : "bg-emerald-500")} /> On track
          </span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Lagging</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Overdue</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Org scope ────────────────────────────────────────────────────────────────

function OrgDeptDrillRow({
  dept, waveNumber, isV2,
}: {
  dept: DeptRow;
  waveNumber: number;
  isV2: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = dept.total || 1;
  const pct = Math.round((dept.onTrack / total) * 100);
  const color = pct >= 80 ? (isV2 ? "text-[#F47C20]" : "text-emerald-600") : pct >= 50 ? "text-amber-600" : "text-red-600";
  const employees = dept.employees ?? [];

  return (
    <div data-testid={`org-dept-row-wave-${waveNumber}-${dept.department ?? "none"}`}>
      <button
        type="button"
        className="w-full flex items-center gap-2 py-1.5 px-2 text-xs hover:bg-muted/40 rounded transition-colors"
        onClick={() => employees.length > 0 && setExpanded((e) => !e)}
      >
        <span className="flex-1 text-left font-medium truncate">{dept.department ?? "No Department"}</span>
        <span className={cn("font-semibold shrink-0 w-8 text-right", color)}>{pct}%</span>
        <span className="text-muted-foreground shrink-0 text-[10px] w-16 text-right">
          {dept.onTrack}/{dept.total}
        </span>
        {employees.length > 0 ? (
          expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : <span className="w-3" />}
      </button>

      {expanded && employees.length > 0 && (
        <div className="ml-4 mb-1 border rounded overflow-hidden" data-testid={`org-dept-employees-wave-${waveNumber}`}>
          <table className="w-full text-[10px]">
            <tbody className="divide-y">
              {employees.map((emp) => (
                <tr key={emp.userId} className="hover:bg-muted/20" data-testid={`org-emp-row-${emp.userId}`}>
                  <td className="px-2.5 py-1.5 font-medium">{emp.name}</td>
                  <td className={cn("px-2.5 py-1.5 capitalize font-semibold text-right", statusColor(emp.status))}>
                    {emp.status.replace("_", " ")}
                  </td>
                  <td className="px-2.5 py-1.5 text-muted-foreground text-right">
                    {emp.daysRemaining == null ? "—"
                      : emp.daysRemaining < 0 ? `${Math.abs(emp.daysRemaining)}d overdue`
                      : emp.daysRemaining === 0 ? "due today"
                      : `${emp.daysRemaining}d left`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrgView({ data, isV2, primaryFill }: { data: ComplianceHealthResponse; isV2: boolean; primaryFill: string }) {
  const waves = data.waves;
  const orgWide = data.orgWide;

  if (waves.length === 0 && !orgWide) return null;

  // Prefer detailed byWaveDept structure for matrix; fall back to simple byDepartment list
  const byWaveDept = orgWide?.byWaveDept ?? null;
  const byDept = orgWide?.byDepartment ?? [];

  return (
    <div className={cn("space-y-4", isV2 && "v2-surface")} data-testid="sop-compliance-widget-org">
      <div className="flex items-center gap-2">
        <ShieldCheck className={cn("h-5 w-5", isV2 ? "text-[#F47C20]" : "text-primary")} />
        <h2 className={cn("text-lg font-semibold", isV2 && "text-[#1F3A6E]")}>SOP Compliance Health</h2>
      </div>

      {/* Wave summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {waves.map((wave) => {
          const total = wave.total || 1;
          const pct = Math.round((wave.onTrack / total) * 100);
          const color = pct >= 80 ? (isV2 ? "text-[#F47C20]" : "text-emerald-600") : pct >= 50 ? "text-amber-600" : "text-red-600";
          return (
            <Card key={wave.waveNumber} data-testid={`org-wave-card-${wave.waveNumber}`}>
              <CardContent className="p-4">
                <p className={cn("text-xs font-medium", isV2 && "text-[#1F3A6E]")}>
                  Wave {wave.waveNumber} — {wave.waveName}
                </p>
                {wave.dueDate && <p className="text-[10px] text-muted-foreground">Due {formatDate(wave.dueDate)}</p>}
                <p className={cn("text-2xl font-bold mt-1", color)}>{pct}%</p>
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span className={isV2 ? "text-[#F47C20] font-medium" : "text-emerald-600"}>{wave.onTrack} done</span>
                  {wave.lagging > 0 && <span className="text-amber-600">{wave.lagging} lagging</span>}
                  {wave.overdue > 0 && <span className="text-red-600">{wave.overdue} overdue</span>}
                  {wave.notStarted > 0 && <span>{wave.notStarted} not started</span>}
                </div>
                <div className="mt-2">
                  <StackedBar
                    onTrack={wave.onTrack} lagging={wave.lagging} overdue={wave.overdue}
                    notStarted={wave.notStarted} total={wave.total} primaryFill={primaryFill}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Department drilldown — per-wave breakdown preferred */}
      {byWaveDept && byWaveDept.length > 0 ? (
        <div className="space-y-4" data-testid="sop-wave-dept-matrix">
          {byWaveDept.map((wdEntry) => (
            <Card key={wdEntry.waveNumber} data-testid={`org-wave-dept-${wdEntry.waveNumber}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className={cn("text-sm", isV2 && "text-[#1F3A6E]")}>
                    Wave {wdEntry.waveNumber} — {wdEntry.waveName}: By Department
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y">
                  {wdEntry.depts.map((dept, di) => (
                    <OrgDeptDrillRow
                      key={di}
                      dept={dept}
                      waveNumber={wdEntry.waveNumber}
                      isV2={isV2}
                    />
                  ))}
                  {wdEntry.depts.length === 0 && (
                    <p className="text-xs text-muted-foreground py-3 text-center">No department data.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : byDept.length > 0 ? (
        /* Fallback: simple department percentage list */
        <Card data-testid="sop-dept-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className={cn("text-sm", isV2 && "text-[#1F3A6E]")}>Compliance by Department</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {byDept.map((dept, i) => {
                const total = dept.total || 1;
                const pct = Math.round((dept.onTrack / total) * 100);
                const color = pct >= 80 ? (isV2 ? "text-[#F47C20]" : "text-emerald-600") : pct >= 50 ? "text-amber-600" : "text-red-600";
                return (
                  <div key={i} className="space-y-1" data-testid={`dept-row-${i}`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn("font-medium", isV2 && "text-[#1F3A6E]")}>{dept.department ?? "No Department"}</span>
                      <span className={cn("font-semibold", color)}>{pct}%</span>
                    </div>
                    <StackedBar
                      onTrack={dept.onTrack} lagging={dept.lagging} overdue={dept.overdue}
                      notStarted={0} total={dept.total} height="h-1.5" primaryFill={primaryFill}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ─── Unified SopComplianceWidget ──────────────────────────────────────────────

export function SopComplianceWidget({ scope }: { scope: "employee" | "manager" | "org" }) {
  const { isAuthenticated } = useAuth();
  const { enabled: isV2 } = useNewLook();

  const { data, isLoading } = useQuery<ComplianceHealthResponse>({
    queryKey: ["/api/sops/compliance-health"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const primaryFill = isV2 ? "bg-[#F47C20]" : "bg-emerald-500";

  if (isLoading) {
    const testId =
      scope === "employee" ? "sop-compliance-widget-employee"
      : scope === "manager" ? "sop-compliance-widget-manager"
      : "sop-compliance-widget-org";
    return (
      <div data-testid={testId} className={cn(isV2 && "v2-surface")}>
        <Skeleton className={scope === "org" ? "h-48 w-full" : "h-24 w-full"} />
      </div>
    );
  }

  if (!data) return null;

  if (scope === "employee") {
    return <EmployeeView data={data} isV2={isV2} primaryFill={primaryFill} />;
  }
  if (scope === "manager") {
    return <ManagerView data={data} isV2={isV2} primaryFill={primaryFill} />;
  }
  return <OrgView data={data} isV2={isV2} primaryFill={primaryFill} />;
}

// ─── Named exports for GovernanceHub (backward-compat wrapper) ────────────────
// GovernanceHub imports SopComplianceOrgPanel by name — keep it pointing at the unified widget.
export function SopComplianceOrgPanel() {
  return <SopComplianceWidget scope="org" />;
}
