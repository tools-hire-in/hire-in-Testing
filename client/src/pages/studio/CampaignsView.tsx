import { useState, useEffect } from "react";
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
import {
  ArrowLeft, Megaphone, Plus, Sparkles, Loader2, CalendarDays, Trash2,
  UserPlus, Users, Trophy, MousePointerClick, Heart, Recycle, FileText,
  Share2, CheckCircle2, CalendarRange, AlertCircle,
} from "lucide-react";
import { FieldHelp } from "@/components/studio/FieldHelp";
import { StudioShell } from "@/components/studio/StudioShell";

// ─── Status & colour helpers ────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
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

const DURATION_PRESETS = [7, 14, 30] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

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
  durationDays: number | null;
  dailyPlanJsonb: DayPlanDay[] | null;
  status: string;
  contributorUserIds: string[] | null;
  ideaCounts?: { total: number; done: number };
  ideas?: any[];
  articles?: any[];
}

interface DayPlanItem {
  type: "social_post" | "article";
  platform: string;
  format: string;
  topic: string;
  keyMessage: string;
  // Set after confirm — the created idea/article id for linking
  ideaId?: string;
  articleId?: string;
}

interface DayPlanDay {
  dayNumber: number;
  date: string;
  items: DayPlanItem[];
}

interface PlanSuggestion {
  topic: string;
  contentType: string;
  channels: string[];
  pillar: string | null;
  suggestedDate: string | null;
  brief: string;
}

// ─── Campaign form dialog ────────────────────────────────────────────────────

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
    durationDays: existing?.durationDays ?? 14,
    customDuration: String(existing?.durationDays ?? 14),
    durationMode: (DURATION_PRESETS as readonly number[]).includes(existing?.durationDays ?? 14)
      ? String(existing?.durationDays ?? 14)
      : "custom",
  });

  const effectiveDuration =
    form.durationMode === "custom"
      ? Math.max(1, Math.min(90, Number(form.customDuration) || 14))
      : Number(form.durationMode);

  const save = useMutation({
    mutationFn: async () => {
      const body: any = {
        ...form,
        projectId,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        durationDays: effectiveDuration,
      };
      delete body.durationMode;
      delete body.customDuration;
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
    onError: (e: any) =>
      toast({ title: "Failed to save campaign", description: e?.message, variant: "destructive" }),
  });

  const toggleChannel = (c: string) =>
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c],
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit campaign" : "New campaign"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="input-campaign-name"
            />
          </div>
          <div>
            <Label>Brief (what is this campaign about?)</Label>
            <Textarea
              rows={3}
              value={form.brief}
              onChange={(e) => setForm({ ...form, brief: e.target.value })}
              data-testid="input-campaign-brief"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Goal</Label>
              <Input
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                data-testid="input-campaign-goal"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                Primary CTA <FieldHelp id="campaign-primary-cta" />
              </Label>
              <Input
                value={form.primaryCta}
                onChange={(e) => setForm({ ...form, primaryCta: e.target.value })}
                data-testid="input-campaign-cta"
              />
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1.5">
              Ideal customer profile (one line) <FieldHelp id="campaign-icp" />
            </Label>
            <Input
              value={form.icp}
              onChange={(e) => setForm({ ...form, icp: e.target.value })}
              data-testid="input-campaign-icp"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1.5">
                Funnel stage <FieldHelp id="campaign-funnel-stage" />
              </Label>
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

          {/* ── Duration picker (new — Task #1495) ── */}
          <div>
            <Label className="flex items-center gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" />
              Campaign duration (days)
            </Label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {DURATION_PRESETS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={form.durationMode === String(d) ? "default" : "outline"}
                  onClick={() => setForm({ ...form, durationMode: String(d), durationDays: d })}
                  data-testid={`button-duration-${d}`}
                >
                  {d} days
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={form.durationMode === "custom" ? "default" : "outline"}
                onClick={() => setForm({ ...form, durationMode: "custom" })}
                data-testid="button-duration-custom"
              >
                Custom
              </Button>
              {form.durationMode === "custom" && (
                <Input
                  type="number"
                  min={1}
                  max={90}
                  className="h-8 w-20"
                  value={form.customDuration}
                  onChange={(e) => setForm({ ...form, customDuration: e.target.value })}
                  placeholder="days"
                  data-testid="input-duration-custom"
                />
              )}
              <span className="text-xs text-muted-foreground">
                = {effectiveDuration} day{effectiveDuration !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div>
            <Label>Start date</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              data-testid="input-campaign-start"
            />
            <p className="mt-0.5 text-xs text-muted-foreground">
              Required for the AI Day Planner to assign content to specific dates.
            </p>
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

// ─── Day-by-day plan review dialog (new — Task #1495) ───────────────────────

function DayPlanReviewDialog({
  open, onOpenChange, campaignId, summary, initialPlan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  summary: string;
  initialPlan: DayPlanDay[];
}) {
  const { toast } = useToast();
  const [plan, setPlan] = useState<DayPlanDay[]>(initialPlan);

  const removeItem = (dayIdx: number, itemIdx: number) =>
    setPlan((prev) =>
      prev
        .map((d, di) =>
          di === dayIdx
            ? { ...d, items: d.items.filter((_, ii) => ii !== itemIdx) }
            : d
        )
        .filter((d) => d.items.length > 0)
    );

  const updateItem = (dayIdx: number, itemIdx: number, patch: Partial<DayPlanItem>) =>
    setPlan((prev) =>
      prev.map((d, di) =>
        di === dayIdx
          ? { ...d, items: d.items.map((it, ii) => (ii === itemIdx ? { ...it, ...patch } : it)) }
          : d
      )
    );

  const addItem = (dayIdx: number) =>
    setPlan((prev) =>
      prev.map((d, di) =>
        di === dayIdx
          ? {
              ...d,
              items: [
                ...d.items,
                { type: "social_post", platform: "", format: "post", topic: "", keyMessage: "" },
              ],
            }
          : d
      )
    );

  const addDay = () => {
    const lastDay = plan[plan.length - 1];
    const lastDate = lastDay ? lastDay.date : new Date().toISOString().slice(0, 10);
    const nextDate = new Date(new Date(lastDate + "T00:00:00").getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
    const nextDayNumber = lastDay ? lastDay.dayNumber + 1 : 1;
    setPlan((prev) => [
      ...prev,
      {
        dayNumber: nextDayNumber,
        date: nextDate,
        items: [{ type: "social_post", platform: "", format: "post", topic: "", keyMessage: "" }],
      },
    ]);
  };

  const totalItems = plan.reduce((acc, d) => acc + d.items.length, 0);

  // Flatten plan into suggestions format expected by confirm-plan endpoint
  const toSuggestions = (): PlanSuggestion[] =>
    plan.flatMap((d) =>
      d.items.map((it) => ({
        topic: it.topic,
        contentType: it.type,
        channels: it.type === "social_post" ? [it.platform] : [],
        pillar: null,
        suggestedDate: d.date,
        brief: it.keyMessage,
      }))
    );

  const confirm = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/studio/campaigns/${campaignId}/confirm-plan`, {
        suggestions: toSuggestions(),
        dayPlan: plan,
      }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/studio/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio/campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      onOpenChange(false);
      toast({
        title: `${data.created} content item(s) scheduled`,
        description: `${data.ideas?.length ?? 0} idea(s) and ${data.articles?.length ?? 0} article(s) created in the pipeline.`,
      });
    },
    onError: (e: any) =>
      toast({ title: "Failed to confirm plan", description: e?.message, variant: "destructive" }),
  });

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric",
      });
    } catch { return iso; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review your AI Day Plan
          </DialogTitle>
        </DialogHeader>
        {summary && (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{summary}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Edit topics, remove items, or keep as-is. Nothing is created until you confirm.
        </p>

        <div className="space-y-4">
          {plan.map((day, dayIdx) => (
            <div key={day.dayNumber} className="rounded-lg border" data-testid={`section-day-${day.dayNumber}`}>
              <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Day {day.dayNumber}</span>
                <span className="text-xs text-muted-foreground">— {fmtDate(day.date)}</span>
                <Badge variant="outline" className="ml-auto text-xs">{day.items.length} item{day.items.length !== 1 ? "s" : ""}</Badge>
              </div>
              <div className="divide-y">
                {day.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="space-y-2 p-3" data-testid={`row-day-item-${day.dayNumber}-${itemIdx}`}>
                    <div className="flex items-center gap-2">
                      {item.type === "article" ? (
                        <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                      ) : (
                        <Share2 className="h-4 w-4 shrink-0 text-violet-500" />
                      )}
                      <span className="flex-1 text-xs font-medium text-muted-foreground">Item {itemIdx + 1}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => removeItem(dayIdx, itemIdx)}
                        data-testid={`button-remove-item-${day.dayNumber}-${itemIdx}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[11px]">Type</Label>
                        <Select
                          value={item.type}
                          onValueChange={(v) => updateItem(dayIdx, itemIdx, { type: v as "social_post" | "article" })}
                        >
                          <SelectTrigger className="mt-0.5 h-7 text-xs" data-testid={`select-item-type-${day.dayNumber}-${itemIdx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="social_post">Social post</SelectItem>
                            <SelectItem value="article">Article</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px]">Platform</Label>
                        <Input
                          className="mt-0.5 h-7 text-xs"
                          value={item.platform}
                          onChange={(e) => updateItem(dayIdx, itemIdx, { platform: e.target.value })}
                          placeholder="linkedin, instagram..."
                          data-testid={`input-item-platform-${day.dayNumber}-${itemIdx}`}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Format</Label>
                        <Input
                          className="mt-0.5 h-7 text-xs"
                          value={item.format}
                          onChange={(e) => updateItem(dayIdx, itemIdx, { format: e.target.value })}
                          placeholder="carousel, story..."
                          data-testid={`input-item-format-${day.dayNumber}-${itemIdx}`}
                        />
                      </div>
                    </div>
                    <Input
                      className="h-8 text-sm"
                      value={item.topic}
                      onChange={(e) => updateItem(dayIdx, itemIdx, { topic: e.target.value })}
                      placeholder="Topic / headline"
                      data-testid={`input-item-topic-${day.dayNumber}-${itemIdx}`}
                    />
                    <Input
                      className="h-8 text-xs text-muted-foreground"
                      value={item.keyMessage}
                      onChange={(e) => updateItem(dayIdx, itemIdx, { keyMessage: e.target.value })}
                      placeholder="Key message"
                      data-testid={`input-item-msg-${day.dayNumber}-${itemIdx}`}
                    />
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 border-t bg-muted/30">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => addItem(dayIdx)}
                  data-testid={`button-add-item-day-${day.dayNumber}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add item
                </Button>
              </div>
            </div>
          ))}

          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 border-dashed"
            onClick={addDay}
            data-testid="button-add-day"
          >
            <Plus className="h-4 w-4" />
            Add day
          </Button>
        </div>

        {totalItems === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            All items removed. Cancel and regenerate, or close.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Discard</Button>
          <Button
            onClick={() => confirm.mutate()}
            disabled={!totalItems || confirm.isPending}
            data-testid="button-confirm-day-plan"
          >
            {confirm.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Confirm {totalItems} item{totalItems !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Legacy plan preview dialog (kept for backward compat) ────────────────────

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
        description: "They appear below and in the pipeline as suggested cards. Accept or discard each one.",
      });
    },
    onError: (e: any) =>
      toast({ title: "Failed to confirm plan", description: e?.message, variant: "destructive" }),
  });

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
                            update(i, { contentType: v, channels: row.channels.filter((c) => nextAllowed.includes(c)) });
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
            disabled={!rows.length || rows.some((r) => !r.topic.trim()) || confirm.isPending}
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

// ─── Campaign analytics ──────────────────────────────────────────────────────

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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Plan progress ({data.totalIdeas} idea{data.totalIdeas === 1 ? "" : "s"})
          </CardTitle>
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

// ─── Day plan grid (confirmed plan display) ──────────────────────────────────

function DayPlanGrid({ plan, campaignId }: { plan: DayPlanDay[]; campaignId: string }) {
  const fmtDate = (iso: string) => {
    try {
      return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric",
      });
    } catch { return iso; }
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3" data-testid="day-plan-grid">
      {plan.map((day) => {
        const isPast = day.date < todayIso;
        const isToday = day.date === todayIso;
        return (
          <div
            key={day.dayNumber}
            className={`rounded-lg border ${isToday ? "border-primary/60 ring-1 ring-primary/20" : ""}`}
            data-testid={`day-plan-day-${day.dayNumber}`}
          >
            <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
              <CalendarDays className={`h-4 w-4 ${isToday ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                Day {day.dayNumber}
              </span>
              <span className="text-xs text-muted-foreground">— {fmtDate(day.date)}</span>
              {isPast && !isToday && (
                <Badge variant="outline" className="ml-auto text-xs text-muted-foreground">past</Badge>
              )}
              {isToday && (
                <Badge className="ml-auto text-xs">today</Badge>
              )}
            </div>
            <div className="divide-y">
              {day.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 px-3 py-2.5" data-testid={`day-plan-item-${day.dayNumber}-${idx}`}>
                  {item.type === "article" ? (
                    <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                  ) : (
                    <Share2 className="h-4 w-4 shrink-0 text-violet-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.topic}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-xs capitalize">
                        {item.type === "article" ? "Article" : "Social post"}
                      </Badge>
                      {item.platform && (
                        <span className="text-xs text-muted-foreground capitalize">{item.platform}</span>
                      )}
                      {item.format && (
                        <span className="text-xs text-muted-foreground">· {item.format}</span>
                      )}
                    </div>
                    {item.keyMessage && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.keyMessage}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex gap-1.5">
                    {item.articleId ? (
                      <Link href={studioPath(`/articles/${item.articleId}/edit`)}>
                        <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`button-open-article-${item.articleId}`}>
                          Edit →
                        </Button>
                      </Link>
                    ) : item.ideaId ? (
                      <Link href={`${studioPath("/board")}?campaignId=${campaignId}&idea=${item.ideaId}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`button-open-idea-${item.ideaId}`}>
                          View →
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Campaign detail ─────────────────────────────────────────────────────────

function CampaignDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canCreate = can("studio.create_article");
  const [editOpen, setEditOpen] = useState(false);
  const [legacyPreview, setLegacyPreview] = useState<{ summary: string; suggestions: PlanSuggestion[] } | null>(null);
  const [dayPlanPreview, setDayPlanPreview] = useState<{ summary: string; plan: DayPlanDay[] } | null>(null);
  const [contributorPick, setContributorPick] = useState("");

  const { data: campaign, isLoading } = useQuery<CampaignRow>({
    queryKey: ["/api/studio/campaigns", id],
  });

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
    onError: (e: any) =>
      toast({ title: "Couldn't add contributor", description: e?.message, variant: "destructive" }),
  });

  // New day-planner flow (Task #1495)
  const dayPlan = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/studio/campaigns/${id}/generate-day-plan`, {
        durationDays: campaign?.durationDays ?? 14,
      }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      if (!data.plan?.length) {
        toast({
          title: "No plan generated",
          description: "The AI returned no days — try again or check the campaign brief.",
          variant: "destructive",
        });
        return;
      }
      setDayPlanPreview({ summary: data.summary ?? "", plan: data.plan });
    },
    onError: (e: any) =>
      toast({ title: "Day planning failed", description: e?.message, variant: "destructive" }),
  });

  // Legacy week-based plan flow (fallback)
  const legacyPlan = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/studio/campaigns/${id}/generate-plan-preview`, { itemCount: 8 }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      if (!data.suggestions?.length) {
        toast({ title: "No usable suggestions", description: "The AI returned no valid ideas — try again.", variant: "destructive" });
        return;
      }
      setLegacyPreview({ summary: data.summary ?? "", suggestions: data.suggestions });
    },
    onError: (e: any) => toast({ title: "Planning failed", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!campaign) return <p className="text-sm text-muted-foreground">Campaign not found.</p>;

  const counts = campaign.ideaCounts ?? { total: 0, done: 0 };
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
  const todayIso = new Date().toISOString().slice(0, 10);
  const overdueCount =
    (campaign.ideas ?? []).filter((i: any) => i.dueDate && i.dueDate < todayIso && i.status !== "done").length +
    (campaign.articles ?? []).filter(
      (a: any) =>
        a.scheduledAt &&
        new Date(a.scheduledAt).toISOString().slice(0, 10) < todayIso &&
        a.status !== "published" &&
        a.status !== "approved",
    ).length;

  const confirmedPlan = campaign.dailyPlanJsonb as DayPlanDay[] | null;
  const hasDayPlan = Array.isArray(confirmedPlan) && confirmedPlan.length > 0;

  return (
    <div className="space-y-4">
      {(campaign.ideas?.length ?? 0) === 0 && (campaign.articles?.length ?? 0) === 0 && !hasDayPlan && (
        <StudioTip
          id="campaign-no-ideas"
          title="This campaign has no content yet"
          body='Hit "Generate AI Day Plan" — the AI builds a day-by-day content schedule from your brief. Nothing is added until you approve it.'
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
      {!campaign.startDate && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Set a <strong>start date</strong> and <strong>duration</strong> on this campaign to enable the AI Day Planner.</span>
          {canCreate && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEditOpen(true)}>
              Edit campaign
            </Button>
          )}
        </div>
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
                {campaign.startDate}
                {campaign.durationDays
                  ? ` · ${campaign.durationDays} days`
                  : campaign.endDate
                  ? ` → ${campaign.endDate}`
                  : ""}
              </span>
            )}
            <span data-testid="text-campaign-progress">{counts.done}/{counts.total} done ({pct}%)</span>
          </div>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-testid="button-edit-campaign">
              Edit
            </Button>
            {/* New day-planner button (primary) */}
            <Button
              size="sm"
              onClick={() => dayPlan.mutate()}
              disabled={dayPlan.isPending || legacyPlan.isPending || !campaign.startDate}
              title={!campaign.startDate ? "Set a start date first" : ""}
              data-testid="button-day-plan-campaign"
            >
              {dayPlan.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-4 w-4" />
              )}
              {hasDayPlan ? "Regenerate Day Plan" : "Generate AI Day Plan"}
            </Button>
            {/* Legacy fallback for campaigns without startDate or when user prefers */}
            {!campaign.startDate && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => legacyPlan.mutate()}
                disabled={legacyPlan.isPending || dayPlan.isPending}
                data-testid="button-plan-campaign-legacy"
              >
                {legacyPlan.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                AI-propose plan
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue={hasDayPlan ? "dayplan" : "overview"}>
        <TabsList>
          {hasDayPlan && (
            <TabsTrigger value="dayplan" data-testid="tab-campaign-dayplan">
              Day Plan
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                {confirmedPlan!.reduce((a, d) => a + d.items.length, 0)}
              </Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="overview" data-testid="tab-campaign-overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-campaign-analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* ── Day Plan tab ── */}
        {hasDayPlan && (
          <TabsContent value="dayplan" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Your confirmed {campaign.durationDays}-day content schedule. Click any item to open it in the editor.
            </p>
            <DayPlanGrid plan={confirmedPlan!} campaignId={campaign.id} />
          </TabsContent>
        )}

        {/* ── Overview tab ── */}
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
                    {addContributor.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-1 h-4 w-4" />
                    )}
                    Add
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Campaign content ({(campaign.ideas?.length ?? 0) + (campaign.articles?.length ?? 0)})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ── Social post ideas kanban ── */}
              {campaign.ideas && campaign.ideas.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Social posts &amp; ideas ({campaign.ideas.length})
                  </p>
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
                                      <span>
                                        {idea.scheduledDate
                                          ? `📅 ${idea.scheduledDate}`
                                          : idea.dueDate
                                          ? `due ${idea.dueDate}`
                                          : ""}
                                      </span>
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
                </div>
              ) : null}

              {/* ── Articles linked to this campaign ── */}
              {campaign.articles && campaign.articles.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Articles ({campaign.articles.length})
                  </p>
                  <div className="space-y-1.5" data-testid="list-campaign-articles">
                    {campaign.articles.map((article: any) => (
                      <Link key={article.id} href={studioPath(`/articles/${article.id}/edit`)}>
                        <div
                          className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 hover-elevate cursor-pointer"
                          data-testid={`row-campaign-article-${article.id}`}
                        >
                          <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{article.title || "Untitled"}</p>
                            {article.scheduledAt && (
                              <p className="text-xs text-muted-foreground">
                                📅 {new Date(article.scheduledAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs capitalize">
                            {article.status}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {!campaign.ideas?.length && !campaign.articles?.length && (
                <p className="text-sm text-muted-foreground">
                  No content yet. Use "Generate AI Day Plan" to schedule ideas, or attach ideas from the pipeline.
                </p>
              )}

              <div>
                <Link href={`${studioPath("/board")}?campaignId=${campaign.id}`}>
                  <Button variant="outline" size="sm" data-testid="button-open-pipeline">
                    Open in pipeline board
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Analytics tab ── */}
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

      {dayPlanPreview && (
        <DayPlanReviewDialog
          open={!!dayPlanPreview}
          onOpenChange={(v) => { if (!v) setDayPlanPreview(null); }}
          campaignId={campaign.id}
          summary={dayPlanPreview.summary}
          initialPlan={dayPlanPreview.plan}
        />
      )}

      {legacyPreview && (
        <PlanPreviewDialog
          open={!!legacyPreview}
          onOpenChange={(v) => { if (!v) setLegacyPreview(null); }}
          campaignId={campaign.id}
          summary={legacyPreview.summary}
          initialSuggestions={legacyPreview.suggestions}
        />
      )}
    </div>
  );
}

// ─── Main view (campaign list) ───────────────────────────────────────────────

export default function CampaignsView() {
  const [, params] = useRoute(studioPath("/campaigns/:id"));
  const { selectedProjectId } = useStudioProject();
  const { can } = usePermissions();
  const canCreate = can("studio.create_article");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("create") === "true" && canCreate) setCreateOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: campaigns, isLoading } = useQuery<CampaignRow[]>({
    queryKey: ["/api/studio/campaigns", { projectId: selectedProjectId }],
    queryFn: async () => {
      const res = await fetch(`/api/studio/campaigns?projectId=${encodeURIComponent(selectedProjectId)}`, {
        credentials: "include",
      });
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
              Group content around a marketing goal. The AI Day Planner builds a day-by-day schedule — you decide what ships.
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
              const hasPlan = Array.isArray(c.dailyPlanJsonb) && c.dailyPlanJsonb.length > 0;
              return (
                <Link key={c.id} href={studioPath(`/campaigns/${c.id}`)}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md" data-testid={`card-campaign-${c.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{c.name}</CardTitle>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {hasPlan && (
                            <Badge variant="secondary" className="text-xs">
                              <CalendarDays className="mr-1 h-3 w-3" />
                              {c.durationDays}d plan
                            </Badge>
                          )}
                          <Badge className={STATUS_BADGE[c.status] ?? ""}>{c.status}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {c.goal && (
                        <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{c.goal}</p>
                      )}
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{counts.done}/{counts.total} done</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        {c.startDate ? (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {c.startDate}
                            {c.durationDays ? ` · ${c.durationDays}d` : c.endDate ? ` → ${c.endDate}` : ""}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">No start date</span>
                        )}
                        {hasPlan && (
                          <span className="text-emerald-600 dark:text-emerald-400">✓ Day plan</span>
                        )}
                      </div>
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
