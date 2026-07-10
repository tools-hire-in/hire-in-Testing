import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Eye,
  MousePointerClick,
  Heart,
  Star,
  Users,
  Newspaper,
} from "lucide-react";
import type { StudioProject } from "@shared/schema";
import { INSIGHT_REACTIONS, insightCategoryLabel } from "@shared/insights";
import { useStudioProject } from "./useStudioProject";
import { StudioTip } from "@/components/studio/StudioTip";

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

const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
];

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

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

export default function StudioAnalytics() {
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } = useStudioProject();
  const [range, setRange] = useState<string>("90");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Resolve the active preset / custom range into date_from / date_to query params.
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

  const fmtPct = (v: number | null) => (v == null ? "—" : `${v}%`);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <StudioTip
          id="analytics-first-visit"
          title="How to read this page"
          body="Throughput shows how fast content moves through your pipeline; engagement shows how readers respond once it's live. Check weekly — trends matter more than single numbers."
        />
        {/* Header */}
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
                Workflow throughput and audience engagement across your content.
              </p>
            </div>
          </div>

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
        </div>

        {isLoading || !data ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Workflow metrics */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Workflow
              </h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Published"
                  value={data.workflow.publishedCount}
                  icon={Send}
                  color="text-violet-500"
                  testId="stat-published"
                />
                <StatCard
                  label="Median draft → publish"
                  value={
                    data.workflow.medianDraftToPublishDays == null
                      ? "—"
                      : `${data.workflow.medianDraftToPublishDays}d`
                  }
                  hint="business days"
                  icon={Timer}
                  color="text-blue-500"
                  testId="stat-cycle-time"
                />
                <StatCard
                  label="5-day SLA met"
                  value={fmtPct(data.workflow.slaRatePct)}
                  hint={`${data.workflow.slaSampleSize} reviews`}
                  icon={GaugeCircle}
                  color="text-emerald-500"
                  testId="stat-sla"
                />
                <StatCard
                  label="Marketing rejection rate"
                  value={fmtPct(data.workflow.marketingRejectionRatePct)}
                  hint={`${data.workflow.marketingDecisionCount} decisions`}
                  icon={ThumbsDown}
                  color="text-rose-500"
                  testId="stat-rejection-rate"
                />
              </div>
            </section>

            {/* Audience metrics */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Audience
              </h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Views"
                  value={data.audience.views}
                  icon={Eye}
                  color="text-primary"
                  testId="stat-views"
                />
                <StatCard
                  label="CTA clicks"
                  value={data.audience.ctaClicks}
                  hint={data.audience.ctaRatePct == null ? undefined : `${data.audience.ctaRatePct}% of views`}
                  icon={MousePointerClick}
                  color="text-orange-500"
                  testId="stat-cta-clicks"
                />
                <StatCard
                  label="Reactions"
                  value={data.audience.totalReactions}
                  icon={Heart}
                  color="text-rose-500"
                  testId="stat-reactions"
                />
                <StatCard
                  label="Confirmed subscribers"
                  value={data.subscribers.confirmed}
                  hint={`+${data.subscribers.newThisMonth} new this month`}
                  icon={Users}
                  color="text-teal-500"
                  testId="stat-subscribers"
                />
              </div>
            </section>

            {/* Reactions breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reactions by type</CardTitle>
              </CardHeader>
              <CardContent>
                {data.audience.reactionsByType.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground" data-testid="text-no-reactions">
                    No reactions in this period yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {INSIGHT_REACTIONS.map((r) => {
                      const found = data.audience.reactionsByType.find((x) => x.reactionType === r.value);
                      return (
                        <div
                          key={r.value}
                          className="flex flex-col items-center gap-1 rounded-lg border p-4 text-center"
                          data-testid={`reaction-${r.value}`}
                        >
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
              {/* Top articles */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top articles by views</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topArticles.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground" data-testid="text-no-top-articles">
                      No views recorded yet.
                    </p>
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

              {/* Author leaderboard */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Author leaderboard</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.authorLeaderboard.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground" data-testid="text-no-authors">
                      No published articles in this period.
                    </p>
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
                          <TableRow
                            key={a.authorProfileId ?? `none-${i}`}
                            data-testid={`row-author-${a.authorProfileId ?? "none"}`}
                          >
                            <TableCell className="flex items-center gap-2 font-medium">
                              {i === 0 && <Star className="h-3.5 w-3.5 text-amber-500" />}
                              {a.authorName}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{a.published}</TableCell>
                            <TableCell
                              className="text-right tabular-nums"
                              data-testid={`text-avg-reactions-${a.authorProfileId ?? "none"}`}
                            >
                              {a.avgReactionsPerArticle}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Category breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Newspaper className="h-4 w-4 text-muted-foreground" />
                  Category breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.categoryBreakdown.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground" data-testid="text-no-categories">
                    No published articles in this period.
                  </p>
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
                          <TableCell className="font-medium">
                            {c.category === "uncategorized"
                              ? "Uncategorized"
                              : insightCategoryLabel(c.category)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{c.published}</TableCell>
                          <TableCell
                            className="text-right tabular-nums"
                            data-testid={`text-avg-views-${c.category}`}
                          >
                            {c.avgViewsPerCategory}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
