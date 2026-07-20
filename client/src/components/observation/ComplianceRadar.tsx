import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ExternalLink, Lock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ComplianceData {
  scopeType: string;
  totalEmployees: number;
  sop: {
    ackedAtLeastOne: number;
    percentAcked: number;
    perWave: Array<{
      waveNumber: number;
      waveName: string;
      waveStatus: string;
      totalSops: number;
      ackedUsers: number;
      avgAckPct: number;
    }>;
  };
  training: {
    totalAssignments: number;
    completedAssignments: number;
    completedEmployees: number;
    percentEmployeesComplete: number;
  };
  policy: {
    signed: number;
    percentSigned: number;
  };
  ceipalSyncHealth: {
    lastSyncDate: string | null;
    successCount: number;
    errorCount: number;
  } | null;
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function barColor(pct: number) {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

interface SvgRingProps {
  pct: number;
  size?: number;
  strokeWidth?: number;
}

function SvgRing({ pct, size = 72, strokeWidth = 7 }: SvgRingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="14"
        fontWeight="700"
        fill={color}
      >
        {pct}%
      </text>
    </svg>
  );
}

export function ComplianceRadar() {
  const { data, isLoading, refetch } = useQuery<ComplianceData>({
    queryKey: ["/api/observation/compliance-radar", "org"],
    queryFn: async () => {
      const res = await fetch("/api/observation/compliance-radar?scope=org", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch compliance radar");
      return res.json();
    },
    staleTime: 60000,
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4" data-testid="compliance-radar">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Compliance Radar</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => refetch()}
          data-testid="button-refresh-compliance"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-18 w-18 rounded-full" style={{ width: 72, height: 72 }} />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      ) : !data ? null : (
        <div className="space-y-4">
          {/* SOP overview */}
          <div className="flex items-start gap-4">
            <SvgRing pct={data.sop.percentAcked} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">SOP Acknowledgement</span>
                <Link href="/admin/sops/compliance" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                {data.sop.ackedAtLeastOne} of {data.totalEmployees} employees acked at least 1 active SOP
              </p>

              {/* Per-wave breakdown */}
              <div className="space-y-1.5">
                {data.sop.perWave.filter((w) => w.waveStatus !== "draft").map((wave) => (
                  <div key={wave.waveNumber} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground truncate">{wave.waveName || `Wave ${wave.waveNumber}`}</span>
                      <span className="font-medium shrink-0 ml-1">{wave.avgAckPct}%</span>
                    </div>
                    <ProgressBar pct={wave.avgAckPct} color={barColor(wave.avgAckPct)} />
                  </div>
                ))}
                {data.sop.perWave.filter((w) => w.waveStatus !== "draft").length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No active waves</p>
                )}
              </div>
            </div>
          </div>

          {/* Training */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Training Completion</span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">
                  {data.training.completedEmployees}/{data.totalEmployees} employees
                </span>
                <Link href="/admin/hr/training-progress" className="text-muted-foreground hover:text-foreground ml-1">
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
            <ProgressBar pct={data.training.percentEmployeesComplete} color={barColor(data.training.percentEmployeesComplete)} />
            <p className="text-[11px] text-muted-foreground">
              {data.training.completedAssignments}/{data.training.totalAssignments} total track assignments complete
            </p>
          </div>

          {/* Policy */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Policy Sign-off</span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">
                  {data.policy.signed}/{data.totalEmployees} employees
                </span>
                <Link href="/admin/hr/people?tab=compliance" className="text-muted-foreground hover:text-foreground ml-1">
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
            <ProgressBar pct={data.policy.percentSigned} color={barColor(data.policy.percentSigned)} />
          </div>

          {/* Ceipal sync chip */}
          {data.ceipalSyncHealth !== null && (
            <div className="flex items-center gap-2 text-[11px] border border-border rounded-md px-2.5 py-1.5">
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  data.ceipalSyncHealth.errorCount === 0 ? "bg-green-500" : "bg-red-500",
                )}
              />
              <span className="text-muted-foreground">Ceipal sync:</span>
              <span className="font-medium">
                {data.ceipalSyncHealth.successCount} ok, {data.ceipalSyncHealth.errorCount} errors
              </span>
              {data.ceipalSyncHealth.lastSyncDate && (
                <span className="text-muted-foreground ml-auto hidden sm:block">
                  Last: {new Date(data.ceipalSyncHealth.lastSyncDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
          )}

          {/* Zoom placeholder */}
          <div className="flex items-center gap-3 border border-dashed border-border rounded-lg px-3 py-2.5 opacity-60">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Zoom Integration</p>
              <p className="text-[11px] text-muted-foreground">Coming soon</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
