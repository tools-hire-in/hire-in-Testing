import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StudioShell } from "@/components/studio/StudioShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Megaphone,
  MessageSquare,
  Pencil,
  Send,
  Sparkles,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { studioPath } from "@/lib/studioBase";
import {
  STUDIO_IDEA_TRANSITIONS,
  getPipelineContentType,
  type StudioIdeaStatus,
} from "@shared/studioContent";
import type { StudioContentIdea, StudioIdeaComment, StudioCampaign } from "@shared/schema";
import { IDEA_FORMATS } from "./IdeasBank";

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  suggested: "Suggested",
  idea: "Idea",
  in_review: "In Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  in_production: "In Production",
  scheduled: "Scheduled",
  published: "Published",
  done: "Done",
  rejected: "Rejected",
};

const STATUS_CLASS: Record<string, string> = {
  suggested: "bg-slate-100 text-slate-600",
  idea: "bg-slate-100 text-slate-800",
  in_review: "bg-amber-100 text-amber-800",
  changes_requested: "bg-orange-100 text-orange-800",
  approved: "bg-emerald-100 text-emerald-800",
  in_production: "bg-blue-100 text-blue-800",
  scheduled: "bg-indigo-100 text-indigo-800",
  published: "bg-violet-100 text-violet-800",
  done: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-100 text-red-700",
};

const WORKFLOW_STEPS: StudioIdeaStatus[] = [
  "idea",
  "in_review",
  "approved",
  "scheduled",
  "published",
];

const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X (Twitter)" },
];

const FORMAT_LABEL: Record<string, string> = Object.fromEntries(
  IDEA_FORMATS.map((f) => [f.value, f.label]),
);

function fmtDate(d?: string | Date | null): string {
  if (!d) return "—";
  try {
    const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00` : d) : d;
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}

interface GeneratedContent {
  platform?: string;
  format?: string;
  caption?: string;
  hook?: string;
  hashtags?: string[];
  notes?: string;
  generatedAt?: string;
}

// ── Detail page ───────────────────────────────────────────────────────────────
export default function StudioIdeaDetailPage() {
  const [, params] = useRoute("/studio/ideas/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { can } = usePermissions();
  const id = params?.id ?? null;

  const [comment, setComment] = useState("");
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: idea, isLoading } = useQuery<StudioContentIdea & { comments: StudioIdeaComment[] }>({
    queryKey: ["/api/studio/content-ideas", id],
    enabled: !!id,
  });

  const { data: campaigns = [] } = useQuery<StudioCampaign[]>({
    queryKey: ["/api/studio/campaigns", { projectId: idea?.projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/studio/campaigns?projectId=${encodeURIComponent(idea!.projectId)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!idea?.projectId,
  });

  const { data: assignees = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/studio/assignees"],
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
    if (id) queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas", id] });
  };

  const transitionMutation = useMutation({
    mutationFn: async (to: string) => {
      const res = await apiRequest("POST", `/api/studio/content-ideas/${id}/transition`, { to });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Status updated" }); },
    onError: (e: Error) => toast({ title: "Couldn't update status", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/studio/content-ideas/${id}`, patch);
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Saved" }); },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const campaignMutation = useMutation({
    mutationFn: async (campaignId: string | null) => {
      const res = await apiRequest("PATCH", `/api/studio/content-ideas/${id}/campaign`, { campaignId });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Campaign updated" }); },
    onError: (e: Error) => toast({ title: "Couldn't update campaign", description: e.message, variant: "destructive" }),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/studio/content-ideas/${id}/comments`, { message: comment });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { setComment(""); invalidate(); },
    onError: (e: Error) => toast({ title: "Comment failed", description: e.message, variant: "destructive" }),
  });

  async function handleGenerateDraft() {
    if (!idea) return;
    setIsGenerating(true);
    try {
      const channels = (idea.channels as string[] | null) ?? [];
      const platform = channels[0] ?? "linkedin";
      const fmt = (idea as any).format as string | null;
      const res = await apiRequest("POST", "/api/admin/studio/calendar/generate-social-draft", {
        topic: idea.topic,
        platform,
        format: fmt ? (FORMAT_LABEL[fmt] ?? fmt) : "Static Post",
      });
      const data = await res.json();
      const generated: GeneratedContent = {
        platform,
        format: fmt ?? undefined,
        caption: data.caption ?? "",
        generatedAt: new Date().toISOString(),
      };
      await updateMutation.mutateAsync({ generatedContentJsonb: generated } as any);
      setCaptionDraft(data.caption ?? "");
      setEditingCaption(true);
      toast({ title: "AI draft generated" });
    } catch {
      toast({ title: "Generation failed", description: "Could not generate AI draft.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }

  function saveCaption() {
    if (!idea) return;
    const existing = (idea as any).generatedContentJsonb as GeneratedContent | null;
    updateMutation.mutate({ generatedContentJsonb: { ...(existing ?? {}), caption: captionDraft } } as any);
    setEditingCaption(false);
  }

  if (!id) { navigate(studioPath("/ideas")); return null; }

  if (isLoading) {
    return (
      <StudioShell>
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </StudioShell>
    );
  }

  if (!idea) {
    return (
      <StudioShell>
        <div className="max-w-3xl mx-auto py-16 text-center text-muted-foreground" data-testid="panel-not-found">
          <p className="text-lg font-medium">Idea not found</p>
          <Button variant="link" onClick={() => navigate(studioPath("/ideas"))} className="mt-2">
            ← Back to Ideas Bank
          </Button>
        </div>
      </StudioShell>
    );
  }

  const canEdit = can("studio.edit_article");
  const canReview = can("studio.review_article");
  const nextStates = STUDIO_IDEA_TRANSITIONS[idea.status as StudioIdeaStatus] ?? [];
  const channels = (idea.channels as string[] | null) ?? [];
  const typeCfg = getPipelineContentType(idea.contentType);
  const generatedContent = (idea as any).generatedContentJsonb as GeneratedContent | null;
  const currentStepIndex = WORKFLOW_STEPS.indexOf(idea.status as StudioIdeaStatus);
  const campaignName = campaigns.find((c) => c.id === (idea as any).campaignId)?.name;
  const assigneeName = assignees.find((a) => a.id === idea.assignedToUserId)?.name;
  const fmt = (idea as any).format as string | null | undefined;
  const publishedAt = (idea as any).publishedAt as string | null | undefined;
  const isPublished = idea.status === "published";

  function ActionButton({ to }: { to: StudioIdeaStatus }) {
    const isDecision = ["approved", "rejected", "changes_requested"].includes(to);
    if (isDecision && !canReview) return null;
    if (!isDecision && !canEdit) return null;

    const icons: Record<string, React.ReactNode> = {
      in_review: <Send className="h-4 w-4" />,
      approved: <ThumbsUp className="h-4 w-4" />,
      scheduled: <CalendarDays className="h-4 w-4" />,
      published: <CheckCircle2 className="h-4 w-4" />,
      rejected: <XCircle className="h-4 w-4" />,
      changes_requested: <Pencil className="h-4 w-4" />,
    };
    const labels: Record<string, string> = {
      in_review: "Submit for Review",
      approved: "Approve",
      scheduled: "Mark Scheduled",
      published: "Mark Published",
      rejected: "Reject",
      changes_requested: "Request Changes",
      in_production: "Mark In Production",
      done: "Mark Done",
      idea: "Move Back to Idea",
    };

    return (
      <Button
        size="sm"
        variant={to === "rejected" ? "destructive" : to === "approved" ? "default" : "outline"}
        className="gap-1.5"
        disabled={transitionMutation.isPending}
        onClick={() => transitionMutation.mutate(to)}
        data-testid={`button-transition-${to}`}
      >
        {transitionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : icons[to]}
        {labels[to] ?? STATUS_LABEL[to] ?? to}
      </Button>
    );
  }

  return (
    <StudioShell>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back link */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => navigate(studioPath("/ideas"))}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Ideas Bank
        </Button>

        {/* Header card */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div className="flex-1 min-w-0">
              {/* Editable title */}
              {editingTopic ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={topicDraft}
                    onChange={(e) => setTopicDraft(e.target.value)}
                    className="text-lg font-bold"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && topicDraft.trim()) {
                        updateMutation.mutate({ topic: topicDraft.trim() });
                        setEditingTopic(false);
                      }
                      if (e.key === "Escape") setEditingTopic(false);
                    }}
                    autoFocus
                    data-testid="input-topic-edit"
                  />
                  <Button
                    size="sm"
                    disabled={!topicDraft.trim() || updateMutation.isPending}
                    onClick={() => { updateMutation.mutate({ topic: topicDraft.trim() }); setEditingTopic(false); }}
                    data-testid="button-save-topic"
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingTopic(false)} data-testid="button-cancel-topic">
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="group flex items-start gap-2">
                  <h1 className="text-xl font-bold leading-snug flex-1" data-testid="text-idea-topic">
                    {idea.topic}
                  </h1>
                  {canEdit && (
                    <button
                      className="mt-1 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => { setTopicDraft(idea.topic); setEditingTopic(true); }}
                      data-testid="button-edit-topic"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[idea.status] ?? "bg-slate-100 text-slate-700"}`}
                  data-testid="badge-status"
                >
                  {STATUS_LABEL[idea.status] ?? idea.status}
                </span>
                <span className="text-xs text-muted-foreground">{typeCfg?.label ?? idea.contentType}</span>

                {/* Platform badges / editable */}
                {channels.map((c) => (
                  <Badge key={c} variant="secondary" className="text-[10px] capitalize" data-testid={`badge-channel-${c}`}>
                    {c === "x" ? "X" : c}
                  </Badge>
                ))}

                {/* Format badge */}
                {fmt && (
                  <Badge variant="outline" className="text-[10px]" data-testid="badge-format">
                    {FORMAT_LABEL[fmt] ?? fmt}
                  </Badge>
                )}

                {/* Published date */}
                {isPublished && publishedAt && (
                  <span className="flex items-center gap-0.5 text-[10px] text-violet-600 font-medium" data-testid="badge-published-date">
                    <CheckCircle2 className="h-3 w-3" />
                    Published {fmtDate(publishedAt)}
                  </span>
                )}
              </div>
            </div>

            {nextStates.length > 0 && (
              <div className="flex flex-wrap gap-2 shrink-0">
                {nextStates.slice(0, 3).map((s) => (
                  <ActionButton key={s} to={s as StudioIdeaStatus} />
                ))}
              </div>
            )}
          </div>

          {/* Status stepper */}
          <div className="flex items-center gap-1 pt-2">
            {WORKFLOW_STEPS.map((step, i) => {
              const isActive = idea.status === step;
              const isPast = currentStepIndex > i;
              return (
                <div key={step} className="flex items-center gap-1 flex-1 min-w-0">
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                        : isPast
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                    data-testid={`stepper-step-${step}`}
                  >
                    {isPast ? "✓" : i + 1}
                  </div>
                  <span
                    className={`hidden sm:block text-[10px] truncate ${
                      isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {STATUS_LABEL[step]}
                  </span>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <div className={`flex-1 h-px min-w-2 ${isPast ? "bg-emerald-400" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-4">
            {/* AI-generated content */}
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  AI-Generated Content
                </h2>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={handleGenerateDraft}
                    disabled={isGenerating || updateMutation.isPending}
                    data-testid="button-generate-draft"
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {generatedContent ? "Regenerate" : "Generate Draft"}
                  </Button>
                )}
              </div>

              {generatedContent ? (
                <div className="space-y-2" data-testid="panel-generated-content">
                  <div className="flex flex-wrap gap-1.5">
                    {generatedContent.platform && (
                      <Badge variant="secondary" className="text-[10px] capitalize" data-testid="badge-gen-platform">
                        {generatedContent.platform}
                      </Badge>
                    )}
                    {generatedContent.format && (
                      <Badge variant="outline" className="text-[10px]" data-testid="badge-gen-format">
                        {FORMAT_LABEL[generatedContent.format] ?? generatedContent.format}
                      </Badge>
                    )}
                    {generatedContent.generatedAt && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(generatedContent.generatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                  </div>

                  {editingCaption ? (
                    <div className="space-y-2">
                      <Textarea
                        value={captionDraft}
                        onChange={(e) => setCaptionDraft(e.target.value)}
                        rows={6}
                        className="text-sm"
                        data-testid="textarea-caption-edit"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveCaption} disabled={updateMutation.isPending} data-testid="button-save-caption">
                          {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCaption(false)} data-testid="button-cancel-caption">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative">
                      <div
                        className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap"
                        data-testid="text-generated-caption"
                      >
                        {generatedContent.caption || <span className="text-muted-foreground italic">No caption yet</span>}
                      </div>
                      {canEdit && (
                        <button
                          className="absolute top-2 right-2 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => { setCaptionDraft(generatedContent.caption ?? ""); setEditingCaption(true); }}
                          data-testid="button-edit-caption"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {generatedContent.hashtags && generatedContent.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" data-testid="panel-hashtags">
                      {generatedContent.hashtags.map((tag) => (
                        <span key={tag} className="text-[11px] text-primary">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2 text-sm" data-testid="panel-no-draft">
                  <Sparkles className="h-7 w-7 opacity-30" />
                  <p>No AI draft yet.</p>
                  {canEdit && (
                    <p className="text-xs text-center">Click "Generate Draft" to create platform-specific content using AI.</p>
                  )}
                </div>
              )}
            </div>

            {/* Brief */}
            {idea.brief && (
              <div className="rounded-xl border bg-card p-5 space-y-2">
                <h2 className="text-sm font-semibold">Brief</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-brief">{idea.brief}</p>
              </div>
            )}

            {/* Comments */}
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments
                {idea.comments?.length > 0 && (
                  <span className="text-xs text-muted-foreground">({idea.comments.length})</span>
                )}
              </h2>

              {idea.comments && idea.comments.length > 0 && (
                <div className="space-y-3" data-testid="panel-comments">
                  {idea.comments.map((c) => (
                    <div key={c.id} className="flex gap-2 text-sm" data-testid={`comment-${c.id}`}>
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                        ?
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{c.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment…"
                  rows={2}
                  className="text-sm"
                  data-testid="textarea-comment"
                />
                <Button
                  size="sm"
                  className="self-end"
                  disabled={!comment.trim() || commentMutation.isPending}
                  onClick={() => commentMutation.mutate()}
                  data-testid="button-submit-comment"
                >
                  {commentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</h2>

              <div className="space-y-3 text-sm">
                {/* Platform — editable */}
                <div>
                  <Label className="text-xs text-muted-foreground">Platform</Label>
                  {canEdit ? (
                    <Select
                      value={channels[0] || "linkedin"}
                      onValueChange={(v) => updateMutation.mutate({ channels: [v] })}
                    >
                      <SelectTrigger className="h-8 mt-1 text-xs" data-testid="select-platform">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {channels.length > 0 ? channels.map((c) => (
                        <span key={c} className="text-xs capitalize px-2 py-0.5 rounded-full bg-muted" data-testid={`badge-channel-sidebar-${c}`}>{c === "x" ? "X" : c}</span>
                      )) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  )}
                </div>

                {/* Format — editable */}
                <div>
                  <Label className="text-xs text-muted-foreground">Format</Label>
                  {canEdit ? (
                    <Select
                      value={fmt || ""}
                      onValueChange={(v) => updateMutation.mutate({ format: v || null })}
                    >
                      <SelectTrigger className="h-8 mt-1 text-xs" data-testid="select-format">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        {IDEA_FORMATS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 text-xs" data-testid="text-format">
                      {fmt ? (FORMAT_LABEL[fmt] ?? fmt) : "—"}
                    </p>
                  )}
                </div>

                {/* Scheduled date — editable */}
                <div>
                  <Label className="text-xs text-muted-foreground">Scheduled date</Label>
                  {canEdit ? (
                    <Input
                      type="date"
                      defaultValue={idea.scheduledDate || ""}
                      onBlur={(e) => {
                        const v = e.target.value || null;
                        if (v !== (idea.scheduledDate || null)) updateMutation.mutate({ scheduledDate: v });
                      }}
                      className="h-8 mt-1"
                      data-testid="input-scheduled-date"
                    />
                  ) : (
                    <p className="mt-1" data-testid="text-scheduled-date">{fmtDate(idea.scheduledDate)}</p>
                  )}
                </div>

                {/* Published date — read-only */}
                {isPublished && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Published date</Label>
                    <p className="mt-1 text-xs text-violet-600 font-medium" data-testid="text-published-date">
                      {publishedAt ? fmtDate(publishedAt) : "—"}
                    </p>
                  </div>
                )}

                {/* Campaign — editable */}
                <div>
                  <Label className="text-xs text-muted-foreground">Campaign</Label>
                  {canEdit ? (
                    <Select
                      value={(idea as any).campaignId || "none"}
                      onValueChange={(v) => campaignMutation.mutate(v === "none" ? null : v)}
                    >
                      <SelectTrigger className="h-8 mt-1 text-xs" data-testid="select-campaign">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No campaign</SelectItem>
                        {campaigns.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 text-xs" data-testid="text-campaign">
                      {campaignName ? (
                        <span className="flex items-center gap-1">
                          <Megaphone className="h-3 w-3" />
                          {campaignName}
                        </span>
                      ) : "—"}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Pillar</Label>
                  <p className="mt-1 text-xs" data-testid="text-pillar">
                    {idea.pillar ? idea.pillar.replace(/_/g, " ") : "—"}
                  </p>
                </div>

                {assigneeName && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Assignee</Label>
                    <p className="mt-1 text-xs" data-testid="text-assignee">{assigneeName}</p>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p className="mt-1 text-xs" data-testid="text-created">
                    {new Date(idea.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            {nextStates.length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</h2>
                <div className="space-y-1.5">
                  {nextStates.map((s) => (
                    <ActionButton key={s} to={s as StudioIdeaStatus} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
