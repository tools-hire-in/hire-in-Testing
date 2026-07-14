import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useStudioProject } from "@/pages/admin/studio/useStudioProject";
import { studioPath } from "@/lib/studioBase";
import { StudioTip } from "@/components/studio/StudioTip";
import {
  STUDIO_CAMPAIGN_STATUSES,
  STUDIO_FUNNEL_STAGES,
  STUDIO_CHANNELS,
  STUDIO_PILLARS,
  STUDIO_PIPELINE_CONTENT_TYPES,
  STUDIO_IDEA_STATUSES,
} from "@shared/studioContent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Megaphone, Plus, Sparkles, Loader2, CalendarDays, Trash2, UserPlus, Users, Trophy, MousePointerClick, Heart, Recycle } from "lucide-react";
import { FieldHelp } from "@/components/studio/FieldHelp";
import { StudioShell } from "@/components/studio/StudioShell";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

interface CampaignRow {
  id: string;
  projectId: string;
  name: string;
  brief: string | null;
  icp: string | null;
  goal: string | null;
  funnelStage: string | null;
  primaryCta: string | null;
  channels: string[] | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  contributorUserIds: string[] | null;
  ideaCounts?: { total: number; done: number };
  ideas?: any[];
}

function CampaignFormDialog({
  open, onOpenChange, projectId, existing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  existing?: CampaignRow | null;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    brief: existing?.brief ?? "",
    icp: existing?.icp ?? "",
    goal: existing?.goal ?? "",
    funnelStage: existing?.funnelStage ?? "awareness",
    primaryCta: existing?.primaryCta ?? "",
    startDate: existing?.startDate ?? "",
    endDate: existing?.endDate ?? "",
    status: existing?.status ?? "draft",
    channels: (existing?.channels as string[]) ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const body: any = {
        ...form,
        projectId,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      };
      if (existing) {
        return apiRequest("PATCH", `/api/studio/campaigns/${existing.id}`, body);
      }
      return apiRequest("POST", "/api/studio/campaigns", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/campaigns"] });
      onOpenChange(false);
      toast({ title: existing ? "Campaign updated" : "Campaign created" });
    },
    onError: (e: any) => toast({ title: "Failed to save campaign", description: e?.message, variant: "destructive" }),
  });

  const toggleChannel = (c: string) =>
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c],
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit campaign" : "New campaign"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-campaign-name" />
          </div>
          <div>
            <Label>Brief (what is this campaign about?)</Label>
            <Textarea rows={3} value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} data-testid="input-campaign-brief" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Goal</Label>
              <Input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} data-testid="input-campaign-goal" />
            </div>
            <div>
              <Label className="flex items-center gap-1.5">Primary CTA <FieldHelp id="campaign-primary-cta" /></Label>
              <Input value={form.primaryCta} onChange={(e) => setForm({ ...form, primaryCta: e.target.value })} data-testid="input-campaign-cta" />
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1.5">Ideal customer profile (one line) <FieldHelp id="campaign-icp" /></Label>
            <Input value={form.icp} onChange={(e) => setForm({ ...form, icp: e.target.value })} data-testid="input-campaign-icp" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1.5">Funnel stage <FieldHelp id="campaign-funnel-stage" /></Label>
              <Select value={form.funnelStage} onValueChange={(v) => setForm({ ...form, funnelStage: v })}>
                <SelectTrigger data-testid="select-campaign-funnel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STUDIO_FUNNEL_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="select-campaign-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STUDIO_CAMPAIGN_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} data-testid="input-campaign-start" />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} data-testid="input-campaign-end" />
            </div>
          </div>
          <div>
            <Label>Channels</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {STUDIO_CHANNELS.map((c) => (
                <Badge
                  key={c}
                  variant={form.channels.includes(c) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleChannel(c)}
                  data-testid={`badge-campaign-channel-${c}`}
                >
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!form.name.trim() || save.isPending}
            data-testid="button-save-campaign"
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PlanSuggestion {
  topic: string;
  contentType: string;
  channels: string[];
  pillar: string | null;
  suggestedDate: string | null;
  brief: string;
}

/** Editable preview of the AI-proposed plan. Nothing is written until Confirm. */
function PlanPreviewDialog({
  open, onOpenChange, campaignId, summary, initialSuggestions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  summary: string;
  initialSuggestions: PlanSuggestion[];
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<PlanSuggestion[]>(initialSuggestions);

  const update = (i: number, patch: Partial<PlanSuggestion>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { topic: "", contentType: "social_post", channels: [], pillar: null, suggestedDate: null, brief: "" },
    ]);

  const channelsForType = (contentType: string): string[] => {
    const cfg = STUDIO_PIPELINE_CONTENT_TYPES.find((t) => t.value === contentType);
    return cfg ? [...cfg.channels] : [...STUDIO_CHANNELS];
  };

  const confirm = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/studio/campaigns/${campaignId}/confirm-plan`, { suggestions: rows }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/studio/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      onOpenChange(false);
      toast({
        title: `${data.created} idea(s) added to the plan`,
        description: "They appear below and in the pipeline as dashed 'suggested' cards. Accept or discard each one.",
      });
    },
    onError: (e: any) => toast({ title: "Failed to confirm plan", description: e?.message, variant: "destructive" }),
  });

  const invalidRows = rows.some((r) => !r.topic.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review the AI-proposed plan</DialogTitle>
        </DialogHeader>
        {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
        <p className="text-xs text-muted-foreground">
          Edit, remove, or add rows before confirming. Nothing is created until you confirm.
        </p>
        <div className="space-y-3">
          {rows.map((row, i) => {
            const allowed = channelsForType(row.contentType);
            return (
              <div key={i} className="rounded-md border p-3" data-testid={`row-plan-suggestion-${i}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="grid flex-1 gap-2">
                    <div>
                      <Label className="text-xs">Topic</Label>
                      <Input
                        className="mt-1"
                        value={row.topic}
                        onChange={(e) => update(i, { topic: e.target.value })}
                        data-testid={`input-plan-topic-${i}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={row.contentType}
                          onValueChange={(v) => {
                            const nextAllowed = channelsForType(v);
                            update(i, {
                              contentType: v,
                              channels: row.channels.filter((c) => nextAllowed.includes(c)),
                            });
                          }}
                        >
                          <SelectTrigger className="mt-1" data-testid={`select-plan-type-${i}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STUDIO_PIPELINE_CONTENT_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Pillar</Label>
                        <Select
                          value={row.pillar ?? "none"}
                          onValueChange={(v) => update(i, { pillar: v === "none" ? null : v })}
                        >
                          <SelectTrigger className="mt-1" data-testid={`select-plan-pillar-${i}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No pillar</SelectItem>
                            {STUDIO_PILLARS.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Due date</Label>
                        <Input
                          type="date"
                          className="mt-1"
                          value={row.suggestedDate ?? ""}
                          onChange={(e) => update(i, { suggestedDate: e.target.value || null })}
                          data-testid={`input-plan-date-${i}`}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Channels</Label>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {allowed.map((c) => (
                          <Badge
                            key={c}
                            variant={row.channels.includes(c) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() =>
                              update(i, {
                                channels: row.channels.includes(c)
                                  ? row.channels.filter((x) => x !== c)
                                  : [...row.channels, c],
                              })
                            }
                            data-testid={`badge-plan-channel-${i}-${c}`}
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Brief / angle</Label>
                      <Textarea
                        rows={2}
                        className="mt-1"
                        value={row.brief}
                        onChange={(e) => update(i, { brief: e.target.value })}
                        data-testid={`input-plan-brief-${i}`}
                      />
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeRow(i)} data-testid={`button-remove-suggestion-${i}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <Button size="sm" variant="outline" onClick={addRow} data-testid="button-add-suggestion">
          <Plus className="mr-1 h-4 w-4" /> Add row
        </Button>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Discard</Button>
          <Button
            onClick={() => confirm.mutate()}
            disabled={!rows.length || invalidRows || confirm.isPending}
            data-testid="button-confirm-plan"
          >
            {confirm.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {rows.length} idea(s) to plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CampaignAnalyticsData {
  campaignId: string;
  campaignName: string;
  ideasByStatus: Record<string, number>;
  totalIdeas: number;
  publishedArticles: {
    id: string;
    title: string;
    slug: string;
    publishedAt: string | null;
    ctaClicks: number;
    reactionCounts: Record<string, number>;
    totalReactions: number;
  }[];
  engagementMatrix: {
    medianReactions: number;
    medianClicks: number;
    points: { articleId: string; title: string; reactions: number; clicks: number; quadrant: string }[];
  };
}

const QUADRANT_META: Record<string, { label: string; hint: string; tone: string }> = {
  resonates_converts: {
    label: "Resonates & converts",
    hint: "Double down on these themes",
    tone: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
  },
  resonates_fix_cta: {
    label: "Resonates, weak CTA",
    hint: "Loved but not clicked — fix the CTA",
    tone: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
  },
  converts_low_resonance: {
    label: "Converts, low resonance",
    hint: "Clicks without love — sharpen the hook",
    tone: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
  },
  revisit: {
    label: "Revisit",
    hint: "Low on both — rethink or retire",
    tone: "border-border bg-muted/40",
  },
};

const IDEA_STATUS_COLORS: Record<string, string> = {
  idea: "bg-slate-400",
  suggested: "bg-slate-300",
  in_review: "bg-amber-400",
  changes_requested: "bg-orange-400",
  approved: "bg-blue-400",
  in_production: "bg-violet-400",
  scheduled: "bg-cyan-400",
  done: "bg-emerald-500",
  discarded: "bg-rose-300",
};

function CampaignAnalyticsTab({ campaignId }: { campaignId: string }) {
  const { data, isLoading } = useQuery<CampaignAnalyticsData>({
    queryKey: ["/api/studio/campaigns", campaignId, "analytics"],
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground">No analytics available.</p>;

  const statusEntries = Object.entries(data.ideasByStatus).filter(([, n]) => n > 0);
  const maxScore = Math.max(
    1,
    ...data.publishedArticles.map((a) => a.totalReactions * 0.4 + a.ctaClicks * 0.6),
  );
  const top = data.publishedArticles[0];
  const topScore = top ? top.totalReactions * 0.4 + top.ctaClicks * 0.6 : 0;

  return (
    <div className="space-y-4">
      {/* Idea status distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Plan progress ({data.totalIdeas} idea{data.totalIdeas === 1 ? "" : "s"})</CardTitle>
        </CardHeader>
        <CardContent>
          {!statusEntries.length ? (
            <p className="text-sm text-muted-foreground">No ideas in this campaign yet.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex h-3 w-full overflow-hidden rounded-full" data-testid="bar-idea-status">
                {statusEntries.map(([status, n]) => (
                  <div
                    key={status}
                    className={IDEA_STATUS_COLORS[status] ?? "bg-slate-400"}
                    style={{ width: `${(n / data.totalIdeas) * 100}%` }}
                    title={`${status.replace(/_/g, " ")}: ${n}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {statusEntries.map(([status, n]) => (
                  <span key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`legend-status-${status}`}>
                    <span className={`h-2 w-2 rounded-full ${IDEA_STATUS_COLORS[status] ?? "bg-slate-400"}`} />
                    {status.replace(/_/g, " ")} · {n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top performer */}
      {top && topScore > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-amber-500" /> Top performer
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" data-testid="text-top-performer">{top.title}</p>
              <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {top.totalReactions} reactions</span>
                <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {top.ctaClicks} CTA clicks</span>
              </p>
            </div>
            <Link href={studioPath(`/articles/${top.id}/edit`)}>
              <Button size="sm" variant="outline" data-testid="button-repurpose-top">
                <Recycle className="mr-1 h-4 w-4" /> Repurpose →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Published article engagement */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Published content engagement</CardTitle>
        </CardHeader>
        <CardContent>
          {!data.publishedArticles.length ? (
            <p className="text-sm text-muted-foreground">
              Nothing from this campaign is published yet — engagement appears here once articles go live.
            </p>
          ) : (
            <div className="space-y-3">
              {data.publishedArticles.map((a) => {
                const score = a.totalReactions * 0.4 + a.ctaClicks * 0.6;
                return (
                  <div key={a.id} data-testid={`row-engagement-${a.id}`}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{a.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {a.totalReactions} ❤ · {a.ctaClicks} clicks
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.max(2, (score / maxScore) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2×2 engagement matrix */}
      {data.publishedArticles.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Engagement matrix</CardTitle>
            <p className="text-xs text-muted-foreground">
              Reactions (do people love it?) vs CTA clicks (does it convert?), split at the campaign median.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["resonates_converts", "resonates_fix_cta", "converts_low_resonance", "revisit"] as const).map((q) => {
                const meta = QUADRANT_META[q];
                const points = data.engagementMatrix.points.filter((p) => p.quadrant === q);
                return (
                  <div key={q} className={`rounded-md border p-3 ${meta.tone}`} data-testid={`quadrant-${q}`}>
                    <p className="text-xs font-semibold">{meta.label}</p>
                    <p className="text-[11px] text-muted-foreground">{meta.hint}</p>
                    <div className="mt-2 space-y-1">
                      {!points.length ? (
                        <p className="text-xs text-muted-foreground/70">—</p>
                      ) : (
                        points.map((p) => (
                          <p key={p.articleId} className="truncate text-xs" title={p.title}>
                            {p.title}
                            <span className="ml-1 text-muted-foreground">({p.reactions}❤ / {p.clicks}⤴)</span>
                          </p>
                        ))
                      )}
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

function CampaignDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canCreate = can("studio.create_article");
  const [editOpen, setEditOpen] = useState(false);

  const { data: campaign, isLoading } = useQuery<CampaignRow>({
    queryKey: ["/api/studio/campaigns", id],
  });

  const [preview, setPreview] = useState<{ summary: string; suggestions: PlanSuggestion[] } | null>(null);
  const [contributorPick, setContributorPick] = useState("");

  const { data: assignees } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/studio/assignees"],
  });

  const addContributor = useMutation({
    mutationFn: async (userId: string) =>
      apiRequest("POST", `/api/studio/campaigns/${id}/contributors`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/campaigns", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio/campaigns"] });
      setContributorPick("");
      toast({ title: "Contributor added", description: "They've been notified." });
    },
    onError: (e: any) => toast({ title: "Couldn't add contributor", description: e?.message, variant: "destructive" }),
  });

  const plan = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/studio/campaigns/${id}/generate-plan-preview`, { itemCount: 8 }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      if (!data.suggestions?.length) {
        toast({ title: "No usable suggestions", description: "The AI returned no valid ideas — try again.", variant: "destructive" });
        return;
      }
      setPreview({ summary: data.summary ?? "", suggestions: data.suggestions });
    },
    onError: (e: any) => toast({ title: "Planning failed", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!campaign) return <p className="text-sm text-muted-foreground">Campaign not found.</p>;

  const counts = campaign.ideaCounts ?? { total: 0, done: 0 };
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
  const todayIso = new Date().toISOString().slice(0, 10);
  const overdueCount = (campaign.ideas ?? []).filter(
    (i: any) => i.dueDate && i.dueDate < todayIso && i.status !== "done",
  ).length;

  return (
    <div className="space-y-4">
      {(campaign.ideas?.length ?? 0) === 0 && (
        <StudioTip
          id="campaign-no-ideas"
          title="This campaign has no content yet"
          body='Hit "AI-propose plan" — the AI drafts a full content plan from your brief, and nothing is added until you approve it.'
        />
      )}
      {overdueCount >= 3 && (
        <StudioTip
          id="campaign-overdue"
          variant="warning"
          title={`${overdueCount} items are overdue`}
          body="Overdue items pile up fast. Reschedule what slipped, or drop what no longer matters — a realistic calendar beats an ambitious one."
        />
      )}
      <div className="flex items-center gap-2">
        <Link href={studioPath("/campaigns")}>
          <Button variant="ghost" size="sm" data-testid="button-back-campaigns">
            <ArrowLeft className="mr-1 h-4 w-4" /> Campaigns
          </Button>
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-campaign-name">{campaign.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge className={STATUS_BADGE[campaign.status] ?? ""}>{campaign.status}</Badge>
            {campaign.funnelStage && <span>{campaign.funnelStage}</span>}
            {campaign.startDate && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {campaign.startDate}{campaign.endDate ? ` → ${campaign.endDate}` : ""}
              </span>
            )}
            <span data-testid="text-campaign-progress">{counts.done}/{counts.total} done ({pct}%)</span>
          </div>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-testid="button-edit-campaign">
              Edit
            </Button>
            <Button size="sm" onClick={() => plan.mutate()} disabled={plan.isPending} data-testid="button-plan-campaign">
              {plan.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              AI-propose plan
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-campaign-overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-campaign-analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4 space-y-4">

      {campaign.brief && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Brief</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{campaign.brief}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" /> Contributors ({(campaign.contributorUserIds ?? []).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {!(campaign.contributorUserIds ?? []).length && (
              <p className="text-sm text-muted-foreground">No contributors yet.</p>
            )}
            {(campaign.contributorUserIds ?? []).map((uid) => (
              <Badge key={uid} variant="secondary" data-testid={`badge-contributor-${uid}`}>
                {assignees?.find((a) => a.id === uid)?.name ?? "Unknown user"}
              </Badge>
            ))}
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              <Select value={contributorPick} onValueChange={setContributorPick}>
                <SelectTrigger className="h-8 w-56" data-testid="select-add-contributor">
                  <SelectValue placeholder="Add a contributor..." />
                </SelectTrigger>
                <SelectContent>
                  {(assignees ?? [])
                    .filter((a) => !(campaign.contributorUserIds ?? []).includes(a.id))
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!contributorPick || addContributor.isPending}
                onClick={() => addContributor.mutate(contributorPick)}
                data-testid="button-add-contributor"
              >
                {addContributor.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />}
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Campaign content ({campaign.ideas?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!campaign.ideas?.length ? (
            <p className="text-sm text-muted-foreground">
              No content yet. Use "AI-propose plan" to generate suggested ideas, or attach ideas from the pipeline.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2" data-testid="kanban-campaign-ideas">
              {STUDIO_IDEA_STATUSES
                .filter((status) => (campaign.ideas ?? []).some((i: any) => i.status === status))
                .map((status) => {
                  const column = (campaign.ideas ?? []).filter((i: any) => i.status === status);
                  return (
                    <div key={status} className="w-56 shrink-0" data-testid={`kanban-column-${status}`}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {status.replace(/_/g, " ")}
                        </p>
                        <Badge variant="outline" className="h-5 px-1.5 text-xs">{column.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {column.map((idea: any) => (
                          <Link
                            key={idea.id}
                            href={`${studioPath("/board")}?campaignId=${campaign.id}&idea=${idea.id}`}
                          >
                            <div
                              className={`cursor-pointer rounded-md border bg-card p-2 hover-elevate ${idea.status === "suggested" ? "border-dashed border-primary/60" : ""}`}
                              data-testid={`row-campaign-idea-${idea.id}`}
                            >
                              <p className="line-clamp-2 text-sm font-medium">{idea.topic}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {idea.contentType} · {(idea.channels ?? []).join(", ") || "no channels"}
                              </p>
                              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                                <span>{idea.dueDate ? `due ${idea.dueDate}` : idea.scheduledDate ? idea.scheduledDate : ""}</span>
                                {idea.assignedToUserId && (
                                  <span className="truncate pl-2">
                                    {assignees?.find((a) => a.id === idea.assignedToUserId)?.name ?? ""}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
          <div className="mt-3">
            <Link href={`${studioPath("/board")}?campaignId=${campaign.id}`}>
              <Button variant="outline" size="sm" data-testid="button-open-pipeline">
                Open in pipeline board
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <CampaignAnalyticsTab campaignId={campaign.id} />
        </TabsContent>
      </Tabs>

      {editOpen && (
        <CampaignFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          projectId={campaign.projectId}
          existing={campaign}
        />
      )}

      {preview && (
        <PlanPreviewDialog
          open={!!preview}
          onOpenChange={(v) => { if (!v) setPreview(null); }}
          campaignId={campaign.id}
          summary={preview.summary}
          initialSuggestions={preview.suggestions}
        />
      )}
    </div>
  );
}

export default function CampaignsView() {
  const [, params] = useRoute(studioPath("/campaigns/:id"));
  const { selectedProjectId } = useStudioProject();
  const { can } = usePermissions();
  const canCreate = can("studio.create_article");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: campaigns, isLoading } = useQuery<CampaignRow[]>({
    queryKey: ["/api/studio/campaigns", { projectId: selectedProjectId }],
    queryFn: async () => {
      const res = await fetch(`/api/studio/campaigns?projectId=${encodeURIComponent(selectedProjectId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  if (params?.id) return (
    <StudioShell>
      <CampaignDetail id={params.id} />
    </StudioShell>
  );

  return (
    <StudioShell>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Megaphone className="h-5 w-5 text-primary" /> Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">
            Group content around a marketing goal. The AI proposes plans; you decide what ships.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} data-testid="button-new-campaign">
            <Plus className="mr-1 h-4 w-4" /> New campaign
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      ) : !campaigns?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <p>No campaigns yet. Create one to start planning coordinated content.</p>
            <Link href={studioPath("/guide")}>
              <span className="mt-2 inline-block cursor-pointer font-medium text-primary hover:underline" data-testid="link-campaigns-playbook">
                Read the Studio Playbook →
              </span>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => {
            const counts = c.ideaCounts ?? { total: 0, done: 0 };
            const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
            return (
              <Link key={c.id} href={studioPath(`/campaigns/${c.id}`)}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md" data-testid={`card-campaign-${c.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <Badge className={STATUS_BADGE[c.status] ?? ""}>{c.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {c.goal && <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{c.goal}</p>}
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{counts.done}/{counts.total} done</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    {(c.startDate || c.endDate) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {c.startDate ?? "?"} → {c.endDate ?? "open"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {createOpen && selectedProjectId && (
        <CampaignFormDialog open={createOpen} onOpenChange={setCreateOpen} projectId={selectedProjectId} />
      )}
    </div>
    </StudioShell>
  );
}
