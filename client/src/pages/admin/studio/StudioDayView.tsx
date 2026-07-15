import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, Calendar as CalIcon, Star, Loader2, Plus, ExternalLink, MessageSquare,
} from "lucide-react";
import { useStudioProject } from "./useStudioProject";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import {
  DayIdeaCard, IdeaDetailPane, ymd, normalizeScheduledDate,
  OCCASION_REGION_LABELS, artDisplayKey,
} from "./Calendar";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { STUDIO_PIPELINE_CONTENT_TYPES } from "@shared/studioContent";
import type { StudioContentIdea, StudioOccasion } from "@shared/schema";

function QuickCreateRow({
  date, projectId, onCreated,
}: {
  date: string;
  projectId: string;
  onCreated: (idea: StudioContentIdea) => void;
}) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState("social_post");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/studio/content-ideas", {
        projectId,
        topic: topic.trim(),
        contentType,
        channels: contentType === "article" ? ["website"] : ["linkedin"],
        scheduledDate: date,
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: (idea) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      toast({ title: "Idea added", description: `Scheduled for ${date}` });
      setTopic("");
      onCreated(idea);
    },
    onError: (err: Error) => toast({ title: "Could not create idea", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex items-center gap-2">
      <Input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Add a new idea for this date…"
        className="flex-1 h-9 text-sm"
        data-testid="input-day-quick-create"
        onKeyDown={(e) => { if (e.key === "Enter" && topic.trim() && !createMutation.isPending) createMutation.mutate(); }}
      />
      <Select value={contentType} onValueChange={setContentType}>
        <SelectTrigger className="h-9 w-36 text-xs" data-testid="select-day-quick-type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STUDIO_PIPELINE_CONTENT_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        className="h-9"
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending || !topic.trim()}
        data-testid="button-day-quick-create"
      >
        {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function StudioDayView() {
  const params = useParams<{ date: string }>();
  const date = params.date ?? "";
  const [, navigate] = useLocation();
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } = useStudioProject();
  const { can } = usePermissions();
  const canEdit = can("studio.edit_article");
  const canCreateArticle = can("studio.create_article");

  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("idea") ?? null;
  });

  const projectIdFromUrl = new URLSearchParams(window.location.search).get("projectId");

  const monthStr = date.slice(0, 7);
  const backHref = `/admin/studio/calendar?month=${monthStr}${projectIdFromUrl ? `&projectId=${encodeURIComponent(projectIdFromUrl)}` : ""}`;

  const displayDate = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : "";

  const { data: contentIdeas, isLoading: ideasLoading } = useQuery<StudioContentIdea[]>({
    queryKey: ["/api/admin/studio/content-ideas", selectedProjectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      const res = await fetch(`/api/admin/studio/content-ideas?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const dayIdeas = useMemo(() => {
    return (contentIdeas ?? []).filter(
      (idea) => normalizeScheduledDate(idea.scheduledDate as string | Date | null | undefined) === date
    );
  }, [contentIdeas, date]);

  const { data: occasions } = useQuery<StudioOccasion[]>({
    queryKey: ["/api/admin/studio/occasions", selectedProjectId, date],
    queryFn: async () => {
      const p = new URLSearchParams({ from: date, to: date });
      if (selectedProjectId) p.set("projectId", selectedProjectId);
      const res = await fetch(`/api/admin/studio/occasions?${p.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: members = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/studio/assignees"],
  });

  const hasLinkedIdeas = dayIdeas.some((i) => i.linkedArticleId);
  const { data: linkedArticlesPage } = useQuery<{ items: { id: string; status: string }[] }>({
    queryKey: ["/api/admin/studio/articles", { projectId: selectedProjectId, batchForIdeas: true }],
    queryFn: async () => {
      if (!selectedProjectId) return { items: [] };
      const res = await fetch(`/api/admin/studio/articles?projectId=${encodeURIComponent(selectedProjectId)}&limit=500`, { credentials: "include" });
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled: !!selectedProjectId && hasLinkedIdeas,
  });
  const articleStatusMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of linkedArticlesPage?.items ?? []) {
      m[a.id] = artDisplayKey(a as { status: string; lastRejectionReason?: string | null });
    }
    return m;
  }, [linkedArticlesPage]);

  const { data: campaignList = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/studio/campaigns", { projectId: selectedProjectId }],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetch(`/api/studio/campaigns?projectId=${encodeURIComponent(selectedProjectId)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProjectId,
  });
  const campaignMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of campaignList) m[c.id] = c.name;
    return m;
  }, [campaignList]);

  const ideaIds = dayIdeas.map((i) => i.id);
  const { data: commentCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/studio/content-ideas/comment-counts", ideaIds.join(",")],
    queryFn: async () => {
      if (!ideaIds.length) return {};
      const res = await fetch(`/api/studio/content-ideas/comment-counts?ids=${ideaIds.join(",")}`, { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: ideaIds.length > 0,
  });

  const bdIdeas = dayIdeas.filter((i) => i.origin === "bd_agent");
  const articleIdeas = dayIdeas.filter((i) => i.origin !== "bd_agent" && i.linkedArticleId);
  const calendarIdeas = dayIdeas.filter((i) => i.origin !== "bd_agent" && !i.linkedArticleId);

  if (!date) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <p>Invalid date.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header / back nav */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button
              onClick={() => navigate(backHref)}
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-back-to-calendar"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Calendar
            </button>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-day-view-title">
              <CalIcon className="h-6 w-6 text-muted-foreground" />
              {displayDate}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {dayIdeas.length} idea{dayIdeas.length !== 1 ? "s" : ""} for this day
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/studio/table?scheduled_date=${date}`}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
              data-testid="link-day-view-pipeline"
            >
              <ExternalLink className="h-3 w-3" />
              View in Pipeline
            </a>
            <ProjectSwitcher
              projects={projects}
              projectsLoading={projectsLoading}
              selectedProjectId={selectedProjectId}
              onChange={setSelectedProjectId}
            />
          </div>
        </div>

        {/* Occasion labels */}
        {(occasions ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="day-view-occasions">
            {(occasions ?? []).map((occ) => (
              <div
                key={occ.id}
                className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-sm text-amber-700 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400"
                data-testid={`occasion-badge-day-${occ.id}`}
              >
                <Star className="h-3.5 w-3.5 fill-current" />
                {occ.name}
                <span className="text-amber-500/70">· {OCCASION_REGION_LABELS[occ.region] ?? occ.region}</span>
              </div>
            ))}
          </div>
        )}

        {/* Idea sections */}
        {ideasLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : dayIdeas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <CalIcon className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No ideas planned for this day</p>
              <p className="text-xs mt-1">Use the form below to add a new idea.</p>
              {canCreateArticle && selectedProjectId && (
                <div className="mt-6 w-full max-w-lg">
                  <QuickCreateRow
                    date={date}
                    projectId={selectedProjectId}
                    onCreated={(idea) => setSelectedIdeaId(idea.id)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* ⚡ BD Intel Ideas */}
            {bdIdeas.length > 0 && (
              <section data-testid="section-bd-ideas">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 mb-2 flex items-center gap-1">
                  ⚡ BD Intel Ideas
                  <span className="rounded-full bg-amber-100 px-1.5 text-amber-700 text-[10px]">{bdIdeas.length}</span>
                </p>
                <div className="space-y-2">
                  {bdIdeas.map((idea) => (
                    <DayIdeaCard
                      key={idea.id}
                      idea={idea}
                      isSelected={selectedIdeaId === idea.id}
                      onClick={() => setSelectedIdeaId(selectedIdeaId === idea.id ? null : idea.id)}
                      assignees={members}
                      commentCount={commentCounts[idea.id]}
                      canEdit={canEdit}
                      campaignMap={campaignMap}
                      articleStatusMap={articleStatusMap}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 📰 Article Ideas */}
            {articleIdeas.length > 0 && (
              <section data-testid="section-article-ideas">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 mb-2 flex items-center gap-1">
                  📰 Article Ideas
                  <span className="rounded-full bg-indigo-100 px-1.5 text-indigo-700 text-[10px]">{articleIdeas.length}</span>
                </p>
                <div className="space-y-2">
                  {articleIdeas.map((idea) => (
                    <DayIdeaCard
                      key={idea.id}
                      idea={idea}
                      isSelected={selectedIdeaId === idea.id}
                      onClick={() => setSelectedIdeaId(selectedIdeaId === idea.id ? null : idea.id)}
                      assignees={members}
                      commentCount={commentCounts[idea.id]}
                      canEdit={canEdit}
                      campaignMap={campaignMap}
                      articleStatusMap={articleStatusMap}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 📅 Calendar Ideas */}
            {calendarIdeas.length > 0 && (
              <section data-testid="section-calendar-ideas">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600 mb-2 flex items-center gap-1">
                  📅 Calendar Ideas
                  <span className="rounded-full bg-violet-100 px-1.5 text-violet-700 text-[10px]">{calendarIdeas.length}</span>
                </p>
                <div className="space-y-2">
                  {calendarIdeas.map((idea) => (
                    <DayIdeaCard
                      key={idea.id}
                      idea={idea}
                      isSelected={selectedIdeaId === idea.id}
                      onClick={() => setSelectedIdeaId(selectedIdeaId === idea.id ? null : idea.id)}
                      assignees={members}
                      commentCount={commentCounts[idea.id]}
                      canEdit={canEdit}
                      campaignMap={campaignMap}
                      articleStatusMap={articleStatusMap}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Quick create — always shown when there are existing ideas too */}
        {dayIdeas.length > 0 && canCreateArticle && selectedProjectId && (
          <div className="pt-2">
            <QuickCreateRow
              date={date}
              projectId={selectedProjectId}
              onCreated={(idea) => setSelectedIdeaId(idea.id)}
            />
          </div>
        )}
      </div>

      {/* Idea Detail Sheet */}
      <Sheet open={!!selectedIdeaId} onOpenChange={(o) => { if (!o) setSelectedIdeaId(null); }}>
        <SheetContent
          className="w-[95vw] max-w-none sm:max-w-none overflow-hidden flex flex-col"
          style={{ width: "min(95vw, 640px)" }}
          data-testid="sheet-idea-detail"
        >
          <SheetHeader className="border-b pb-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Idea Details
              </SheetTitle>
              {selectedIdeaId && (
                <a
                  href={`/studio/table?idea=${selectedIdeaId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                  data-testid="link-detail-view-pipeline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View in Pipeline
                </a>
              )}
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            {selectedIdeaId && (
              <IdeaDetailPane
                ideaId={selectedIdeaId}
                members={members}
                onClose={() => setSelectedIdeaId(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
