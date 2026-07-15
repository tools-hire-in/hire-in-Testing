/**
 * Task #1115 — Team Funnel View.
 * Manager's conversion funnel table with period targets, gap indicators,
 * and Plan Period mode sourced from active PIP/probation plans.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, Phone, Monitor, Target, Trophy, Users,
  Settings2, AlertTriangle, CheckCircle2, MinusCircle, CalendarRange,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FunnelRow {
  recruiterId: string;
  recruiterName: string;
  role: string;
  designation: string | null;
  callsMade: number;
  screensLogged: number;
  submissions: number;
  phoneScreens: number;
  interviews: number;
  offers: number;
  placements: number;
  screenRate: number | null;
  closeRate: number | null;
  stages: Record<string, number>;
}

interface FunnelResponse {
  rows: FunnelRow[];
  planPeriodLabel: string | null;
  from: string;
  to: string;
}

type DateRange = "week" | "month" | "quarter" | "plan";

interface PeriodTargets {
  calls: number;
  submissions: number;
  placements: number;
}

const DEFAULT_TARGETS: Record<string, PeriodTargets> = {
  week:    { calls: 50,  submissions: 5,  placements: 0 },
  month:   { calls: 200, submissions: 20, placements: 1 },
  quarter: { calls: 600, submissions: 60, placements: 3 },
  plan:    { calls: 400, submissions: 30, placements: 2 },
};

function getQueryParams(range: DateRange): Record<string, string> {
  if (range === "plan") return { range: "plan" };

  const today = new Date();
  const to = today.toISOString().split("T")[0];
  let from: string;

  if (range === "week") {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    from = d.toISOString().split("T")[0];
  } else if (range === "month") {
    from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  } else {
    const q = Math.floor(today.getMonth() / 3);
    from = new Date(today.getFullYear(), q * 3, 1).toISOString().split("T")[0];
  }
  return { from, to };
}

function getRangeLabel(range: DateRange): string {
  const today = new Date();
  if (range === "week") return "Last 7 days";
  if (range === "month") return `${today.toLocaleString("en-US", { month: "long" })} MTD`;
  if (range === "quarter") return `Q${Math.floor(today.getMonth() / 3) + 1} ${today.getFullYear()} QTD`;
  return "Active Plan Period";
}

function ConversionBadge({ rate, label }: { rate: number | null; label: string }) {
  if (rate === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color =
    rate >= 70 ? "bg-green-100 text-green-700 border-green-200" :
    rate >= 40 ? "bg-amber-100 text-amber-700 border-amber-200" :
    "bg-red-100 text-red-700 border-red-200";
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium border ${color}`}>
      {rate}% <span className="text-[10px] opacity-70">{label}</span>
    </span>
  );
}

function GapChip({ actual, target }: { actual: number; target: number }) {
  if (target === 0) return null;
  const pct = Math.round((actual / target) * 100);
  if (pct >= 100) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 font-medium">
      <CheckCircle2 className="h-2.5 w-2.5" /> {pct}%
    </span>
  );
  if (pct >= 70) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 font-medium">
      <MinusCircle className="h-2.5 w-2.5" /> {pct}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-red-600 font-medium">
      <AlertTriangle className="h-2.5 w-2.5" /> {pct}%
    </span>
  );
}

export default function TeamFunnel() {
  const [dateRange, setDateRange] = useState<DateRange>("week");
  const [targets, setTargets] = useState<Record<string, PeriodTargets>>({ ...DEFAULT_TARGETS });
  const [editingTargets, setEditingTargets] = useState(false);
  const [draft, setDraft] = useState<PeriodTargets>({ ...DEFAULT_TARGETS.week });

  const queryParams = getQueryParams(dateRange);
  const periodTargets = targets[dateRange] ?? DEFAULT_TARGETS.week;

  const qs = new URLSearchParams(queryParams).toString();

  const { data: funnelResp, isLoading } = useQuery<FunnelResponse>({
    queryKey: ["/api/manager/team-funnel", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/manager/team-funnel?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team funnel");
      return res.json();
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const funnel: FunnelRow[] = funnelResp?.rows ?? [];
  const planPeriodLabel = funnelResp?.planPeriodLabel ?? null;
  const resolvedFrom = funnelResp?.from;
  const resolvedTo = funnelResp?.to;

  const totals = funnel.reduce(
    (acc, row) => ({
      calls: acc.calls + row.callsMade,
      submissions: acc.submissions + row.submissions,
      screens: acc.screens + row.phoneScreens,
      interviews: acc.interviews + row.interviews,
      offers: acc.offers + row.offers,
      placements: acc.placements + row.placements,
    }),
    { calls: 0, submissions: 0, screens: 0, interviews: 0, offers: 0, placements: 0 },
  );

  function openTargetEdit() {
    setDraft({ ...periodTargets });
    setEditingTargets(true);
  }

  function saveTargets() {
    setTargets((prev) => ({ ...prev, [dateRange]: draft }));
    setEditingTargets(false);
  }

  const teamCallTarget = periodTargets.calls * funnel.length;
  const teamSubTarget = periodTargets.submissions * funnel.length;
  const teamPlacementTarget = periodTargets.placements * funnel.length;

  return (
    <div className="space-y-4" data-testid="team-funnel-view">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Team Pipeline
          </h2>
          <p className="text-sm text-muted-foreground">
            {dateRange === "plan" && planPeriodLabel
              ? <span className="flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" />{planPeriodLabel}</span>
              : `${getRangeLabel(dateRange)} · ${funnel.length} active recruiter${funnel.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={editingTargets} onOpenChange={setEditingTargets}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={openTargetEdit}
                data-testid="funnel-set-targets-btn"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Per-recruiter targets
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4 space-y-3" align="end" data-testid="funnel-targets-popover">
              <p className="text-xs font-semibold">Per-recruiter targets ({dateRange})</p>
              <div className="space-y-2">
                {[
                  { key: "calls", label: "Calls / period" },
                  { key: "submissions", label: "Submissions / period" },
                  { key: "placements", label: "Placements / period" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</label>
                    <Input
                      type="number"
                      min={0}
                      value={(draft as any)[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: parseInt(e.target.value, 10) || 0 }))}
                      className="h-7 text-xs"
                      data-testid={`target-input-${key}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={saveTargets} data-testid="targets-save-btn">Apply</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingTargets(false)}>Cancel</Button>
              </div>
            </PopoverContent>
          </Popover>

          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="funnel-date-range-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week" className="text-xs">This Week</SelectItem>
              <SelectItem value="month" className="text-xs">This Month</SelectItem>
              <SelectItem value="quarter" className="text-xs">This Quarter</SelectItem>
              <SelectItem value="plan" className="text-xs">
                <span className="flex items-center gap-1"><CalendarRange className="h-3 w-3" />Plan Period</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Plan period info badge */}
      {dateRange === "plan" && planPeriodLabel && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-normal gap-1.5">
            <CalendarRange className="h-3 w-3" />
            {planPeriodLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Funnel data sourced from active PIP/probation plan dates for your team
          </span>
        </div>
      )}

      {/* Summary strip with team-level target gaps */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: "Calls",       value: totals.calls,       target: teamCallTarget,      icon: Phone,      color: "text-blue-600" },
          { label: "Submissions", value: totals.submissions,  target: teamSubTarget,       icon: Users,      color: "text-slate-600" },
          { label: "Screens",     value: totals.screens,     target: 0,                   icon: Monitor,    color: "text-indigo-600" },
          { label: "Interviews",  value: totals.interviews,  target: 0,                   icon: Target,     color: "text-purple-600" },
          { label: "Offers",      value: totals.offers,      target: 0,                   icon: TrendingUp, color: "text-amber-600" },
          { label: "Placed",      value: totals.placements,  target: teamPlacementTarget, icon: Trophy,     color: "text-green-600" },
        ].map(({ label, value, target, icon: Icon, color }) => (
          <Card key={label} className="shadow-none" data-testid={`funnel-total-${label.toLowerCase()}`}>
            <CardContent className="p-3 text-center">
              <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
              <p className="text-xl font-mono font-bold">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
              {target > 0 && (
                <div className="mt-0.5 flex justify-center">
                  <GapChip actual={value} target={target} />
                </div>
              )}
              {target > 0 && (
                <p className="text-[9px] text-muted-foreground/60">of {target} target</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team funnel table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : funnel.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="funnel-empty">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No pipeline data yet</p>
          <p className="text-xs mt-1">Activity will appear once team members log calls or submit candidates</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]" data-testid="funnel-table">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Recruiter</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span className="flex flex-col items-center">
                    <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" /> Calls</span>
                    {periodTargets.calls > 0 && <span className="text-[9px] text-muted-foreground/60 font-normal">target {periodTargets.calls}</span>}
                  </span>
                </th>
                <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span className="flex flex-col items-center">
                    Submissions
                    {periodTargets.submissions > 0 && <span className="text-[9px] text-muted-foreground/60 font-normal">target {periodTargets.submissions}</span>}
                  </span>
                </th>
                <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Screens</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Interviews</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Offers</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span className="flex flex-col items-center">
                    <span className="flex items-center gap-0.5"><Trophy className="h-3 w-3 text-green-600" /> Placed</span>
                    {periodTargets.placements > 0 && <span className="text-[9px] text-muted-foreground/60 font-normal">target {periodTargets.placements}</span>}
                  </span>
                </th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {funnel.map((row) => (
                <tr key={row.recruiterId} className="hover:bg-muted/30 transition-colors" data-testid={`funnel-row-${row.recruiterId}`}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{row.recruiterName}</p>
                    {row.designation && <p className="text-xs text-muted-foreground">{row.designation}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <p className="font-mono text-sm">{row.callsMade}</p>
                    {periodTargets.calls > 0 && <GapChip actual={row.callsMade} target={periodTargets.calls} />}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <p className="font-mono text-sm">{row.submissions}</p>
                    {periodTargets.submissions > 0 && <GapChip actual={row.submissions} target={periodTargets.submissions} />}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-sm">{row.phoneScreens}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-sm">{row.interviews}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-sm">{row.offers}</td>
                  <td className="px-3 py-2.5 text-center">
                    <p className={`font-mono text-sm font-semibold ${row.placements > 0 ? "text-green-600" : ""}`}>{row.placements}</p>
                    {periodTargets.placements > 0 && <GapChip actual={row.placements} target={periodTargets.placements} />}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <ConversionBadge rate={row.screenRate} label="screen" />
                      <ConversionBadge rate={row.closeRate} label="close" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Screen rate = submissions → phone screen or above. Close rate = interviews → placement.
        {resolvedFrom && resolvedTo ? ` Period: ${resolvedFrom} – ${resolvedTo}.` : ""}
        {" "}Targets are per-recruiter and configurable above.
      </p>
    </div>
  );
}
