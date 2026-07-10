import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ChevronLeft, ChevronRight, Download, Sparkles, Plus, Calendar as CalIcon, Star, ImageIcon } from "lucide-react";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { useStudioProject } from "./useStudioProject";
import { SocialKitPreview, IdeaCardGallery } from "./SocialKitPreview";
import { IdeaPeek } from "@/pages/studio/PipelineView";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "./studioConstants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import type { StudioArticle, StudioOccasion, StudioContentIdea } from "@shared/schema";
import { STUDIO_PIPELINE_CONTENT_TYPES } from "@shared/studioContent";
import type { CanonicalSocialKit } from "@shared/studioAi";

const OCCASION_CATEGORY_LABELS: Record<string, string> = {
  national_holiday: "Holiday",
  festival: "Festival",
  industry_awareness: "Awareness",
  fun_observance: "Observance",
  custom: "Custom",
};

const OCCASION_REGION_LABELS: Record<string, string> = {
  us: "US",
  india: "India",
  global: "Global",
};

type CalendarItem = StudioArticle & {
  authorName: string | null;
  projectName: string | null;
  publishesToInsights: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- AI Plan Dialog ----
function AIPlanDialog({
  projectId,
  monthStart,
  monthEnd,
}: {
  projectId: string | null;
  monthStart: Date;
  monthEnd: Date;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [perWeek, setPerWeek] = useState(3);
  const [topicInput, setTopicInput] = useState("");
  const [fromDate, setFromDate] = useState(ymd(monthStart));
  const [toDate, setToDate] = useState(ymd(monthEnd));
  const [planResult, setPlanResult] = useState<any[] | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Select a project first");
      const topics = topicInput.trim()
        ? topicInput.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      const res = await apiRequest("POST", "/api/admin/studio/calendar/ai-plan", {
        projectId,
        fromDate,
        toDate,
        articlesPerWeek: perWeek,
        topicFocus: topics,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "AI plan failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const plan = data.plan ?? [];
      setPlanResult(plan);
      // Refresh calendar so the new scheduled stubs appear immediately.
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/calendar"] });
      toast({ title: `AI plan created: ${plan.length} article${plan.length === 1 ? "" : "s"} scheduled` });
    },
    onError: (err: Error) => toast({ title: "AI plan failed", description: err.message, variant: "destructive" }),
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="button-ai-plan">
        <Sparkles className="mr-2 h-4 w-4" />
        AI Schedule
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPlanResult(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-ai-plan">
          <DialogHeader>
            <DialogTitle>AI Content Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ai-from">From</Label>
                <Input id="ai-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} data-testid="input-ai-from" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-to">To</Label>
                <Input id="ai-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} data-testid="input-ai-to" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-per-week">Articles per week</Label>
              <Input
                id="ai-per-week"
                type="number"
                min={1}
                max={7}
                value={perWeek}
                onChange={(e) => setPerWeek(Number(e.target.value))}
                data-testid="input-ai-per-week"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-topics">Topic focus (comma-separated, optional)</Label>
              <Input
                id="ai-topics"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="Healthcare Staffing, IT Hiring Trends, Leadership"
                data-testid="input-ai-topics"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !projectId}
              data-testid="button-ai-plan-submit"
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Schedule
            </Button>
            {!projectId && (
              <p className="text-center text-xs text-destructive">Select a project in the calendar header first.</p>
            )}
            {planResult && planResult.length > 0 && (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggested Plan</p>
                {planResult.map((item: any, i: number) => (
                  <div key={i} className="rounded border p-2 text-sm" data-testid={`ai-plan-item-${i}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium line-clamp-1">{item.title}</span>
                      {item.scheduledDate && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(item.scheduledDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {item.contentType && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.contentType}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---- In-context idea creation from a calendar date ----
// Task #906 defect fix: this used to POST an article with the invalid
// contentType "blog_post" (always a 400). Date-click now quick-creates a
// content idea in the planning pipeline instead.
function CreateOnDateButton({
  date,
  projectId,
  onNavigate: _onNavigate,
  onClose,
}: {
  date: string | null;
  projectId: string | null;
  onNavigate: (path: string) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState("article");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/studio/content-ideas", {
        projectId: projectId ?? undefined,
        topic: topic.trim(),
        contentType,
        channels: contentType === "article" ? ["website"] : ["linkedin"],
        scheduledDate: date ?? undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      toast({ title: "Idea added to plan", description: `Scheduled for ${date ?? "later"}. Find it in the content pipeline.` });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Could not create idea", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan something for this date</p>
      <Input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Topic, e.g. 5 interview red flags"
        data-testid="input-create-on-date-topic"
      />
      <Select value={contentType} onValueChange={setContentType}>
        <SelectTrigger data-testid="select-create-on-date-type"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STUDIO_PIPELINE_CONTENT_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending || !topic.trim() || !projectId}
        data-testid="button-create-new-on-date"
      >
        {createMutation.isPending
          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          : <Plus className="mr-2 h-4 w-4" />}
        Add idea for this date
      </Button>
    </div>
  );
}

// ---- "Plan content for this" — prefilled idea form from an occasion ----
function PlanContentForm({
  occasion,
  projectId,
  onDone,
}: {
  occasion: StudioOccasion;
  projectId: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  // Lead time: schedule social content 1 day before the occasion by default.
  const dayBefore = (() => {
    const d = new Date(`${occasion.date}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return ymd(d);
  })();
  const [topic, setTopic] = useState(`${occasion.name} — ${OCCASION_CATEGORY_LABELS[occasion.category] ?? "occasion"} post`);
  const [brief, setBrief] = useState(occasion.contentAngle ?? "");
  const [scheduledDate, setScheduledDate] = useState(dayBefore);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/studio/content-ideas", {
        projectId,
        topic: topic.trim(),
        brief: brief.trim() || null,
        contentType: "social_post",
        scheduledDate,
        origin: "manual",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to create idea");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      toast({ title: "Content idea planned", description: `Scheduled for ${scheduledDate}` });
      onDone();
    },
    onError: (err: Error) =>
      toast({ title: "Could not plan content", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-2.5" data-testid={`plan-content-form-${occasion.id}`}>
      <div className="space-y-1">
        <Label htmlFor={`plan-topic-${occasion.id}`} className="text-xs">Topic</Label>
        <Input
          id={`plan-topic-${occasion.id}`}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          data-testid={`input-plan-topic-${occasion.id}`}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`plan-brief-${occasion.id}`} className="text-xs">Brief</Label>
        <Textarea
          id={`plan-brief-${occasion.id}`}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={2}
          data-testid={`input-plan-brief-${occasion.id}`}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`plan-date-${occasion.id}`} className="text-xs">
          Scheduled date (occasion is {occasion.date})
        </Label>
        <Input
          id={`plan-date-${occasion.id}`}
          type="date"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          data-testid={`input-plan-date-${occasion.id}`}
        />
      </div>
      <Button
        size="sm"
        className="w-full"
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending || !topic.trim()}
        data-testid={`button-plan-submit-${occasion.id}`}
      >
        {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        Create planned idea
      </Button>
    </div>
  );
}

// ---- Day Scheduler Dialog: click a day to schedule an existing draft ----
function DaySchedulerDialog({
  date,
  projectId,
  occasions,
  ideas,
  canSchedulePublish,
  canCreateArticle,
  onClose,
  onNavigate,
  onOpenIdea,
}: {
  date: string | null;
  projectId: string | null;
  occasions: StudioOccasion[];
  ideas: StudioContentIdea[];
  canSchedulePublish: boolean;
  canCreateArticle: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onOpenIdea: (id: string) => void;
}) {
  const { toast } = useToast();
  const [planningFor, setPlanningFor] = useState<string | null>(null);

  const { data: drafts, isLoading } = useQuery<StudioArticle[]>({
    queryKey: ["/api/admin/studio/articles", { status: "draft", projectId }],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "draft", pageSize: "50" });
      if (projectId) params.set("projectId", projectId);
      const res = await fetch(`/api/admin/studio/articles?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.items ?? [];
    },
    enabled: !!date && canSchedulePublish,
  });

  const scheduleMutation = useMutation({
    mutationFn: async (articleId: string) => {
      // Use 9 AM on the selected date as the scheduled publish time.
      const scheduledAt = date ? new Date(`${date}T09:00:00`) : null;
      const res = await apiRequest("POST", `/api/admin/studio/articles/${articleId}/schedule-draft`, {
        scheduledAt: scheduledAt?.toISOString() ?? null,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to schedule");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles"] });
      toast({ title: `Article scheduled for ${date}` });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Schedule failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={!!date} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto" data-testid="dialog-day-scheduler">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalIcon className="h-4 w-4" />
            {date}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {ideas.length > 0 && (
            <div className="space-y-2" data-testid="day-planned-ideas">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Planned ideas</p>
              {ideas.map((idea) => (
                <div
                  key={idea.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                  data-testid={`day-idea-row-${idea.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{idea.topic}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE_CLASS[idea.status] ?? "bg-slate-100 text-slate-700"}`}>
                        {STATUS_LABELS[idea.status] ?? idea.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{idea.contentType?.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-7 px-2 text-xs"
                    onClick={() => { onOpenIdea(idea.id); onClose(); }}
                    data-testid={`button-open-idea-${idea.id}`}
                  >
                    Open
                  </Button>
                </div>
              ))}
            </div>
          )}
          {occasions.length > 0 && (
            <div className="space-y-2" data-testid="day-occasions">
              {occasions.map((occ) => (
                <div key={occ.id} className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5 dark:border-amber-900 dark:bg-amber-950/20" data-testid={`occasion-${occ.id}`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-sm font-medium">{occ.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {OCCASION_REGION_LABELS[occ.region] ?? occ.region}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {OCCASION_CATEGORY_LABELS[occ.category] ?? occ.category}
                    </Badge>
                  </div>
                  {occ.contentAngle && (
                    <p className="mt-1 text-xs text-muted-foreground">{occ.contentAngle}</p>
                  )}
                  {canCreateArticle && projectId && (
                    planningFor === occ.id ? (
                      <div className="mt-2">
                        <PlanContentForm
                          occasion={occ}
                          projectId={projectId}
                          onDone={() => setPlanningFor(null)}
                        />
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => setPlanningFor(occ.id)}
                        data-testid={`button-plan-content-${occ.id}`}
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Plan content for this
                      </Button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
          {canSchedulePublish ? (
            <>
              <p className="text-sm text-muted-foreground">Pick a draft to schedule for publishing on this date.</p>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (drafts ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No draft articles found.</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {(drafts ?? []).map((d) => (
                    <button
                      key={d.id}
                      onClick={() => scheduleMutation.mutate(d.id)}
                      disabled={scheduleMutation.isPending}
                      className="w-full rounded-md border p-2.5 text-left text-sm hover:bg-muted/40 transition-colors disabled:opacity-50"
                      data-testid={`button-schedule-draft-${d.id}`}
                    >
                      <div className="font-medium line-clamp-1">{d.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {STATUS_LABELS[d.status] ?? d.status} · {d.contentType}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              Only super admins can schedule articles directly from the calendar.
            </p>
          )}
          {canCreateArticle && (
            <CreateOnDateButton
              date={date}
              projectId={projectId}
              onNavigate={onNavigate}
              onClose={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Calendar() {
  const [, navigate] = useLocation();
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } = useStudioProject();
  const { can } = usePermissions();
  const canCreateArticle = can("studio.create_article");
  const canSchedulePublish = can("studio.schedule_publish");
  const [scope, setScope] = useState<"hireins" | "all">("all");
  const [exportItem, setExportItem] = useState<CalendarItem | null>(null);
  const [schedulerDate, setSchedulerDate] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);

  const { data: items, isLoading } = useQuery<CalendarItem[]>({
    queryKey: ["/api/admin/studio/calendar", selectedProjectId, ymd(monthStart)],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: monthStart.toISOString(),
        to: monthEnd.toISOString(),
      });
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      const res = await fetch(`/api/admin/studio/calendar?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load calendar");
      return res.json();
    },
  });

  const visible = (items ?? []).filter((a) => (scope === "hireins" ? a.publishesToInsights : true));

  const byDay: Record<string, CalendarItem[]> = {};
  for (const a of visible) {
    const when = a.status === "scheduled" ? a.scheduledAt : a.publishedAt;
    if (!when) continue;
    const key = ymd(new Date(when));
    (byDay[key] ??= []).push(a);
  }

  // Occasions for the visible month (filtered server-side by the project's
  // occasionPreferences — opt-in per project via Studio Settings).
  const { data: occasions } = useQuery<StudioOccasion[]>({
    queryKey: ["/api/admin/studio/occasions", selectedProjectId, ymd(monthStart)],
    queryFn: async () => {
      const params = new URLSearchParams({ from: ymd(monthStart), to: ymd(monthEnd) });
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      const res = await fetch(`/api/admin/studio/occasions?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const occByDay: Record<string, StudioOccasion[]> = {};
  for (const occ of occasions ?? []) {
    (occByDay[String(occ.date)] ??= []).push(occ);
  }

  // Planned content ideas (social posts) for the selected project.
  const { data: contentIdeas } = useQuery<StudioContentIdea[]>({
    queryKey: ["/api/admin/studio/content-ideas", selectedProjectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      const res = await fetch(`/api/admin/studio/content-ideas?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProjectId,
  });
  const ideasByDay: Record<string, StudioContentIdea[]> = {};
  for (const idea of contentIdeas ?? []) {
    if (!idea.scheduledDate) continue;
    (ideasByDay[String(idea.scheduledDate)] ??= []).push(idea);
  }
  const [galleryIdeaId, setGalleryIdeaId] = useState<string | null>(null);
  const galleryIdea = (contentIdeas ?? []).find((i) => i.id === galleryIdeaId) ?? null;
  const [peekIdeaId, setPeekIdeaId] = useState<string | null>(null);

  const firstWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = ymd(new Date());
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const downloadSocialKit = (item: CalendarItem) => {
    const kit = (item.socialKitJsonb as CanonicalSocialKit | null) ?? {};
    const payload = {
      title: item.title,
      project: item.projectName,
      author: item.authorName,
      seoTitle: item.seoTitle,
      seoDescription: item.seoDescription,
      coverImageUrl: item.coverImageUrl,
      socialKit: kit,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(item.slug || item.title || "social-kit").replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}-social-kit.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportKit = exportItem
    ? ((exportItem.socialKitJsonb as CanonicalSocialKit | null) ?? null)
    : null;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-calendar-title">
              Publishing Calendar
            </h1>
            <p className="text-sm text-muted-foreground">Scheduled and published articles by date. Click a day to schedule a draft.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canCreateArticle && (
              <AIPlanDialog
                projectId={selectedProjectId}
                monthStart={monthStart}
                monthEnd={monthEnd}
              />
            )}
            <ToggleGroup
              type="single"
              value={scope}
              onValueChange={(v) => v && setScope(v as "hireins" | "all")}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="hireins" data-testid="toggle-hireins">
                Hire'in
              </ToggleGroupItem>
              <ToggleGroupItem value="all" data-testid="toggle-all-projects">
                All Projects
              </ToggleGroupItem>
            </ToggleGroup>
            <ProjectSwitcher
              projects={projects}
              projectsLoading={projectsLoading}
              selectedProjectId={selectedProjectId}
              onChange={setSelectedProjectId}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[160px] text-center text-sm font-semibold" data-testid="text-month-label">
              {monthLabel}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const n = new Date();
              setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
            }}
            data-testid="button-today"
          >
            Today
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="px-2 py-1 text-center text-xs font-semibold text-muted-foreground">
                    {w}
                  </div>
                ))}
                {cells.map((cell, i) => {
                  if (!cell) return <div key={i} className="min-h-[96px] rounded-md bg-muted/20" />;
                  const key = ymd(cell);
                  const dayItems = byDay[key] ?? [];
                  const dayOccasions = occByDay[key] ?? [];
                  const dayIdeas = ideasByDay[key] ?? [];
                  return (
                    <div
                      key={i}
                      className={`group min-h-[96px] rounded-md border p-1.5 transition-colors cursor-pointer hover:bg-muted/30 ${
                        key === todayKey ? "border-primary" : ""
                      }`}
                      onClick={() => setSchedulerDate(key)}
                      data-testid={`calendar-day-${key}`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {cell.getDate()}
                          {dayOccasions.length > 0 && (
                            <span
                              className="inline-flex items-center text-amber-500"
                              title={dayOccasions.map((o) => o.name).join(" · ")}
                              data-testid={`occasion-badge-${key}`}
                            >
                              <Star className="h-3 w-3 fill-current" />
                            </span>
                          )}
                        </span>
                        {canCreateArticle && selectedProjectId && (
                          <button
                            className="hidden rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground group-hover:flex"
                            title="Schedule draft or create article on this date"
                            onClick={(e) => { e.stopPropagation(); setSchedulerDate(key); }}
                            data-testid={`button-add-article-${key}`}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayItems.map((a) => {
                          const isDraftPlanned = a.status === "draft";
                          const readyToExport = !isDraftPlanned && !a.publishesToInsights;
                          return (
                            <button
                              key={a.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (readyToExport) {
                                  setExportItem(a);
                                } else {
                                  navigate(`/admin/studio/articles/${a.id}/edit`);
                                }
                              }}
                              className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] hover-elevate ${
                                isDraftPlanned
                                  ? "border border-dashed bg-gray-50 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400"
                                  : readyToExport
                                    ? "border border-dashed bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                                    : STATUS_BADGE_CLASS[a.status] ?? ""
                              }`}
                              title={
                                isDraftPlanned
                                  ? `${a.title} — Planned Draft (click to edit)`
                                  : readyToExport
                                    ? `${a.title} — Ready to Export`
                                    : `${a.title} — ${a.status} (click to edit)`
                              }
                              data-testid={`calendar-item-${a.id}`}
                            >
                              {isDraftPlanned ? `· ${a.title}` : readyToExport ? `⇩ ${a.title}` : a.title}
                            </button>
                          );
                        })}
                        {dayIdeas.map((idea) => (
                          <button
                            key={idea.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPeekIdeaId(idea.id);
                            }}
                            className="block w-full truncate rounded border border-dashed border-violet-300 bg-violet-50 px-1.5 py-0.5 text-left text-[11px] text-violet-800 hover-elevate dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300"
                            title={`${idea.topic} — planned idea (click to open workspace)`}
                            data-testid={`calendar-idea-${idea.id}`}
                          >
                            ✦ {idea.topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="secondary" className={STATUS_BADGE_CLASS.scheduled}>Scheduled</Badge>
          <Badge variant="secondary" className={STATUS_BADGE_CLASS.published}>Published</Badge>
          <span className="inline-flex items-center gap-1 rounded border border-dashed bg-gray-50 px-1.5 py-0.5 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
            · Planned Draft (AI plan)
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-dashed bg-amber-50 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            ⇩ Ready to Export (other projects)
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-dashed border-violet-300 bg-violet-50 px-1.5 py-0.5 text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300">
            ✦ Planned social idea
          </span>
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-current text-amber-500" /> Occasion
          </span>
          <span className="text-muted-foreground/60 ml-auto">Click a day to schedule · Click chip to edit</span>
        </div>
      </div>

      {/* Day scheduler dialog */}
      <DaySchedulerDialog
        date={schedulerDate}
        projectId={selectedProjectId}
        occasions={schedulerDate ? occByDay[schedulerDate] ?? [] : []}
        ideas={schedulerDate ? ideasByDay[schedulerDate] ?? [] : []}
        canSchedulePublish={canSchedulePublish}
        canCreateArticle={canCreateArticle}
        onClose={() => setSchedulerDate(null)}
        onNavigate={navigate}
        onOpenIdea={(id) => { setSchedulerDate(null); setPeekIdeaId(id); }}
      />

      {/* IdeaPeek slide-over — full idea workspace from calendar context */}
      <IdeaPeek
        ideaId={peekIdeaId}
        onClose={() => setPeekIdeaId(null)}
        fromCalendar
        onOpenGallery={() => {
          if (peekIdeaId) setGalleryIdeaId(peekIdeaId);
        }}
        onMutated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
        }}
      />

      {/* Idea creative-card gallery dialog */}
      <Dialog open={!!galleryIdea} onOpenChange={(o) => !o && setGalleryIdeaId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-idea-cards">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              {galleryIdea?.topic}
            </DialogTitle>
          </DialogHeader>
          {galleryIdea?.brief && (
            <p className="text-sm text-muted-foreground">{galleryIdea.brief}</p>
          )}
          {galleryIdea && <IdeaCardGallery idea={galleryIdea} />}
        </DialogContent>
      </Dialog>

      {/* Social kit export sheet */}
      <Sheet open={!!exportItem} onOpenChange={(open) => !open && setExportItem(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg" data-testid="sheet-social-kit">
          <SheetHeader>
            <SheetTitle>Ready to Export</SheetTitle>
            <SheetDescription>
              {exportItem?.title}
              {exportItem?.projectName ? ` — ${exportItem.projectName}` : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <Button
              onClick={() => exportItem && downloadSocialKit(exportItem)}
              data-testid="button-download-social-kit"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Social Kit (JSON)
            </Button>
            <SocialKitPreview kit={exportKit} />
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
