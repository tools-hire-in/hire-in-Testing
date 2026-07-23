import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  BarChart3,
  Send,
  Timer,
  GaugeCircle,
  ThumbsDown,
  ThumbsUp,
  Eye,
  MousePointerClick,
  Heart,
  Star,
  Users,
  Newspaper,
  Megaphone,
  DollarSign,
  TrendingUp,
  BarChart2,
  Globe,
  Zap,
  FileText,
  AlertTriangle,
} from "lucide-react";
import type { StudioProject } from "@shared/schema";
import { INSIGHT_REACTIONS, insightCategoryLabel } from "@shared/insights";
import { FEEDBACK_REASON_LABELS, type FeedbackReasonCode } from "@shared/agentIntelligenceContracts";
import { useStudioProject } from "./useStudioProject";
import { StudioTip } from "@/components/studio/StudioTip";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";

interface StudioAnalytics {
  range: { dateFrom: string | null; dateTo: string | null };
  workflow: {
    publishedCount: number;
    medianDraftToPublishDays: number | null;
    slaRatePct: number | null;
    slaSampleSize: number;
    marketingRejectionRatePct: number | null;
    marketingDecisionCount: number;
  };
  audience: {
    views: number;
    ctaClicks: number;
    ctaRatePct: number | null;
    reactionsByType: { reactionType: string; count: number }[];
    totalReactions: number;
  };
  topArticles: { id: string; title: string; views: number; reactions: number; ctaClicks: number }[];
  authorLeaderboard: {
    authorProfileId: string | null;
    authorName: string;
    published: number;
    avgReactionsPerArticle: number;
  }[];
  categoryBreakdown: { category: string; published: number; avgViewsPerCategory: number }[];
  subscribers: { confirmed: number; newThisMonth: number };
}

interface CampaignAttributionRow {
  campaignId: string;
  campaignName: string;
  status: string;
  articleCount: number;
  totalReactions: number;
  ctaClicks: number;
  topReaction: string | null;
}

interface SpendSummary {
  monthly: Array<{ month: string; total_cost_usd: string; generation_count: string }>;
  byModel: Array<{ model_name: string; total_cost_usd: string; generation_count: string }>;
  byKind: Array<{ kind: string; total_cost_usd: string; generation_count: string }>;
  topArticles: Array<{ article_id: string; title: string | null; total_cost_usd: string; generation_count: string }>;
  byUser: Array<{ generated_by_user_id: string; user_name: string | null; total_cost_usd: string; generation_count: string }>;
  dailySeries: Array<{ day: string; total_cost_usd: string; generation_count: string }>;
}

interface FeedbackSummary {
  days: number;
  byAgent: Record<string, number>;
  positiveRatings: number;
  negativeRatings: number;
  topNegativeReasons: Array<{ reasonCode: string; count: number }>;
  contentOutcomes: Record<string, number>;
  bdActions: Record<string, number>;
  byDomain: Record<string, number>;
}

type Days = 7 | 30 | 90;

const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
];

const CONTENT_OUTCOME_LABELS: Record<string, string> = {
  ACCEPTED: "Accepted",
  EDITED_THEN_ACCEPTED: "Edited then accepted",
  DISCARDED: "Discarded",
  REGENERATED: "Regenerated",
  SENT_FOR_REVIEW: "Sent for review",
  PUBLISHED: "Published",
};

const BD_ACTION_LABELS: Record<string, string> = {
  SAVED_AS_CONTENT_IDEA: "Saved as idea",
  CREATED_CLIENT_DECK: "Created deck",
  USED_IN_CALL: "Used in call",
  USED_IN_DECK: "Used in deck",
  COPIED: "Copied",
};

const DOMAIN_LABELS: Record<string, string> = {
  healthcare: "Healthcare",
  it: "IT / Technology",
  engineering: "Engineering",
  professional_services: "Professional Services",
  general: "General",
  cross_domain: "Cross-Domain",
};

const AGENT_LABELS: Record<string, string> = {
  BD_AGENT: "BD Agent",
  CONTENT_COPILOT: "Content Copilot",
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  color,
  testId,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`shrink-0 ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold tabular-nums" data-testid={`${testId}-value`}>
            {value}
          </div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {hint && <div className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function FeedbackStatCard({
  icon,
  label,
  value,
  loading,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  loading: boolean;
  accent?: "green" | "red" | "blue";
}) {
  const accentClass =
    accent === "green"
      ? "text-emerald-600"
      : accent === "red"
      ? "text-rose-600"
      : "text-primary";

  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
        <span className={accentClass}>{icon}</span>
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16 mt-1" />
      ) : (
        <span className={`text-2xl font-bold ${accentClass}`}>{value}</span>
      )}
    </div>
  );
}

function BarRow({
  label,
  count,
  max,
  badge,
}: {
  label: string;
  count: number;
  max: number;
  badge?: React.ReactNode;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5" data-testid="bar-row">
      <span className="w-40 shrink-0 text-sm text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-medium">{count}</span>
      {badge}
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-primary">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground py-2 text-center">{label}</p>;
}

function FeedbackInsightsPanel() {
  const [days, setDays] = useState<Days>(30);

  const { data, isLoading } = useQuery<FeedbackSummary>({
    queryKey: ["/api/admin/agent-feedback/summary", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/agent-feedback/summary?days=${days}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load feedback summary");
      return res.json();
    },
  });

  const totalRatings = (data?.positiveRatings ?? 0) + (data?.negativeRatings ?? 0);
  const satisfactionPct =
    totalRatings > 0
      ? Math.round(((data?.positiveRatings ?? 0) / totalRatings) * 100)
      : null;

  const maxNegReason = Math.max(...(data?.topNegativeReasons ?? []).map((r) => r.count), 1);
  const contentOutcomeEntries = Object.entries(data?.contentOutcomes ?? {}).sort((a, b) => b[1] - a[1]);
  const maxContentOutcome = Math.max(...contentOutcomeEntries.map(([, c]) => c), 1);
  const bdActionEntries = Object.entries(data?.bdActions ?? {}).sort((a, b) => b[1] - a[1]);
  const maxBdAction = Math.max(...bdActionEntries.map(([, c]) => c), 1);
  const domainEntries = Object.entries(data?.byDomain ?? {}).sort((a, b) => b[1] - a[1]);
  const maxDomain = Math.max(...domainEntries.map(([, c]) => c), 1);
  const agentEntries = Object.entries(data?.byAgent ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" data-testid="heading-feedback-insights">
            Feedback Insights
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Agent quality signals from ratings and content actions
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1" data-testid="date-range-picker">
          {([7, 30, 90] as Days[]).map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setDays(d)}
              data-testid={`button-days-${d}`}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FeedbackStatCard icon={<ThumbsUp className="h-3.5 w-3.5" />} label="Positive" value={data?.positiveRatings ?? 0} loading={isLoading} accent="green" />
        <FeedbackStatCard icon={<ThumbsDown className="h-3.5 w-3.5" />} label="Negative" value={data?.negativeRatings ?? 0} loading={isLoading} accent="red" />
        <FeedbackStatCard icon={<BarChart3 className="h-3.5 w-3.5" />} label="Total ratings" value={totalRatings} loading={isLoading} />
        <FeedbackStatCard icon={<BarChart3 className="h-3.5 w-3.5" />} label="Satisfaction" value={satisfactionPct !== null ? `${satisfactionPct}%` : "—"} loading={isLoading} accent={satisfactionPct !== null && satisfactionPct >= 70 ? "green" : "red"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard icon={<AlertTriangle className="h-4 w-4" />} title="Top negative reasons">
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
          ) : (data?.topNegativeReasons ?? []).length === 0 ? (
            <EmptyState label="No negative ratings in this period" />
          ) : (
            <div data-testid="list-negative-reasons">
              {(data?.topNegativeReasons ?? []).map((r) => (
                <BarRow
                  key={r.reasonCode}
                  label={FEEDBACK_REASON_LABELS[r.reasonCode as FeedbackReasonCode] ?? r.reasonCode}
                  count={r.count}
                  max={maxNegReason}
                  badge={<Badge variant="secondary" className="text-[10px] px-1.5 py-0">{r.reasonCode}</Badge>}
                />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={<Zap className="h-4 w-4" />} title="Events by agent">
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-7 w-full" /><Skeleton className="h-7 w-full" /></div>
          ) : agentEntries.length === 0 ? (
            <EmptyState label="No events in this period" />
          ) : (
            <div data-testid="list-by-agent">
              {agentEntries.map(([agent, count]) => (
                <BarRow key={agent} label={AGENT_LABELS[agent] ?? agent} count={count} max={Math.max(...agentEntries.map(([, c]) => c), 1)} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={<FileText className="h-4 w-4" />} title="Content outcomes">
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
          ) : contentOutcomeEntries.length === 0 ? (
            <EmptyState label="No content outcome events in this period" />
          ) : (
            <div data-testid="list-content-outcomes">
              {contentOutcomeEntries.map(([event, count]) => (
                <BarRow key={event} label={CONTENT_OUTCOME_LABELS[event] ?? event} count={count} max={maxContentOutcome} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={<Zap className="h-4 w-4" />} title="BD agent actions">
          {isLoading ? (
            <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
          ) : bdActionEntries.length === 0 ? (
            <EmptyState label="No BD actions in this period" />
          ) : (
            <div data-testid="list-bd-actions">
              {bdActionEntries.map(([action, count]) => (
                <BarRow key={action} label={BD_ACTION_LABELS[action] ?? action} count={count} max={maxBdAction} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard icon={<Globe className="h-4 w-4" />} title="Events by domain">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
        ) : domainEntries.length === 0 ? (
          <EmptyState label="No domain data in this period" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8" data-testid="list-by-domain">
            {domainEntries.map(([domain, count]) => (
              <BarRow key={domain} label={DOMAIN_LABELS[domain] ?? domain} count={count} max={maxDomain} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function SpendDashboard() {
  const { data, isLoading } = useQuery<SpendSummary>({
    queryKey: ["/api/admin/studio/spend/summary"],
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const thisMonth = data.monthly[0];
  const lastMonth = data.monthly[1];
  const thisMonthCost = parseFloat(thisMonth?.total_cost_usd ?? "0");
  const lastMonthCost = parseFloat(lastMonth?.total_cost_usd ?? "0");
  const totalGens = parseInt(thisMonth?.generation_count ?? "0", 10);
  const maxDailyCost = Math.max(...data.dailySeries.map((d) => parseFloat(d.total_cost_usd)), 0.0001);
  const fmt = (n: number) => n < 0.001 ? "<$0.001" : `$${n.toFixed(4)}`;
  const fmtLarge = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-6" data-testid="section-spend-dashboard">
      <div>
        <h2 className="text-lg font-semibold">AI Spend Dashboard</h2>
        <p className="text-sm text-muted-foreground">Cost tracking for all studio AI generations. Visible only to super admins.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card data-testid="card-spend-this-month">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              This month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums" data-testid="text-spend-this-month">{fmtLarge(thisMonthCost)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalGens} generation{totalGens !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-spend-last-month">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Last month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-muted-foreground" data-testid="text-spend-last-month">{fmtLarge(lastMonthCost)}</p>
            <p className="text-xs text-muted-foreground mt-1">{lastMonth?.generation_count ?? 0} generations</p>
          </CardContent>
        </Card>
        <Card data-testid="card-spend-avg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BarChart2 className="h-4 w-4" />
              Avg per generation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums" data-testid="text-spend-avg">
              {totalGens > 0 ? fmt(thisMonthCost / totalGens) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">this month</p>
          </CardContent>
        </Card>
      </div>

      {data.dailySeries.length > 0 && (
        <Card data-testid="card-spend-sparkline">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Daily spend — last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-0.5 h-16">
              {data.dailySeries.map((d, i) => {
                const cost = parseFloat(d.total_cost_usd);
                const h = maxDailyCost > 0 ? Math.max((cost / maxDailyCost) * 100, cost > 0 ? 4 : 1) : 1;
                return (
                  <div
                    key={i}
                    title={`${new Date(d.day).toLocaleDateString()}: ${fmt(cost)} (${d.generation_count} gen${parseInt(d.generation_count) !== 1 ? "s" : ""})`}
                    className="flex-1 rounded-sm bg-primary/70 hover:bg-primary transition-colors cursor-help"
                    style={{ height: `${h}%` }}
                    data-testid={`bar-daily-${i}`}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-spend-by-model">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">This month by model</CardTitle></CardHeader>
          <CardContent>
            {data.byModel.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {data.byModel.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-sm" data-testid={`row-model-${i}`}>
                    <span className="font-mono text-xs text-muted-foreground truncate max-w-[60%]">{m.model_name}</span>
                    <span className="tabular-nums font-medium">{fmt(parseFloat(m.total_cost_usd))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-spend-by-kind">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">This month by type</CardTitle></CardHeader>
          <CardContent>
            {data.byKind.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {data.byKind.map((k, i) => (
                  <div key={i} className="flex items-center justify-between text-sm" data-testid={`row-kind-${i}`}>
                    <span className="capitalize text-muted-foreground">{(k.kind ?? "unknown").replace(/_/g, " ")}</span>
                    <span className="tabular-nums font-medium">{fmt(parseFloat(k.total_cost_usd))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-spend-top-articles">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Top articles by cost (all time)</CardTitle></CardHeader>
          <CardContent>
            {data.topArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {data.topArticles.map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm" data-testid={`row-top-article-${i}`}>
                    <span className="truncate text-muted-foreground max-w-[65%]">{a.title ?? a.article_id}</span>
                    <span className="tabular-nums font-medium shrink-0">{fmt(parseFloat(a.total_cost_usd))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-spend-by-user">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              This month by user
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.byUser.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {data.byUser.map((u, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm" data-testid={`row-user-spend-${i}`}>
                    <span className="truncate text-muted-foreground max-w-[65%]">{u.user_name ?? u.generated_by_user_id ?? "Unknown"}</span>
                    <span className="tabular-nums font-medium shrink-0">{fmt(parseFloat(u.total_cost_usd))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

export default function StudioAnalytics() {
  const { enabled: newLook } = useNewLook();
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } = useStudioProject();
  const { can } = usePermissions();
  const { user } = useAuth();
  const [range, setRange] = useState<string>("90");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const canSpend = can("studio.spend_dashboard");
  const isHrAdmin = ["super_admin", "admin", "hr"].includes(user?.role ?? "");

  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  if (range === "custom") {
    dateFrom = customFrom || undefined;
    dateTo = customTo || undefined;
  } else {
    const presetDays = parseInt(range, 10);
    if (Number.isFinite(presetDays) && presetDays > 0) {
      dateFrom = toIsoDate(new Date(Date.now() - presetDays * 24 * 60 * 60 * 1000));
    }
  }

  const { data, isLoading } = useQuery<StudioAnalytics>({
    queryKey: [
      "/api/admin/studio/analytics",
      { projectId: selectedProjectId, dateFrom: dateFrom ?? "", dateTo: dateTo ?? "" },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProjectId) params.append("projectId", selectedProjectId);
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      const res = await fetch(`/api/admin/studio/analytics?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: attribution } = useQuery<CampaignAttributionRow[]>({
    queryKey: ["/api/studio/analytics/attribution", { projectId: selectedProjectId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProjectId) params.append("projectId", selectedProjectId);
      const res = await fetch(`/api/studio/analytics/attribution?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch campaign attribution");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const fmtPct = (v: number | null) => (v == null ? "—" : `${v}%`);
  const reactionEmoji = (type: string | null) => {
    const found = INSIGHT_REACTIONS.find((r) => r.value === type);
    return found ? `${found.emoji} ${found.label}` : "—";
  };

  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface">
        {/* Header */}
        {newLook ? (
          <V2PageHeader
            icon={BarChart3}
            eyebrow="Studio"
            title="Content Analytics"
            subtitle="Workflow throughput, audience engagement, and AI spend."
            testId="text-analytics-title"
          />
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-analytics-title">
                  Content Analytics
                </h1>
                <p className="text-sm text-muted-foreground">
                  Workflow throughput, audience engagement, and AI spend.
                </p>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="performance">
          <TabsList>
            <TabsTrigger value="performance" data-testid="tab-analytics-performance">Performance</TabsTrigger>
            <TabsTrigger value="feedback" data-testid="tab-analytics-feedback">Feedback</TabsTrigger>
            <TabsTrigger value="ai-spend" data-testid="tab-analytics-ai-spend">AI Spend</TabsTrigger>
          </TabsList>

          {/* Performance tab */}
          <TabsContent value="performance" className="mt-6 space-y-6">
            <StudioTip
              id="analytics-first-visit"
              title="How to read this page"
              body="Throughput shows how fast content moves through your pipeline; engagement shows how readers respond once it's live. Check weekly — trends matter more than single numbers."
            />

            <div className="flex flex-wrap items-center gap-2">
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="w-[160px]" data-testid="select-analytics-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} data-testid={`option-range-${o.value}`}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {range === "custom" && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    data-testid="input-date-from"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    data-testid="input-date-to"
                  />
                </div>
              )}

              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
                disabled={projectsLoading || !projects?.length}
              >
                <SelectTrigger className="w-[220px]" data-testid="select-analytics-project">
                  <SelectValue placeholder={projectsLoading ? "Loading…" : "Select a project"} />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((p: StudioProject) => (
                    <SelectItem key={p.id} value={p.id} data-testid={`option-project-${p.id}`}>
                      <span className="flex items-center gap-2">
                        {p.isPrimary && <Star className="h-3 w-3 text-amber-500" />}
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading || !data ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Workflow</h2>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <StatCard label="Published" value={data.workflow.publishedCount} icon={Send} color="text-violet-500" testId="stat-published" />
                    <StatCard label="Median draft → publish" value={data.workflow.medianDraftToPublishDays == null ? "—" : `${data.workflow.medianDraftToPublishDays}d`} hint="business days" icon={Timer} color="text-blue-500" testId="stat-cycle-time" />
                    <StatCard label="5-day SLA met" value={fmtPct(data.workflow.slaRatePct)} hint={`${data.workflow.slaSampleSize} reviews`} icon={GaugeCircle} color="text-emerald-500" testId="stat-sla" />
                    <StatCard label="Marketing rejection rate" value={fmtPct(data.workflow.marketingRejectionRatePct)} hint={`${data.workflow.marketingDecisionCount} decisions`} icon={ThumbsDown} color="text-rose-500" testId="stat-rejection-rate" />
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Audience</h2>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <StatCard label="Views" value={data.audience.views} icon={Eye} color="text-primary" testId="stat-views" />
                    <StatCard label="CTA clicks" value={data.audience.ctaClicks} hint={data.audience.ctaRatePct == null ? undefined : `${data.audience.ctaRatePct}% of views`} icon={MousePointerClick} color="text-orange-500" testId="stat-cta-clicks" />
                    <StatCard label="Reactions" value={data.audience.totalReactions} icon={Heart} color="text-rose-500" testId="stat-reactions" />
                    <StatCard label="Confirmed subscribers" value={data.subscribers.confirmed} hint={`+${data.subscribers.newThisMonth} new this month`} icon={Users} color="text-teal-500" testId="stat-subscribers" />
                  </div>
                </section>

                <Card>
                  <CardHeader><CardTitle className="text-base">Reactions by type</CardTitle></CardHeader>
                  <CardContent>
                    {data.audience.reactionsByType.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground" data-testid="text-no-reactions">No reactions in this period yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {INSIGHT_REACTIONS.map((r) => {
                          const found = data.audience.reactionsByType.find((x) => x.reactionType === r.value);
                          return (
                            <div key={r.value} className="flex flex-col items-center gap-1 rounded-lg border p-4 text-center" data-testid={`reaction-${r.value}`}>
                              <span className="text-2xl">{r.emoji}</span>
                              <span className="text-xl font-bold tabular-nums">{found?.count ?? 0}</span>
                              <span className="text-xs text-muted-foreground">{r.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Top articles by views</CardTitle></CardHeader>
                    <CardContent>
                      {data.topArticles.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground" data-testid="text-no-top-articles">No views recorded yet.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Article</TableHead>
                              <TableHead className="text-right">Views</TableHead>
                              <TableHead className="text-right">Reactions</TableHead>
                              <TableHead className="text-right">CTA clicks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.topArticles.map((a) => (
                              <TableRow key={a.id} data-testid={`row-top-article-${a.id}`}>
                                <TableCell className="max-w-[220px] truncate font-medium">{a.title}</TableCell>
                                <TableCell className="text-right tabular-nums">{a.views}</TableCell>
                                <TableCell className="text-right tabular-nums">{a.reactions}</TableCell>
                                <TableCell className="text-right tabular-nums" data-testid={`text-cta-${a.id}`}>{a.ctaClicks}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Author leaderboard</CardTitle></CardHeader>
                    <CardContent>
                      {data.authorLeaderboard.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground" data-testid="text-no-authors">No published articles in this period.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Author</TableHead>
                              <TableHead className="text-right">Published</TableHead>
                              <TableHead className="text-right">Avg reactions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.authorLeaderboard.map((a, i) => (
                              <TableRow key={a.authorProfileId ?? `none-${i}`} data-testid={`row-author-${a.authorProfileId ?? "none"}`}>
                                <TableCell className="flex items-center gap-2 font-medium">
                                  {i === 0 && <Star className="h-3.5 w-3.5 text-amber-500" />}
                                  {a.authorName}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{a.published}</TableCell>
                                <TableCell className="text-right tabular-nums" data-testid={`text-avg-reactions-${a.authorProfileId ?? "none"}`}>{a.avgReactionsPerArticle}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Newspaper className="h-4 w-4 text-muted-foreground" />
                      Category breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.categoryBreakdown.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground" data-testid="text-no-categories">No published articles in this period.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Published</TableHead>
                            <TableHead className="text-right">Avg views</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.categoryBreakdown.map((c) => (
                            <TableRow key={c.category} data-testid={`category-${c.category}`}>
                              <TableCell className="font-medium">{c.category === "uncategorized" ? "Uncategorized" : insightCategoryLabel(c.category)}</TableCell>
                              <TableCell className="text-right tabular-nums">{c.published}</TableCell>
                              <TableCell className="text-right tabular-nums" data-testid={`text-avg-views-${c.category}`}>{c.avgViewsPerCategory}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                      Campaign attribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!attribution?.length ? (
                      <p className="py-4 text-center text-sm text-muted-foreground" data-testid="text-no-attribution">No campaign has published content with engagement yet.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Published</TableHead>
                            <TableHead className="text-right">Reactions</TableHead>
                            <TableHead className="text-right">CTA clicks</TableHead>
                            <TableHead>Top reaction</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attribution.map((c) => (
                            <TableRow key={c.campaignId} data-testid={`row-attribution-${c.campaignId}`}>
                              <TableCell className="max-w-[220px] truncate font-medium">{c.campaignName}</TableCell>
                              <TableCell className="capitalize text-muted-foreground">{c.status}</TableCell>
                              <TableCell className="text-right tabular-nums">{c.articleCount}</TableCell>
                              <TableCell className="text-right tabular-nums">{c.totalReactions}</TableCell>
                              <TableCell className="text-right tabular-nums" data-testid={`text-attr-clicks-${c.campaignId}`}>{c.ctaClicks}</TableCell>
                              <TableCell data-testid={`text-attr-top-${c.campaignId}`}>{reactionEmoji(c.topReaction)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Feedback tab */}
          <TabsContent value="feedback" className="mt-6">
            {isHrAdmin ? (
              <FeedbackInsightsPanel />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground" data-testid="text-feedback-restricted">
                <p className="text-sm">Feedback Insights are visible to HR, Admin, and Super Admin roles.</p>
              </div>
            )}
          </TabsContent>

          {/* AI Spend tab */}
          <TabsContent value="ai-spend" className="mt-6">
            {canSpend ? (
              <SpendDashboard />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground" data-testid="text-spend-restricted">
                <p className="text-sm">AI Spend data is restricted to users with spend dashboard access.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
