import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { WaveImpactDrawer } from "@/components/admin/governance/WaveImpactDrawer";
import {
  ShieldCheck,
  BookOpen,
  Users,
  AlertTriangle,
  Target,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Loader2,
  Layers,
  Play,
  Zap,
  CheckCircle2,
  Lock,
  RefreshCw,
} from "lucide-react";
import { SopComplianceOrgPanel } from "@/components/admin/SopComplianceWidget";
import { useNewLook } from "@/hooks/use-new-look";
import type { GovernancePulse, ManagerPlanBreakdown, ManagerCheckinCompliance } from "@/types/governance";

// ── Pulse type imports (inline since we can't import from server) ──────────────
interface PulseCard {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
}

// Ring progress SVG
function RingProgress({ percent, colorClass = "text-primary" }: { percent: number; colorClass?: string }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(percent, 100) / 100);
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
      <circle
        cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        className={colorClass}
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="33" textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor" className={colorClass}>
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

// ── Stat Cards ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-48" />
      </CardContent>
    </Card>
  );
}

// Card 1: SOP Compliance
function SopComplianceCard({ pulse }: { pulse: GovernancePulse }) {
  const { totalAssigned, acknowledged, overdue } = pulse.sop;
  const pct = totalAssigned > 0 ? (acknowledged / totalAssigned) * 100 : 0;
  const color = pct < 60 ? "text-red-500" : pct < 80 ? "text-amber-500" : "text-emerald-500";
  return (
    <Card data-testid="card-sop-compliance">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> SOP Compliance
            </div>
            <div className="mt-2 text-2xl font-bold">
              {acknowledged} / {totalAssigned}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">employees acknowledged active SOPs</p>
            {overdue > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" /> {overdue} overdue
              </div>
            )}
          </div>
          <RingProgress percent={pct} colorClass={color} />
        </div>
      </CardContent>
    </Card>
  );
}

// Card 2: Training Compliance
function TrainingComplianceCard({ pulse }: { pulse: GovernancePulse }) {
  const { totalActive, compliant, locked } = pulse.training;
  const pct = totalActive > 0 ? (compliant / totalActive) * 100 : 0;
  const color = pct < 60 ? "text-red-500" : pct < 80 ? "text-amber-500" : "text-emerald-500";
  return (
    <Card data-testid="card-training-compliance">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <BookOpen className="h-4 w-4" /> Training Compliance
            </div>
            <div className="mt-2 text-2xl font-bold">{Math.round(pct)}%</div>
            <p className="mt-1 text-xs text-muted-foreground">org compliant</p>
            {locked > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                <Lock className="h-3 w-3" /> {locked} employees locked
              </div>
            )}
          </div>
          <RingProgress percent={pct} colorClass={color} />
        </div>
      </CardContent>
    </Card>
  );
}

// Card 3: Active Plans (expandable — manager compliance table)
function ActivePlansCard({ pulse }: { pulse: GovernancePulse }) {
  const [expanded, setExpanded] = useState(false);
  const { pip, growth, probation, perManager } = pulse.plans;
  const total = pip.active + growth.active + probation.active;

  return (
    <Card className="cursor-pointer" data-testid="card-active-plans">
      <CardContent className="p-5" onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" /> Active Plans
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="mt-2 text-2xl font-bold">{total}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pip.active > 0 && <Badge variant="destructive" className="text-[10px]">PIP: {pip.active}</Badge>}
          {growth.active > 0 && <Badge variant="secondary" className="text-[10px]">Growth: {growth.active}</Badge>}
          {probation.active > 0 && <Badge variant="outline" className="text-[10px]">Probation: {probation.active}</Badge>}
          {total === 0 && <span className="text-xs text-muted-foreground">No active plans</span>}
        </div>
      </CardContent>
      {expanded && perManager.length > 0 && (
        <div className="border-t px-5 pb-4" data-testid="table-manager-plans">
          <p className="text-xs font-medium text-muted-foreground py-2">Manager Compliance</p>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 pr-3 font-medium">Manager</th>
                  <th className="text-right py-1.5 px-2 font-medium">PIPs</th>
                  <th className="text-right py-1.5 px-2 font-medium">Stalled</th>
                  <th className="text-right py-1.5 px-2 font-medium">Growth</th>
                  <th className="text-right py-1.5 pl-2 font-medium">Check-ins Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {perManager.map((m: ManagerPlanBreakdown) => (
                  <tr key={m.managerId} data-testid={`row-mgr-plan-${m.managerId}`}>
                    <td className="py-1.5 pr-3 font-medium">{m.managerName}</td>
                    <td className="text-right py-1.5 px-2">{m.pipsActive}</td>
                    <td className={`text-right py-1.5 px-2 font-semibold ${m.pipsStalled >= 3 ? "text-red-600" : m.pipsStalled >= 1 ? "text-amber-600" : ""}`}>
                      {m.pipsStalled}
                    </td>
                    <td className="text-right py-1.5 px-2">{m.growthPlansActive}</td>
                    <td className={`text-right py-1.5 pl-2 ${m.checkInsOverdue > 0 ? "text-amber-600" : ""}`}>{m.checkInsOverdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {expanded && perManager.length === 0 && (
        <div className="border-t px-5 pb-4 pt-3 text-xs text-muted-foreground">No manager data available.</div>
      )}
    </Card>
  );
}

// Card 4: Probation Alerts
function ProbationAlertsCard({ pulse }: { pulse: GovernancePulse }) {
  const { dueSoon, missedRecently } = pulse.probation;
  return (
    <Card data-testid="card-probation-alerts">
      <CardContent className="p-5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <AlertTriangle className="h-4 w-4" /> Probation Alerts
        </div>
        <div className="mt-2 text-2xl font-bold">{dueSoon.length + missedRecently.length}</div>
        <div className="mt-2 space-y-1 text-xs">
          {dueSoon.length > 0 && (
            <div className="flex items-center gap-1.5 text-amber-600">
              <span className="font-semibold">{dueSoon.length}</span> milestones due this week
            </div>
          )}
          {missedRecently.length > 0 && (
            <div className="flex items-center gap-1.5 text-red-600">
              <span className="font-semibold">{missedRecently.length}</span> missed this month
            </div>
          )}
          {dueSoon.length === 0 && missedRecently.length === 0 && (
            <span className="text-muted-foreground">No alerts</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Card 5: Goal Health
function GoalHealthCard({ pulse }: { pulse: GovernancePulse }) {
  const { onTrack, atRisk, overdue, total } = pulse.goals.healthSplit;
  const onTrackW = total > 0 ? (onTrack / total) * 100 : 0;
  const atRiskW = total > 0 ? (atRisk / total) * 100 : 0;
  const overdueW = total > 0 ? (overdue / total) * 100 : 0;
  return (
    <Card data-testid="card-goal-health">
      <CardContent className="p-5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Target className="h-4 w-4" /> Goal Health
        </div>
        <div className="mt-2 text-2xl font-bold">{total}</div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="text-emerald-600 font-medium">On Track: {onTrack}</span>
          <span className="text-amber-600 font-medium">At Risk: {atRisk}</span>
          <span className={`font-semibold ${overdue > 0 ? "text-red-600" : "text-muted-foreground"}`}>
            Overdue: {overdue}
          </span>
        </div>
        {total > 0 && (
          <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-muted gap-0.5" data-testid="goal-health-bar">
            {onTrackW > 0 && (
              <div className="bg-emerald-500 rounded-full transition-all" style={{ width: `${onTrackW}%` }} title={`On Track: ${onTrack}`} />
            )}
            {atRiskW > 0 && (
              <div className="bg-amber-500 rounded-full transition-all" style={{ width: `${atRiskW}%` }} title={`At Risk: ${atRisk}`} />
            )}
            {overdueW > 0 && (
              <div className="bg-red-500 rounded-full transition-all" style={{ width: `${overdueW}%` }} title={`Overdue: ${overdue}`} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Card 6: Check-in Compliance (expandable — manager miss rate table)
function CheckinComplianceCard({ pulse }: { pulse: GovernancePulse }) {
  const [expanded, setExpanded] = useState(false);
  const { org, perManager } = pulse.checkins;
  const pct = Math.round(org.completionRate);
  const color = pct < 60 ? "text-red-500" : pct < 80 ? "text-amber-500" : "text-emerald-500";

  return (
    <Card className="cursor-pointer" data-testid="card-checkin-compliance">
      <CardContent className="p-5" onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <MessageSquare className="h-4 w-4" /> Check-in Compliance
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="flex items-start justify-between mt-2 gap-2">
          <div>
            <div className="text-2xl font-bold">{pct}%</div>
            <p className="mt-1 text-xs text-muted-foreground">check-ins completed this month</p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>Scheduled: {org.scheduled}</span>
              <span>Completed: {org.completed}</span>
              <span className={org.missed > 0 ? "text-red-600" : ""}>Missed: {org.missed}</span>
            </div>
          </div>
          <RingProgress percent={pct} colorClass={color} />
        </div>
      </CardContent>
      {expanded && perManager.length > 0 && (
        <div className="border-t px-5 pb-4" data-testid="table-manager-checkins">
          <p className="text-xs font-medium text-muted-foreground py-2">Manager Miss Rate</p>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 pr-3 font-medium">Manager</th>
                  <th className="text-right py-1.5 px-2 font-medium">Sched.</th>
                  <th className="text-right py-1.5 px-2 font-medium">Done</th>
                  <th className="text-right py-1.5 px-2 font-medium">Missed</th>
                  <th className="text-right py-1.5 pl-2 font-medium">Miss %</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...perManager]
                  .sort((a: ManagerCheckinCompliance, b: ManagerCheckinCompliance) => b.missRate - a.missRate)
                  .map((m: ManagerCheckinCompliance) => {
                    const missRatePct = Math.round(m.missRate);
                    const isRed = m.consecutiveMisses >= 5;
                    const isAmber = !isRed && missRatePct > 40;
                    return (
                      <tr
                        key={m.managerId}
                        className={isRed ? "bg-red-50 dark:bg-red-950/30" : isAmber ? "bg-amber-50 dark:bg-amber-950/30" : ""}
                        data-testid={`row-mgr-checkin-${m.managerId}`}
                      >
                        <td className="py-1.5 pr-3 font-medium">{m.managerName}</td>
                        <td className="text-right py-1.5 px-2">{m.scheduled}</td>
                        <td className="text-right py-1.5 px-2">{m.completed}</td>
                        <td className={`text-right py-1.5 px-2 ${m.missed > 0 ? "text-red-600 font-semibold" : ""}`}>{m.missed}</td>
                        <td className={`text-right py-1.5 pl-2 font-semibold ${isRed ? "text-red-600" : isAmber ? "text-amber-600" : ""}`}>
                          {missRatePct}%
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {expanded && perManager.length === 0 && (
        <div className="border-t px-5 pb-4 pt-3 text-xs text-muted-foreground">No manager data available.</div>
      )}
    </Card>
  );
}

// ── SOP Rollout Panel ─────────────────────────────────────────────────────────

interface WaveSopRow {
  sopMasterId: string;
  code: string;
  title: string | null;
  category: string | null;
  lifecycleStatus: string | null;
  operational: boolean;
  operationalAt: string | null;
  ackPct?: number;
}

interface WaveView {
  waveNumber: number;
  name: string;
  description: string | null;
  audience: string | null;
  status: "planned" | "active" | "completed";
  enforcement: "soft" | "measured" | "full";
  activatedAt: string | null;
  sops: WaveSopRow[];
  operationalCount: number;
  totalCount: number;
}

interface WavesResponse {
  waves: WaveView[];
  cadence: { windowCount: number; max: number };
}

const ENFORCEMENT_LABEL: Record<string, string> = {
  soft: "Soft",
  measured: "Measured",
  full: "Full",
};

const ENFORCEMENT_COLOR: Record<string, string> = {
  soft: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  measured: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  full: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_DOT: Record<string, string> = {
  planned: "bg-muted-foreground",
  active: "bg-emerald-500",
  completed: "bg-blue-500",
};

function WaveCard({
  wave,
  cadenceBlocked,
  readonly,
  onPreview,
}: {
  wave: WaveView;
  cadenceBlocked: boolean;
  readonly: boolean;
  onPreview: (waveNumber: number, highlightCode?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const activateMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sops/waves/${wave.waveNumber}/activate`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: `Wave ${wave.waveNumber} activated` });
      queryClient.invalidateQueries({ queryKey: ["/api/sops/waves"] });
    },
    onError: (e: any) => toast({ title: "Activation failed", description: e?.message, variant: "destructive" }),
  });

  const reassignMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sops/rollout/waves/${wave.waveNumber}/reassign`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Assignment failed");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      const parts: string[] = [];
      if (data.progressRowsCreated > 0) parts.push(`${data.progressRowsCreated} progress rows created`);
      if (data.trainingsAssigned > 0) parts.push(`${data.trainingsAssigned} training(s) assigned`);
      if (data.tracksPublished > 0) parts.push(`${data.tracksPublished} track(s) published`);
      toast({
        title: "Assignment re-run complete",
        description: parts.length > 0 ? parts.join(", ") : "No new assignments needed — everything is up to date.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sops/waves"] });
    },
    onError: (e: any) => toast({ title: "Re-run failed", description: e?.message, variant: "destructive" }),
  });

  const activateSopMut = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", `/api/sops/waves/${wave.waveNumber}/sops/${code}/activate`, {});
      return res.json();
    },
    onSuccess: (_, code) => {
      toast({ title: `${code} is now operational` });
      queryClient.invalidateQueries({ queryKey: ["/api/sops/waves"] });
    },
    onError: (e: any) => toast({ title: "Activation failed", description: e?.message, variant: "destructive" }),
  });

  const isHrOrAdmin = user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr";
  const canActivateWave = isSuperAdmin && !readonly && wave.status === "planned" && !cadenceBlocked;
  const canReassign = isHrOrAdmin && !readonly && wave.status === "active";
  const ackPct = wave.sops.length > 0 ? Math.round((wave.operationalCount / wave.sops.length) * 100) : 0;

  return (
    <Card data-testid={`card-wave-${wave.waveNumber}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`h-2 w-2 rounded-full inline-block shrink-0 ${STATUS_DOT[wave.status]}`} />
              <span className="font-semibold text-sm">Wave {wave.waveNumber} — {wave.name}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ENFORCEMENT_COLOR[wave.enforcement]}`}>
                {ENFORCEMENT_LABEL[wave.enforcement]}
              </span>
            </div>
            {wave.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{wave.description}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>{wave.totalCount} SOPs</span>
              <span>{wave.operationalCount} operational</span>
              {wave.audience && <span>{wave.audience}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-end shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onPreview(wave.waveNumber)}
              data-testid={`button-preview-wave-${wave.waveNumber}`}
            >
              Preview Impact
            </Button>
            {!readonly && isSuperAdmin && wave.status === "planned" && (
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => activateMut.mutate()}
                disabled={cadenceBlocked || activateMut.isPending}
                title={cadenceBlocked ? "Cadence guardrail: max operational SOPs/week reached" : undefined}
                data-testid={`button-activate-wave-${wave.waveNumber}`}
              >
                {activateMut.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                Activate Wave
              </Button>
            )}
            {canReassign && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => reassignMut.mutate()}
                disabled={reassignMut.isPending}
                title="Re-sync progress rows and re-assign training for all impacted employees"
                data-testid={`button-reassign-wave-${wave.waveNumber}`}
              >
                {reassignMut.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Re-run Assignment
              </Button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          data-testid={`button-expand-wave-${wave.waveNumber}`}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {wave.sops.length} SOPs in this wave
        </button>

        {expanded && wave.sops.length > 0 && (
          <div className="mt-2 border rounded overflow-hidden" data-testid={`sops-wave-${wave.waveNumber}`}>
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Code</th>
                  <th className="text-left px-3 py-1.5 font-medium">Title</th>
                  <th className="text-left px-3 py-1.5 font-medium">Status</th>
                  <th className="text-right px-3 py-1.5 font-medium">Ack %</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y">
                {wave.sops.map((sop) => {
                  const ackPct = sop.ackPct ?? 0;
                  const ackColor = ackPct >= 80 ? "text-emerald-600" : ackPct >= 60 ? "text-amber-600" : "text-red-600";
                  return (
                    <tr key={sop.code} data-testid={`row-sop-wave-${sop.code}`}>
                      <td className="px-3 py-2 font-mono">{sop.code}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate">{sop.title ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground capitalize">{sop.lifecycleStatus ?? "—"}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${sop.operational && ackPct === 0 ? "text-muted-foreground" : ackColor}`}>
                        {sop.operational && ackPct === 0 ? "n/a" : `${ackPct}%`}
                      </td>
                      <td className="px-3 py-2 flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          className="text-primary hover:underline text-[10px]"
                          onClick={() => onPreview(wave.waveNumber, sop.code)}
                          data-testid={`button-preview-sop-${sop.code}`}
                        >
                          Preview
                        </button>
                        {!readonly && isSuperAdmin && wave.status === "active" && !sop.operational && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px]"
                            onClick={() => activateSopMut.mutate(sop.code)}
                            disabled={activateSopMut.isPending || (cadenceBlocked && wave.waveNumber >= 1)}
                            data-testid={`button-make-operational-${sop.code}`}
                          >
                            <Zap className="h-2.5 w-2.5 mr-1" /> Make Operational
                          </Button>
                        )}
                        {sop.operational && (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> Operational
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SopRolloutPanel({ readonly }: { readonly: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const [previewWave, setPreviewWave] = useState<{ waveNumber: number; name: string; highlightCode?: string } | null>(null);

  const { data, isLoading } = useQuery<WavesResponse>({
    queryKey: ["/api/sops/waves"],
    refetchInterval: 5 * 60 * 1000,
  });

  const waves = data?.waves ?? [];
  const cadence = data?.cadence ?? { windowCount: 0, max: 2 };
  const cadenceBlocked = cadence.windowCount >= cadence.max;

  return (
    <div className="space-y-4" data-testid="section-sop-rollout">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">SOP Wave Rollout</h2>
        </div>
        {collapsed ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronUp className="h-5 w-5 text-muted-foreground" />}
      </div>

      {!collapsed && (
        <>
          {/* Cadence guardrail bar */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5" data-testid="cadence-guardrail-bar">
            <div className="flex-1 text-sm">
              <span className="font-medium">{cadence.windowCount}</span>
              <span className="text-muted-foreground"> of {cadence.max} SOPs activated this week</span>
            </div>
            <div className="flex h-2 w-32 rounded-full overflow-hidden bg-muted">
              <div
                className={`rounded-full transition-all ${cadenceBlocked ? "bg-red-500" : "bg-primary"}`}
                style={{ width: `${Math.min((cadence.windowCount / cadence.max) * 100, 100)}%` }}
              />
            </div>
            {cadenceBlocked && (
              <Badge variant="destructive" className="text-[10px]" data-testid="badge-cadence-blocked">Guardrail Active</Badge>
            )}
          </div>

          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {waves.map((wave) => (
                <WaveCard
                  key={wave.waveNumber}
                  wave={wave}
                  cadenceBlocked={cadenceBlocked}
                  readonly={readonly}
                  onPreview={(wn, code) => setPreviewWave({ waveNumber: wn, name: wave.name, highlightCode: code })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {previewWave && (
        <WaveImpactDrawer
          waveNumber={previewWave.waveNumber}
          waveName={previewWave.name}
          open={!!previewWave}
          onClose={() => setPreviewWave(null)}
          readonly={readonly}
          highlightSopCode={previewWave.highlightCode}
        />
      )}
    </div>
  );
}

// ── Main GovernanceHub ────────────────────────────────────────────────────────

export default function GovernanceHub({ readonly = false }: { readonly?: boolean }) {
  const { enabled: newLook } = useNewLook();
  const { data: pulse, isLoading } = useQuery<GovernancePulse>({
    queryKey: ["/api/governance/pulse"],
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-8 v2-surface" data-testid="governance-hub">
      {/* Org Pulse — 6 stat cards */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Org Pulse</h2>
          {readonly && (
            <Badge variant="outline" className="text-[10px]">Read Only</Badge>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : pulse ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SopComplianceCard pulse={pulse} />
            <TrainingComplianceCard pulse={pulse} />
            <ActivePlansCard pulse={pulse} />
            <ProbationAlertsCard pulse={pulse} />
            <GoalHealthCard pulse={pulse} />
            <CheckinComplianceCard pulse={pulse} />
          </div>
        ) : (
          <div className="rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load governance pulse data.
          </div>
        )}
      </div>

      {/* SOP Compliance Health — org-wide panel for HR/admin (new_look only) */}
      {newLook && <SopComplianceOrgPanel />}

      {/* SOP Rollout Panel */}
      <SopRolloutPanel readonly={readonly} />
    </div>
  );
}
