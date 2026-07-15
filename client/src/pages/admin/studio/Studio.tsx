import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Newspaper,
  FileEdit,
  Clock3,
  CheckCircle2,
  CalendarClock,
  Send,
  Globe,
  Star,
  Palette,
  Type,
  LayoutTemplate,
  Plus,
  Flame,
  Heart,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  BarChart2,
  Users,
  GitBranch,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Lightbulb,
  Share2,
  UserCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StudioProject, StudioBrandSettings, StudioContentIdea } from "@shared/schema";
import { useStudioProject } from "./useStudioProject";
import { ArticlesPanel } from "./ArticlesPanel";
import { AuthorsPanel } from "./AuthorsPanel";
import { StudioOnboardingChecklist } from "@/components/studio/StudioOnboardingChecklist";
import { StudioTip } from "@/components/studio/StudioTip";
import { studioPath } from "@/lib/studioBase";
import { RoutingSettings } from "./RoutingSettings";
import { NewsletterSettings } from "./NewsletterSettings";
import { RegenRequestsQueue } from "./ArticleRegenPanel";
import { LaunchControlPanel } from "./LaunchControlPanel";
import { usePermissions } from "@/hooks/use-permissions";

interface PulseItem {
  id: string;
  title: string;
  slug: string;
  publishedAt: string | null;
  totalReactions: number;
  ctaClicks: number;
  score: number;
  campaign: { id: string; name: string } | null;
}

interface TriageArticle {
  id: string;
  title: string;
  status: string;
  updatedAt: string | null;
}

function ContentPipelineSummaryCard({ projectId }: { projectId: string }) {
  const STATUS_CHIPS = [
    { key: "idea", label: "Ideas", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    { key: "in_progress", label: "In Progress", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
    { key: "in_review", label: "In Review", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
    { key: "approved", label: "Approved", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  ] as const;

  const { data: ideas, isLoading } = useQuery<StudioContentIdea[]>({
    queryKey: ["/api/admin/studio/content-ideas", { projectId, _summary: true }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/content-ideas?projectId=${encodeURIComponent(projectId)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
    select: (data: any) => data ?? [],
  });

  const counts = useMemo(() => {
    const m: Record<string, number> = { idea: 0, in_progress: 0, in_review: 0, approved: 0 };
    for (const idea of (ideas ?? []) as StudioContentIdea[]) {
      if (idea.status in m) m[idea.status as string]++;
    }
    return m;
  }, [ideas]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Card data-testid="card-pipeline-summary">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4 text-violet-500" />
          Content Pipeline
          {!isLoading && total > 0 && (
            <span className="text-xs font-normal text-muted-foreground">{total} ideas total</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">No pipeline ideas yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {STATUS_CHIPS.map(({ key, label, cls }) => (
              <Link key={key} href={`/studio/table?status=${key}`}>
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 ${cls}`}
                  data-testid={`pipeline-chip-${key}`}
                >
                  <span className="tabular-nums font-bold">{counts[key]}</span>
                  {label}
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-2 text-right">
          <Link href="/studio/table">
            <span className="text-xs font-medium text-primary hover:underline" data-testid="link-pipeline-all">
              Open Pipeline →
            </span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TriageCard({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery<{ items: TriageArticle[] }>({
    queryKey: ["/api/admin/studio/articles", { projectId, status: "in_review", page: 1, limit: 5 }],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/studio/articles?projectId=${encodeURIComponent(projectId)}&status=in_review&page=1&limit=5`,
        { credentials: "include" },
      );
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled: !!projectId,
    select: (data: any) => ({ items: data?.items ?? [] }),
  });

  if (isLoading) return null;
  if (!data?.items.length) {
    return (
      <Card data-testid="card-triage-empty">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4 w-4 text-muted-foreground" />
            Review queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No articles awaiting review.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-triage">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="h-4 w-4 text-amber-500" />
          Needs your attention
          <span className="text-xs font-normal text-muted-foreground">awaiting review</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {data.items.map((a) => (
            <Link key={a.id} href={`/admin/studio/articles/${a.id}`}>
              <div
                className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
                data-testid={`row-triage-${a.id}`}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{a.title || "Untitled"}</span>
                <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">In review</Badge>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-2 text-right">
          <Link href="?tab=articles&status=in_review">
            <span className="text-xs font-medium text-primary hover:underline" data-testid="link-triage-all">
              See all →
            </span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ContentPulseCard({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery<{ periodStart: string; items: PulseItem[] }>({
    queryKey: ["/api/studio/analytics/pulse", { projectId, limit: "3" }],
    enabled: !!projectId,
  });

  return (
    <Card data-testid="card-content-pulse">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-orange-500" />
          Content pulse
          <span className="text-xs font-normal text-muted-foreground">this month's top performers</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.items.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground" data-testid="text-pulse-empty">
            No engagement yet this month — pulse lights up once readers react or click.
          </p>
        ) : (
          <div className="space-y-3">
            {data.items.map((item, i) => (
              <div key={item.id} className="flex items-center gap-3" data-testid={`row-pulse-${item.id}`}>
                <span className="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {item.totalReactions}</span>
                    <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {item.ctaClicks}</span>
                    {item.campaign && (
                      <Badge variant="outline" className="h-4 px-1.5 text-[10px]" data-testid={`badge-pulse-campaign-${item.id}`}>
                        {item.campaign.name}
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface JobIdeaSuggestion {
  articleTitle: string;
  angle: string;
  cluster: string;
  jobCount: number;
  bestRecruiter: string | null;
}

function OpenJobsIdeasPanel() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery<JobIdeaSuggestion[]>({
    queryKey: ["/api/studio/job-idea-suggestions"],
    enabled: open,
    staleTime: 4 * 60 * 60 * 1000,
  });

  return (
    <Card data-testid="card-open-jobs-ideas">
      <CardHeader
        className="cursor-pointer select-none pb-3"
        onClick={() => setOpen((o) => !o)}
        data-testid="button-toggle-job-ideas"
      >
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            From Your Open Jobs
            <span className="text-xs font-normal text-muted-foreground">
              AI-suggested article topics based on active job clusters
            </span>
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground" data-testid="text-job-ideas-empty">
              No active job clusters found — post some jobs to unlock AI topic suggestions here.
            </p>
          ) : (
            <div className="divide-y">
              {data.map((s, i) => (
                <div key={i} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0" data-testid={`row-job-idea-${i}`}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium text-sm leading-snug" data-testid={`text-idea-title-${i}`}>
                      {s.articleTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.angle}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="secondary" className="gap-1 text-[11px]">
                        <Briefcase className="h-3 w-3" />
                        {s.cluster}
                        {s.jobCount > 0 && (
                          <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold">
                            {s.jobCount}
                          </span>
                        )}
                      </Badge>
                      {s.bestRecruiter && (
                        <Badge variant="outline" className="gap-1 text-[11px]">
                          <UserCircle className="h-3 w-3" />
                          Ask {s.bestRecruiter}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <a
                    href={`/admin/studio?tab=articles&new=1&title=${encodeURIComponent(s.articleTitle)}&brief=${encodeURIComponent(s.angle)}`}
                    className="shrink-0"
                    data-testid={`link-job-idea-use-${i}`}
                    title="Pre-fill a new article brief with this idea"
                  >
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Use this idea
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface StudioStats {
  totalArticles: number;
  byStatus: Record<string, number>;
  pendingReviews: number;
  scheduled: number;
  published: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  ready_to_export: "Ready to Export",
};

const STATUS_META: { key: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { key: "draft", icon: FileEdit, color: "text-slate-500" },
  { key: "in_review", icon: Clock3, color: "text-amber-500" },
  { key: "approved", icon: CheckCircle2, color: "text-emerald-500" },
  { key: "scheduled", icon: CalendarClock, color: "text-blue-500" },
  { key: "published", icon: Send, color: "text-violet-500" },
  { key: "ready_to_export", icon: Newspaper, color: "text-orange-500" },
];

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  testId,
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  testId: string;
  href?: string;
}) {
  const inner = (
    <Card data-testid={testId} className={href ? "cursor-pointer transition-shadow hover:shadow-md" : ""}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`shrink-0 ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums" data-testid={`${testId}-value`}>
            {value}
          </div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

function NewProjectDialog({ onCreated }: { onCreated?: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [publishesToInsights, setPublishesToInsights] = useState(false);
  const [brandColor, setBrandColor] = useState("#1F3A6E");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/studio/projects", {
        name, slug, description, publishesToInsights, brandColor,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create project");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Project created" });
      setOpen(false);
      setName(""); setSlug(""); setDescription(""); setPublishesToInsights(false); setBrandColor("#1F3A6E");
      onCreated?.();
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-new-project">
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Name</Label>
            <Input id="proj-name" value={name} onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
            }} placeholder="Hire'in Insights" data-testid="input-project-name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-slug">URL slug</Label>
            <Input id="proj-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="hirein-insights" data-testid="input-project-slug" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">Description (optional)</Label>
            <Textarea id="proj-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-project-desc" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-brand-color">Brand color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="proj-brand-color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-input p-0.5"
                data-testid="input-project-brand-color"
              />
              <Input
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                placeholder="#1F3A6E"
                className="font-mono text-sm"
                data-testid="input-project-brand-color-text"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={publishesToInsights} onChange={(e) => setPublishesToInsights(e.target.checked)} data-testid="check-publishes-insights" />
            Publishes to public Insights page
          </label>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim() || !slug.trim()} className="w-full" data-testid="button-create-project">
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        <Badge variant="outline" className="mt-2">
          Coming soon
        </Badge>
      </CardContent>
    </Card>
  );
}

const CARD_MATRIX: { layout: string; platforms: string[] }[] = [
  { layout: "standard", platforms: ["LinkedIn", "Instagram square", "Instagram story", "X / Twitter"] },
  { layout: "checklist", platforms: ["LinkedIn", "Instagram square"] },
  { layout: "quote", platforms: ["LinkedIn", "Instagram square", "X / Twitter"] },
];

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-3" data-testid={`swatch-${name.toLowerCase().replace(/\s+/g, "-")}`}>
      <div
        className="h-10 w-10 shrink-0 rounded-md border"
        style={{ backgroundColor: value }}
      />
      <div className="min-w-0">
        <div className="text-sm font-medium">{name}</div>
        <div className="font-mono text-xs uppercase text-muted-foreground">{value}</div>
      </div>
    </div>
  );
}

function BrandReference({ brand }: { brand?: StudioBrandSettings }) {
  const navy = brand?.navy ?? "#1F3A6E";
  const orangePrimary = brand?.orangePrimary ?? "#F47C20";
  const orangeAccent = brand?.orangeAccent ?? "#F96D3E";
  const white = brand?.white ?? "#FFFFFF";
  const softGray = brand?.softGray ?? "#F2F4F7";
  const headingFont = brand?.headingFont ?? "Playfair Display";
  const bodyFont = brand?.bodyFont ?? "Inter";
  const brandName = brand?.brandName ?? "Hire'in Solutions";
  const tagline = brand?.tagline ?? "Smart Solutions. Stronger Teams.";

  return (
    <>
      <Card data-testid="card-brand-reference">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-orange-500" />
            Brand reference
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            The live {brandName} palette and typography used by social-card templates.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Color palette
            </h4>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <Swatch name="Navy" value={navy} />
              <Swatch name="Orange" value={orangePrimary} />
              <Swatch name="Orange Accent" value={orangeAccent} />
              <Swatch name="White" value={white} />
              <Swatch name="Soft Gray" value={softGray} />
            </div>
          </div>

          <div>
            <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Type className="h-3.5 w-3.5" />
              Typography
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4" data-testid="font-heading">
                <div className="text-2xl" style={{ fontFamily: `'${headingFont}', serif` }}>
                  {brandName}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Headings · {headingFont}</div>
              </div>
              <div className="rounded-lg border p-4" data-testid="font-body">
                <div className="text-base" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>
                  {tagline}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Body · {bodyFont}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-template-matrix">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutTemplate className="h-4 w-4 text-violet-500" />
            Social-card templates
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Self-contained, on-brand card templates (family <code>hirein-v1</code>) seeded for every project.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {CARD_MATRIX.map((m) => (
            <div key={m.layout} className="flex flex-wrap items-center gap-2" data-testid={`matrix-row-${m.layout}`}>
              <span className="w-24 text-sm font-medium capitalize">{m.layout}</span>
              {m.platforms.map((p) => (
                <Badge key={p} variant="secondary">
                  {p}
                </Badge>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// SpendDashboard — super admin view of AI generation costs
// ---------------------------------------------------------------------------
interface SpendSummary {
  monthly: Array<{ month: string; total_cost_usd: string; generation_count: string }>;
  byModel: Array<{ model_name: string; total_cost_usd: string; generation_count: string }>;
  byKind: Array<{ kind: string; total_cost_usd: string; generation_count: string }>;
  topArticles: Array<{ article_id: string; title: string | null; total_cost_usd: string; generation_count: string }>;
  byUser: Array<{ generated_by_user_id: string; user_name: string | null; total_cost_usd: string; generation_count: string }>;
  dailySeries: Array<{ day: string; total_cost_usd: string; generation_count: string }>;
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

  // Daily sparkline bar heights (normalized)
  const maxDailyCost = Math.max(...data.dailySeries.map((d) => parseFloat(d.total_cost_usd)), 0.0001);

  const fmt = (n: number) => n < 0.001 ? "<$0.001" : `$${n.toFixed(4)}`;
  const fmtLarge = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-6" data-testid="section-spend-dashboard">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">AI Spend Dashboard</h2>
        <p className="text-sm text-muted-foreground">Cost tracking for all studio AI generations. Visible only to super admins.</p>
      </div>

      {/* Summary cards */}
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

      {/* 30-day sparkline */}
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
        {/* By model */}
        <Card data-testid="card-spend-by-model">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This month by model</CardTitle>
          </CardHeader>
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

        {/* By kind */}
        <Card data-testid="card-spend-by-kind">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This month by type</CardTitle>
          </CardHeader>
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

        {/* Top articles */}
        <Card data-testid="card-spend-top-articles">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top articles by cost (all time)</CardTitle>
          </CardHeader>
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

        {/* By user */}
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

export default function Studio() {
  const [location] = useLocation();
  // wouter useLocation returns the path only; search params live on window.location.search.
  const tabFromUrl = new URLSearchParams(window.location.search).get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl ?? "dashboard");
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } = useStudioProject();
  const { can, role } = usePermissions();
  const canManageSettings = can("studio.manage_settings");
  const canSpendDashboard = can("studio.spend_dashboard");
  const canCreate = can("studio.create_article");
  const isSuperAdmin = role === "super_admin";

  // Sync tab when URL search param changes (e.g. clicking a clickable stat card).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && t !== activeTab) {
      setActiveTab(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const { data: stats, isLoading: statsLoading } = useQuery<StudioStats>({
    queryKey: ["/api/admin/studio/stats", selectedProjectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/studio/stats${selectedProjectId ? `?projectId=${selectedProjectId}` : ""}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: brand } = useQuery<StudioBrandSettings | null>({
    queryKey: ["/api/admin/studio/brand"],
  });

  const { data: brandVoice } = useQuery<{ config: Record<string, unknown> | null }>({
    queryKey: ["/api/studio/projects", selectedProjectId, "brand-voice"],
    enabled: !!selectedProjectId,
  });

  const selectedProject = useMemo(
    () => projects?.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Newspaper className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-studio-title">
                Content Studio
              </h1>
              <p className="text-sm text-muted-foreground">
                Plan, write, review, and publish marketing content.
              </p>
            </div>
          </div>

          {/* Project switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Project</span>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              disabled={projectsLoading || !projects?.length}
            >
              <SelectTrigger className="w-[220px]" data-testid="select-studio-project">
                <SelectValue placeholder={projectsLoading ? "Loading…" : "Select a project"} />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((p) => (
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

        {/* Sub-navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard" data-testid="tab-studio-dashboard">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="articles" data-testid="tab-studio-articles">
              Articles
            </TabsTrigger>
            <TabsTrigger value="authors" data-testid="tab-studio-authors">
              Authors
            </TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-studio-projects">
              Projects
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-studio-analytics">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-studio-settings">
              Settings
            </TabsTrigger>
            {canSpendDashboard && (
              <TabsTrigger value="spend" data-testid="tab-studio-spend">
                AI Spend
              </TabsTrigger>
            )}
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            {statsLoading || !stats ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {selectedProjectId && (
                  <StudioOnboardingChecklist
                    projectId={selectedProjectId}
                    publishedCount={stats.published}
                  />
                )}
                {brandVoice && !brandVoice.config && (
                  <StudioTip
                    id="dashboard-brand-voice"
                    title="AI is running on default voice"
                    body="Configure your Brand Voice in Settings to make every generated piece sound like your brand — not like everyone else's AI."
                    action={{ label: "Configure Brand Voice", href: studioPath("/settings/brand-voice") }}
                  />
                )}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Content pipeline</p>
                  {canCreate && (
                    <Link href="?tab=articles&new=1">
                      <Button size="sm" data-testid="button-write-something">
                        <Plus className="mr-1.5 h-4 w-4" />
                        Write something
                      </Button>
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  <StatCard
                    label="Total Articles"
                    value={stats.totalArticles}
                    icon={Newspaper}
                    color="text-primary"
                    testId="stat-total"
                    href={`?tab=articles`}
                  />
                  <StatCard
                    label="Pending Reviews"
                    value={stats.pendingReviews}
                    icon={Clock3}
                    color="text-amber-500"
                    testId="stat-pending-reviews"
                    href={`?tab=articles&status=in_review`}
                  />
                  <StatCard
                    label="Scheduled"
                    value={stats.scheduled}
                    icon={CalendarClock}
                    color="text-blue-500"
                    testId="stat-scheduled"
                    href={`?tab=articles&status=scheduled`}
                  />
                  <StatCard
                    label="Published"
                    value={stats.published}
                    icon={Send}
                    color="text-violet-500"
                    testId="stat-published"
                    href={`?tab=articles&status=published`}
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pipeline by status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                      {STATUS_META.map(({ key, icon: Icon, color }) => (
                        <Link key={key} href={`?tab=articles&status=${key}`}>
                          <div
                            className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 text-center transition-shadow hover:shadow-md"
                            data-testid={`pipeline-${key}`}
                          >
                            <Icon className={`h-5 w-5 ${color}`} />
                            <span className="text-xl font-bold tabular-nums">
                              {stats.byStatus[key] ?? 0}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {STATUS_LABELS[key]}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                    {stats.totalArticles === 0 && (
                      <div className="mt-4 text-center text-sm text-muted-foreground">
                        <p>No articles yet for {selectedProject?.name ?? "this project"}.</p>
                        <Link href={studioPath("/guide")}>
                          <span className="mt-1 inline-block cursor-pointer font-medium text-primary hover:underline" data-testid="link-empty-playbook">
                            Read the Studio Playbook →
                          </span>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <ContentPipelineSummaryCard projectId={selectedProjectId} />
                <TriageCard projectId={selectedProjectId} />
                <ContentPulseCard projectId={selectedProjectId} />
                <OpenJobsIdeasPanel />
              </>
            )}
          </TabsContent>

          {/* Articles */}
          <TabsContent value="articles" className="mt-6">
            {selectedProjectId ? (
              <ArticlesPanel
                projectId={selectedProjectId}
                initialStatus={new URLSearchParams(window.location.search).get("status") ?? undefined}
              />
            ) : (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </TabsContent>

          {/* Authors */}
          <TabsContent value="authors" className="mt-6">
            {selectedProjectId ? (
              <AuthorsPanel projectId={selectedProjectId} />
            ) : (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </TabsContent>

          {/* Projects */}
          <TabsContent value="projects" className="mt-6">
            {canManageSettings && (
              <div className="mb-4 flex justify-end">
                <NewProjectDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/projects"] })} />
              </div>
            )}
            {projectsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects?.map((p) => (
                  <Card key={p.id} data-testid={`card-project-${p.id}`}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-8 w-8 shrink-0 rounded-md"
                            style={{ backgroundColor: p.brandColor ?? "#1F3A6E" }}
                          />
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold">
                              {p.name}
                              {p.isPrimary && <Star className="h-3.5 w-3.5 text-amber-500" />}
                            </div>
                            <div className="text-xs text-muted-foreground">/{p.slug}</div>
                          </div>
                        </div>
                        <Badge variant={p.isActive ? "default" : "secondary"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {p.description && (
                        <p className="text-sm text-muted-foreground">{p.description}</p>
                      )}
                      {p.publishesToInsights && (
                        <Badge variant="outline" className="gap-1">
                          <Globe className="h-3 w-3" />
                          Publishes to Insights
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics */}
          <TabsContent value="analytics" className="mt-6">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <h3 className="text-lg font-semibold">Content Analytics</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  Track workflow throughput, views, reactions, CTA clicks, and newsletter growth
                  across your content.
                </p>
                <Link href="/admin/studio/analytics">
                  <Button data-testid="button-open-analytics">Open analytics dashboard</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Spend Dashboard — super admin only */}
          {canSpendDashboard && (
            <TabsContent value="spend" className="mt-6">
              <SpendDashboard />
            </TabsContent>
          )}

          {/* Settings */}
          <TabsContent value="settings" className="mt-6 space-y-6">
            <BrandReference brand={brand ?? undefined} />
            {!canManageSettings ? (
              <ComingSoon
                title="Studio Settings"
                description="You don't have permission to manage studio settings."
              />
            ) : !selectedProjectId ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold" data-testid="text-routing-heading">
                    Review Routing
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Route articles to reviewer pools by category for{" "}
                    {selectedProject?.name ?? "this project"}.
                  </p>
                </div>
                <RoutingSettings projectId={selectedProjectId} />

                <div className="border-t pt-4">
                  <h2 className="text-lg font-semibold" data-testid="text-templates-heading">
                    Social Card Templates
                  </h2>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Manage the branded card variants rendered when articles are approved.
                  </p>
                  <Link href="/admin/studio/settings/templates">
                    <Button variant="outline" data-testid="button-manage-templates">
                      Manage card templates
                    </Button>
                  </Link>
                </div>

                <NewsletterSettings />

                {isSuperAdmin && (
                  <div className="border-t pt-4" data-testid="section-regen-requests">
                    <h2 className="text-lg font-semibold mb-1">Regeneration Requests</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Review and approve requests from content editors to regenerate or rework articles.
                    </p>
                    <RegenRequestsQueue />
                  </div>
                )}

                <LaunchControlPanel />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
