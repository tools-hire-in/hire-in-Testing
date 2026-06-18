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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Loader2, ChevronLeft, ChevronRight, Download, Sparkles, Plus, Calendar as CalIcon } from "lucide-react";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { useStudioProject } from "./useStudioProject";
import { SocialKitPreview } from "./SocialKitPreview";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "./studioConstants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import type { StudioArticle } from "@shared/schema";
import type { CanonicalSocialKit } from "@shared/studioAi";

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

// ---- In-context article creation from a calendar date ----
function CreateOnDateButton({
  date,
  projectId,
  onNavigate,
  onClose,
}: {
  date: string | null;
  projectId: string | null;
  onNavigate: (path: string) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/studio/articles", {
        projectId: projectId ?? undefined,
        title: `New article — ${date ?? ""}`,
        contentType: "blog_post",
        status: "draft",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to create article");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Article created", description: "Opening editor…" });
      onClose();
      onNavigate(`/admin/studio/articles/${data.id}/edit`);
    },
    onError: (err: Error) => toast({ title: "Could not create article", description: err.message, variant: "destructive" }),
  });

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={() => createMutation.mutate()}
      disabled={createMutation.isPending}
      data-testid="button-create-new-on-date"
    >
      {createMutation.isPending
        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        : <Plus className="mr-2 h-4 w-4" />}
      Create new article for this date
    </Button>
  );
}

// ---- Day Scheduler Dialog: click a day to schedule an existing draft ----
function DaySchedulerDialog({
  date,
  projectId,
  canSchedulePublish,
  canCreateArticle,
  onClose,
  onNavigate,
}: {
  date: string | null;
  projectId: string | null;
  canSchedulePublish: boolean;
  canCreateArticle: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const { toast } = useToast();

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
                        <span className="text-xs text-muted-foreground">{cell.getDate()}</span>
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
          <span className="text-muted-foreground/60 ml-auto">Click a day to schedule · Click chip to edit</span>
        </div>
      </div>

      {/* Day scheduler dialog */}
      <DaySchedulerDialog
        date={schedulerDate}
        projectId={selectedProjectId}
        canSchedulePublish={canSchedulePublish}
        canCreateArticle={canCreateArticle}
        onClose={() => setSchedulerDate(null)}
        onNavigate={navigate}
      />

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
