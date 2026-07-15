import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TrendingUp, TrendingDown, Minus, Target, Settings, ChevronDown, ChevronRight, Plus, Loader2 } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface RateRow {
  specialty: string;
  quarterlyTarget: number | null;
  annualTarget: number | null;
  thisMonth: { avg: number; n: number } | null;
  qtd: { avg: number; n: number } | null;
  ytd: { avg: number; n: number } | null;
  trendData: Array<{ week: number; avg: number; n: number }>;
  trendDir: "up" | "down" | "flat";
  trendPct: number | null;
  yearEndProjection: number | null;
}

interface RateIntelligenceData {
  rows: RateRow[];
  asOf: string;
}

interface RateTarget {
  id: string;
  specialty: string;
  target_bill_rate_usd: string;
  period_type: string;
  period_label: string;
  notes: string | null;
  set_by_name: string | null;
}

interface RateTargetsData {
  targets: RateTarget[];
  grouped: Record<string, RateTarget[]>;
}

const SPECIALTIES = ["Healthcare", "IT", "Engineering", "Professional Services", "Other"];

function fmt(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  return `$${val.toFixed(0)}/hr`;
}

function DataQualityBadge({ n }: { n: number }) {
  if (n === 0) return <span className="text-[10px] text-muted-foreground">(no data)</span>;
  if (n < 3) return <span className="text-[10px] text-amber-600 font-medium">(n={n} low)</span>;
  return <span className="text-[10px] text-muted-foreground">(n={n})</span>;
}

function TrendIndicator({ dir, pct }: { dir: "up" | "down" | "flat"; pct: number | null }) {
  if (dir === "up") return (
    <span className="flex items-center gap-0.5 text-green-600 text-[10px]">
      <TrendingUp className="h-3 w-3" />
      {pct != null ? `+${pct.toFixed(1)}%` : "↑"}
    </span>
  );
  if (dir === "down") return (
    <span className="flex items-center gap-0.5 text-red-500 text-[10px]">
      <TrendingDown className="h-3 w-3" />
      {pct != null ? `${pct.toFixed(1)}%` : "↓"}
    </span>
  );
  return <span className="flex items-center gap-0.5 text-muted-foreground text-[10px]"><Minus className="h-3 w-3" />flat</span>;
}

function StatusIcon({ avg, target }: { avg: number | null; target: number | null }) {
  if (!avg || !target) return null;
  const gapPct = ((target - avg) / target) * 100;
  if (gapPct > 10) return <span title={`${gapPct.toFixed(1)}% below target`}>🔴</span>;
  if (gapPct > 5) return <span title={`${gapPct.toFixed(1)}% below target`}>⚠️</span>;
  return <span title="On or above target">✅</span>;
}

function SparklineChart({ data }: { data: Array<{ week: number; avg: number }> }) {
  if (data.length < 2) return <div className="w-16 h-8 flex items-center justify-center text-[9px] text-muted-foreground">No trend</div>;
  return (
    <ResponsiveContainer width={64} height={32}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="avg" dot={false} stroke="hsl(var(--primary))" strokeWidth={1.5} />
        <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(0)}`, "Avg rate"]} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AddTargetDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [specialty, setSpecialty] = useState("");
  const [rate, setRate] = useState("");
  const [periodType, setPeriodType] = useState("quarterly");
  const [periodLabel, setPeriodLabel] = useState(() => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `Q${q} ${now.getFullYear()}`;
  });
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ceo/rate-targets", {
      specialty, targetBillRateUsd: Number(rate), periodType, periodLabel,
      notes: notes || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ceo/rate-targets"] });
      toast({ title: "Rate target saved" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Set Rate Target
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Specialty</Label>
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger data-testid="select-target-specialty"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Period Type</Label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger data-testid="select-target-period-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Period</Label>
              <Input
                placeholder="e.g. Q3 2026"
                value={periodLabel}
                onChange={e => setPeriodLabel(e.target.value)}
                data-testid="input-target-period"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Target Bill Rate ($/hr)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g. 150"
              value={rate}
              onChange={e => setRate(e.target.value)}
              data-testid="input-target-rate"
            />
          </div>
          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Input
              placeholder="Context or rationale"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              data-testid="input-target-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !specialty || !rate || !periodLabel}
            data-testid="button-save-target"
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save Target
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RateIntelligenceCard() {
  const { user } = useAuth();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showTargets, setShowTargets] = useState(false);
  const [addingTarget, setAddingTarget] = useState(false);

  const { data: intel, isLoading } = useQuery<RateIntelligenceData>({
    queryKey: ["/api/ceo/rate-intelligence"],
    staleTime: 60000,
    enabled: !!user && user.role === "super_admin",
  });

  const { data: targets } = useQuery<RateTargetsData>({
    queryKey: ["/api/ceo/rate-targets"],
    staleTime: 60000,
    enabled: !!user && user.role === "super_admin",
  });

  const deleteTarget = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ceo/rate-targets/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ceo/rate-targets"] }),
  });

  if (!user || user.role !== "super_admin") return null;

  const hasAnyData = intel?.rows.some(r => r.thisMonth || r.ytd || r.qtd);

  return (
    <Card className="shadow-sm border" data-testid="rate-intelligence-card">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Rate Performance
            <Badge variant="secondary" className="text-[10px]">CEO</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowTargets(v => !v)}
              data-testid="button-rate-targets-toggle"
            >
              <Settings className="h-3.5 w-3.5" />
              Targets
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setAddingTarget(true)}
              data-testid="button-add-rate-target"
            >
              <Plus className="h-3 w-3" />
              Set Target
            </Button>
          </div>
        </div>
        {!hasAnyData && !isLoading && (
          <p className="text-xs text-muted-foreground mt-1">
            No rate data yet. Import contracts with bill rates to populate this dashboard.
          </p>
        )}
      </CardHeader>

      {addingTarget && <AddTargetDialog onClose={() => setAddingTarget(false)} />}

      {/* Rate targets settings panel */}
      {showTargets && (
        <div className="px-4 pb-3 border-b">
          <p className="text-xs font-medium text-muted-foreground mb-2">Active Rate Targets</p>
          {(!targets?.targets.length) ? (
            <p className="text-xs text-muted-foreground">No targets set yet. Click "Set Target" to add one.</p>
          ) : (
            <div className="space-y-1.5">
              {targets.targets.map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0" data-testid={`rate-target-row-${t.id}`}>
                  <span className="font-medium">{t.specialty}</span>
                  <span className="text-muted-foreground capitalize">{t.period_type}: {t.period_label}</span>
                  <span className="font-mono font-semibold text-primary">${parseFloat(t.target_bill_rate_usd).toFixed(0)}/hr</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteTarget.mutate(t.id)}
                    data-testid={`button-delete-target-${t.id}`}
                  >×</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <div className="px-4 py-3 space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="rate-intel-table">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground w-36">Specialty</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Target</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">This Month</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">QTD</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">YTD</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Trend</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Projection</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {(intel?.rows ?? []).filter(r => r.specialty !== "Other" || r.thisMonth || r.ytd).map(row => {
                  const isExpanded = expandedRow === row.specialty;
                  const target = row.quarterlyTarget ?? row.annualTarget;
                  const avgNow = row.thisMonth?.avg ?? null;

                  return (
                    <>
                      <tr
                        key={row.specialty}
                        className="border-b hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => setExpandedRow(isExpanded ? null : row.specialty)}
                        data-testid={`rate-row-${row.specialty}`}
                      >
                        <td className="px-4 py-2.5 font-medium flex items-center gap-1.5">
                          {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                          {row.specialty}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {target ? <span className="font-mono text-muted-foreground">{fmt(target)}</span> : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {row.thisMonth ? (
                            <div className="flex items-center justify-end gap-1">
                              <StatusIcon avg={avgNow} target={target} />
                              <span className={cn("font-mono font-semibold", target && avgNow && avgNow < target * 0.95 ? "text-red-600" : "text-foreground")}>
                                {fmt(row.thisMonth.avg)}
                              </span>
                              <DataQualityBadge n={row.thisMonth.n} />
                            </div>
                          ) : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {row.qtd ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-mono">{fmt(row.qtd.avg)}</span>
                              <DataQualityBadge n={row.qtd.n} />
                            </div>
                          ) : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {row.ytd ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-mono">{fmt(row.ytd.avg)}</span>
                              <DataQualityBadge n={row.ytd.n} />
                            </div>
                          ) : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <SparklineChart data={row.trendData} />
                            <TrendIndicator dir={row.trendDir} pct={row.trendPct} />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {row.yearEndProjection != null ? (
                            <div>
                              <span className="font-mono text-xs">{fmt(row.yearEndProjection)}</span>
                              <div className="text-[9px] text-muted-foreground">by yr-end</div>
                            </div>
                          ) : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td></td>
                      </tr>

                      {/* Expanded biweekly breakdown */}
                      {isExpanded && (
                        <tr key={`${row.specialty}-expanded`} className="bg-muted/10">
                          <td colSpan={8} className="px-6 py-3">
                            <p className="text-[11px] font-medium text-muted-foreground mb-2">Weekly trend (last 12 weeks)</p>
                            {row.trendData.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No weekly data available yet.</p>
                            ) : (
                              <div className="grid grid-cols-6 gap-1.5">
                                {row.trendData.slice(-6).map((d, i) => (
                                  <div key={i} className="bg-background border rounded p-2 text-center">
                                    <div className="font-mono text-xs font-semibold">{fmt(d.avg)}</div>
                                    <div className="text-[9px] text-muted-foreground">Wk {d.week} · n={d.n}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {row.yearEndProjection && row.annualTarget && (
                              <div className="mt-2 text-[11px]">
                                <span className="text-muted-foreground">Year-end projection: </span>
                                <span className={cn("font-semibold", row.yearEndProjection >= row.annualTarget ? "text-green-600" : "text-amber-600")}>
                                  {fmt(row.yearEndProjection)} by Dec 31
                                </span>
                                <span className="text-muted-foreground"> vs annual target {fmt(row.annualTarget)}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
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
