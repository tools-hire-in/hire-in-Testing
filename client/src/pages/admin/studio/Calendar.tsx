import { useEffect, useMemo, useRef, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Loader2, ChevronLeft, ChevronRight, Download, Sparkles, Plus,
  Calendar as CalIcon, Star, ImageIcon, MessageSquare, Eye, Check, X, RefreshCw,
  ExternalLink, Rocket,
} from "lucide-react";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { useStudioProject } from "./useStudioProject";
import { SocialKitPreview, IdeaCardGallery } from "./SocialKitPreview";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "./studioConstants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import type { StudioArticle, StudioOccasion, StudioContentIdea, StudioIdeaComment } from "@shared/schema";
import { STUDIO_PIPELINE_CONTENT_TYPES, STUDIO_IDEA_TRANSITIONS, type StudioIdeaStatus } from "@shared/studioContent";
import type { CanonicalSocialKit } from "@shared/studioAi";

// ─── Constants ──────────────────────────────────────────────────────────────

export const OCCASION_CATEGORY_LABELS: Record<string, string> = {
  national_holiday: "Holiday", festival: "Festival",
  industry_awareness: "Awareness", fun_observance: "Observance", custom: "Custom",
};
export const OCCASION_REGION_LABELS: Record<string, string> = {
  us: "US", india: "India", global: "Global",
};
export const TYPE_ICON: Record<string, string> = {
  article: "📄", social_post: "📣", story: "⏱", reel: "🎬", carousel: "📷",
};
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type CalendarItem = StudioArticle & {
  authorName: string | null;
  projectName: string | null;
  publishesToInsights: boolean;
};

export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function normalizeScheduledDate(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) return ymd(v);
  return String(v).slice(0, 10);
}
function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try { return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

// Structured mention type persisted in JSON comment bodies
type StoredMention = { userId: string; displayName: string };

// Parse stored comment message — may be plain text or structured JSON with mentions array.
function parseCommentMessage(raw: string): { text: string; mentions: StoredMention[] } {
  if (raw.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { text?: string; mentions?: StoredMention[] };
      return { text: parsed.text ?? raw, mentions: parsed.mentions ?? [] };
    } catch { /* fall through */ }
  }
  return { text: raw, mentions: [] };
}

// Render inline @[Name](id) tokens from the text field as highlighted chips.
function renderInlineTokens(text: string) {
  const parts: Array<{ type: "text" | "mention"; value: string; userId?: string }> = [];
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    parts.push({ type: "mention", value: match[1], userId: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

function CommentText({ message }: { message: string }) {
  const { text } = parseCommentMessage(message);
  const parts = renderInlineTokens(text);
  return (
    <span>
      {parts.map((p, i) =>
        p.type === "mention" ? (
          <span key={i} className="inline-flex items-center rounded-sm bg-blue-100 px-1 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-medium">
            @{p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </span>
  );
}

// ─── AI Plan Dialog ───────────────────────────────────────────────────────────
function AIPlanDialog({ projectId, monthStart, monthEnd }: { projectId: string | null; monthStart: Date; monthEnd: Date }) {
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
      const topics = topicInput.trim() ? topicInput.split(",").map((t) => t.trim()).filter(Boolean) : [];
      const res = await apiRequest("POST", "/api/admin/studio/calendar/ai-plan", {
        projectId, fromDate, toDate, articlesPerWeek: perWeek, topicFocus: topics,
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "AI plan failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      const plan = data.plan ?? [];
      setPlanResult(plan);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/calendar"] });
      toast({ title: `AI plan created: ${plan.length} article${plan.length === 1 ? "" : "s"} scheduled` });
    },
    onError: (err: Error) => toast({ title: "AI plan failed", description: err.message, variant: "destructive" }),
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="button-ai-plan">
        <Sparkles className="mr-2 h-4 w-4" />AI Schedule
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPlanResult(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-ai-plan">
          <DialogHeader><DialogTitle>AI Content Schedule</DialogTitle></DialogHeader>
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
              <Input id="ai-per-week" type="number" min={1} max={7} value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))} data-testid="input-ai-per-week" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-topics">Topic focus (comma-separated, optional)</Label>
              <Input id="ai-topics" value={topicInput} onChange={(e) => setTopicInput(e.target.value)} placeholder="Healthcare Staffing, IT Hiring Trends" data-testid="input-ai-topics" />
            </div>
            <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending || !projectId} data-testid="button-ai-plan-submit">
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Schedule
            </Button>
            {planResult && planResult.length > 0 && (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggested Plan</p>
                {planResult.map((item: any, i: number) => (
                  <div key={i} className="rounded border p-2 text-sm" data-testid={`ai-plan-item-${i}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium line-clamp-1">{item.title}</span>
                      {item.scheduledDate && <span className="shrink-0 text-xs text-muted-foreground">{new Date(item.scheduledDate).toLocaleDateString()}</span>}
                    </div>
                    {item.contentType && <p className="text-xs text-muted-foreground mt-0.5">{item.contentType}</p>}
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

// ─── Plan Content Form ────────────────────────────────────────────────────────
function PlanContentForm({ occasion, projectId, onDone }: { occasion: StudioOccasion; projectId: string; onDone: () => void }) {
  const { toast } = useToast();
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
        projectId, topic: topic.trim(), brief: brief.trim() || null,
        contentType: "social_post", scheduledDate, origin: "manual",
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      toast({ title: "Content idea planned", description: `Scheduled for ${scheduledDate}` });
      onDone();
    },
    onError: (err: Error) => toast({ title: "Could not plan content", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-2.5" data-testid={`plan-content-form-${occasion.id}`}>
      <div className="space-y-1">
        <Label htmlFor={`plan-topic-${occasion.id}`} className="text-xs">Topic</Label>
        <Input id={`plan-topic-${occasion.id}`} value={topic} onChange={(e) => setTopic(e.target.value)} data-testid={`input-plan-topic-${occasion.id}`} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`plan-brief-${occasion.id}`} className="text-xs">Brief</Label>
        <Textarea id={`plan-brief-${occasion.id}`} value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} data-testid={`input-plan-brief-${occasion.id}`} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`plan-date-${occasion.id}`} className="text-xs">Scheduled date (occasion is {occasion.date})</Label>
        <Input id={`plan-date-${occasion.id}`} type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} data-testid={`input-plan-date-${occasion.id}`} />
      </div>
      <Button size="sm" className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !topic.trim()} data-testid={`button-plan-submit-${occasion.id}`}>
        {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        Create planned idea
      </Button>
    </div>
  );
}

// ─── Day Idea Card ─────────────────────────────────────────────────────────────
export function DayIdeaCard({
  idea, isSelected, onClick, assignees, commentCount, canEdit, campaignMap, articleStatusMap,
}: {
  idea: StudioContentIdea;
  isSelected: boolean;
  onClick: () => void;
  assignees: { id: string; name: string }[];
  commentCount?: number;
  canEdit: boolean;
  campaignMap?: Record<string, string>;
  articleStatusMap?: Record<string, string>;
}) {
  const { toast } = useToast();
  const assignee = assignees.find((a) => a.id === idea.assignedToUserId);
  const initials = assignee ? assignee.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : null;
  const channels = (idea.channels as string[] | null) ?? [];
  const nextStates: StudioIdeaStatus[] = STUDIO_IDEA_TRANSITIONS[idea.status as StudioIdeaStatus] ?? [];

  const transitionMutation = useMutation({
    mutationFn: async (to: string) => {
      const res = await apiRequest("POST", `/api/studio/content-ideas/${idea.id}/transition`, { to });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => toast({ title: "Couldn't change status", description: e.message, variant: "destructive" }),
  });

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isSelected ? "border-primary bg-primary/5" : "border-border"
      }`}
      data-testid={`day-idea-card-${idea.id}`}
    >
      <button
        onClick={onClick}
        className="w-full text-left p-3 hover:bg-muted/20 rounded-t-lg transition-colors"
      >
        <div className="flex items-start gap-2">
          <span className="text-base mt-0.5 shrink-0">{TYPE_ICON[idea.contentType] || "📌"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{idea.topic}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE_CLASS[idea.status] ?? "bg-slate-100 text-slate-700"}`}>
                {STATUS_LABELS[idea.status] ?? idea.status}
              </span>
              {idea.origin === "bd_agent" && (
                <span className="rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">⚡ BD</span>
              )}
              {idea.linkedArticleId && (() => {
                const artStatus = articleStatusMap?.[idea.linkedArticleId] ?? null;
                return (
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE_CLASS[artStatus ?? ""] ?? "bg-indigo-100 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"}`} data-testid={`badge-article-status-${idea.id}`}>
                    📰 {artStatus ? (STATUS_LABELS[artStatus] ?? artStatus) : "Article"}
                  </span>
                );
              })()}
              {(idea as any).campaignId && campaignMap?.[(idea as any).campaignId] && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">● {campaignMap[(idea as any).campaignId]}</span>
              )}
              {channels.slice(0, 2).map((c) => (
                <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{c}</span>
              ))}
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {initials && (
              <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold dark:bg-indigo-900/40 dark:text-indigo-300">
                {initials}
              </div>
            )}
            {(commentCount ?? 0) > 0 && (
              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <span>{commentCount}</span>
              </div>
            )}
          </div>
        </div>
      </button>
      {/* Linked article row — clickable, navigates to ArticleEditor */}
      {idea.linkedArticleId && (() => {
        const artStatus = articleStatusMap?.[idea.linkedArticleId] ?? null;
        return (
          <a
            href={`/admin/studio/articles/${idea.linkedArticleId}/edit`}
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-1.5 border-t px-3 py-1.5 text-[10px] font-medium hover:bg-muted/30 transition-colors ${STATUS_BADGE_CLASS[artStatus ?? ""] ?? "text-indigo-700"}`}
            data-testid={`row-article-link-${idea.id}`}
          >
            <span>📰 Article:</span>
            <span>{artStatus ? (STATUS_LABELS[artStatus] ?? artStatus) : "View Article"}</span>
            <ExternalLink className="h-2.5 w-2.5 ml-auto shrink-0" />
          </a>
        );
      })()}
      {/* Per-idea "View in Pipeline" link */}
      <a
        href={`/studio/table?idea=${idea.id}`}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 border-t px-3 py-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
        data-testid={`link-pipeline-idea-${idea.id}`}
      >
        <ExternalLink className="h-2.5 w-2.5" />
        View in Pipeline
      </a>
      {/* Inline quick-status strip */}
      {canEdit && nextStates.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t px-2 py-1.5">
          {nextStates.slice(0, 4).map((s) => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); transitionMutation.mutate(s); }}
              disabled={transitionMutation.isPending}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium border border-border hover:bg-muted transition-colors disabled:opacity-50"
              data-testid={`quick-transition-${idea.id}-${s}`}
            >
              {STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── @Mention Comment Input ───────────────────────────────────────────────────
function MentionCommentInput({
  ideaId, members, onSuccess,
}: {
  ideaId: string;
  members: { id: string; name: string }[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/studio/content-ideas/${ideaId}/comments`, { message: text.trim() });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => { setText(""); setMentionQuery(null); onSuccess(); },
    onError: (e: Error) => toast({ title: "Comment failed", description: e.message, variant: "destructive" }),
  });

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const cur = e.target.selectionStart ?? 0;
    const textBefore = val.slice(0, cur);
    const atIdx = textBefore.lastIndexOf("@");
    if (atIdx !== -1 && !textBefore.slice(atIdx + 1).includes(" ")) {
      setMentionQuery(textBefore.slice(atIdx + 1).toLowerCase());
      setMentionStart(atIdx);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (member: { id: string; name: string }) => {
    const before = text.slice(0, mentionStart);
    const after = text.slice(textareaRef.current?.selectionStart ?? mentionStart + (mentionQuery?.length ?? 0) + 1);
    const mention = `@[${member.name}](${member.id})`;
    const newText = before + mention + " " + after;
    setText(newText);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const filtered = mentionQuery !== null
    ? members.filter((m) => m.name.toLowerCase().includes(mentionQuery))
    : [];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          placeholder="Write a comment… type @ to mention someone"
          rows={2}
          className="text-sm resize-none"
          data-testid="input-idea-comment"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (text.trim() && !commentMutation.isPending) commentMutation.mutate();
            }
          }}
        />
        {mentionQuery !== null && filtered.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 z-50 w-56 rounded-md border bg-popover shadow-md">
            {filtered.map((m) => (
              <button
                key={m.id}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
                data-testid={`mention-option-${m.id}`}
              >
                <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {m.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <Button
        size="sm"
        onClick={() => commentMutation.mutate()}
        disabled={!text.trim() || commentMutation.isPending}
        data-testid="button-post-comment"
      >
        {commentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Post
      </Button>
    </div>
  );
}

// ─── Idea Detail Pane ─────────────────────────────────────────────────────────
export function IdeaDetailPane({
  ideaId, members, onClose,
}: {
  ideaId: string;
  members: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can("studio.edit_article");
  const canReview = can("studio.review_article");

  const [, navigate] = useLocation();

  const { data: idea, isLoading } = useQuery<StudioContentIdea & { comments: StudioIdeaComment[] }>({
    queryKey: ["/api/studio/content-ideas", ideaId],
    enabled: !!ideaId,
  });

  const { data: linkedArticle } = useQuery<{ id: string; status: string; title: string } | null>({
    queryKey: ["/api/admin/studio/articles", idea?.linkedArticleId],
    enabled: !!idea?.linkedArticleId,
  });

  const { data: watchers = [] } = useQuery<{ id: string; ideaId: string; userId: string; createdAt: string }[]>({
    queryKey: ["/api/studio/content-ideas", ideaId, "watchers"],
    queryFn: async () => {
      const res = await fetch(`/api/studio/content-ideas/${ideaId}/watchers`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!ideaId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
    queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas", ideaId] });
    queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas", ideaId, "watchers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
  };

  const patchMutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/studio/content-ideas/${ideaId}`, patch);
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => { invalidate(); },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const transitionMutation = useMutation({
    mutationFn: async (to: string) => {
      const res = await apiRequest("POST", `/api/studio/content-ideas/${ideaId}/transition`, { to });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Status updated" }); },
    onError: (e: Error) => toast({ title: "Couldn't change status", description: e.message, variant: "destructive" }),
  });

  const addWatcherMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/studio/content-ideas/${ideaId}/watchers`, { userId });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast({ title: "Couldn't add watcher", description: e.message, variant: "destructive" }),
  });

  const removeWatcherMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/studio/content-ideas/${ideaId}/watchers/${userId}`, {});
      return res.json();
    },
    onSuccess: () => invalidate(),
  });

  const resolveMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiRequest("PATCH", `/api/studio/idea-comments/${commentId}/resolve`, {});
      return res.json();
    },
    onSuccess: invalidate,
  });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/studio/content-ideas/${ideaId}/promote`, {});
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to promote"); }
      return res.json();
    },
    onSuccess: (data) => {
      invalidate();
      toast({ title: data.article?.contentType === "article" ? "Promoted to article draft" : "Draft created — generate Social Kit from the editor" });
    },
    onError: (e: Error) => toast({ title: "Couldn't promote", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!idea) return null;

  const nextStates: StudioIdeaStatus[] = STUDIO_IDEA_TRANSITIONS[idea.status as StudioIdeaStatus] ?? [];
  const reviewActions = nextStates.filter((s) => ["approved", "rejected", "changes_requested"].includes(s));
  const editActions = nextStates.filter((s) => !["approved", "rejected", "changes_requested"].includes(s));
  const dayOfWeek = idea.scheduledDate ? WEEKDAYS_LONG[new Date(`${idea.scheduledDate}T00:00:00`).getDay()] : "—";
  const watcherUserIds = new Set(watchers.map((w) => w.userId));
  const promotable = idea.status === "approved" && !idea.linkedArticleId && canEdit;
  const showActionStrip = (canReview || canEdit) && (reviewActions.length > 0 || editActions.length > 0 || promotable || !!idea.linkedArticleId);

  const autoSave = (field: string) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value.trim() || null;
    const existing = (idea as any)[field] ?? null;
    if (val !== existing) patchMutation.mutate({ [field]: val });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Approval action strip */}
      {showActionStrip && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 bg-muted/30">
          {(reviewActions.length > 0 || editActions.length > 0) && (
            <span className="text-xs font-medium text-muted-foreground mr-1">Move to:</span>
          )}
          {canReview && reviewActions.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === "approved" ? "default" : s === "rejected" ? "destructive" : "outline"}
              className="h-7 text-xs"
              onClick={() => transitionMutation.mutate(s)}
              disabled={transitionMutation.isPending}
              data-testid={`button-transition-${s}`}
            >
              {s === "approved" ? <Check className="mr-1 h-3 w-3" /> : s === "rejected" ? <X className="mr-1 h-3 w-3" /> : <RefreshCw className="mr-1 h-3 w-3" />}
              {STATUS_LABELS[s] ?? s}
            </Button>
          ))}
          {canEdit && editActions.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => transitionMutation.mutate(s)}
              disabled={transitionMutation.isPending}
              data-testid={`button-transition-${s}`}
            >
              {STATUS_LABELS[s] ?? s}
            </Button>
          ))}
          {promotable && (
            <Button
              size="sm"
              className="h-7 text-xs ml-auto"
              onClick={() => promoteMutation.mutate()}
              disabled={promoteMutation.isPending}
              data-testid="button-promote-idea"
            >
              {promoteMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Rocket className="mr-1 h-3 w-3" />}
              Promote to article
            </Button>
          )}
          {idea.linkedArticleId && (
            <div className="ml-auto flex items-center gap-2">
              {linkedArticle && (
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${STATUS_BADGE_CLASS[linkedArticle.status] ?? ""}`}
                  data-testid="badge-linked-article-status"
                >
                  {STATUS_LABELS[linkedArticle.status] ?? linkedArticle.status}
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => navigate(`/admin/studio/articles/${idea.linkedArticleId}/edit`)}
                data-testid="button-open-linked-article"
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                Open article
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status + type badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[idea.status] ?? "bg-slate-100 text-slate-700"}`}>
            {STATUS_LABELS[idea.status] ?? idea.status}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {STUDIO_PIPELINE_CONTENT_TYPES.find((t) => t.value === idea.contentType)?.label ?? idea.contentType}
          </Badge>
          {(idea.channels as string[] | null)?.map((c) => (
            <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
          ))}
        </div>

        {/* ── Core section ── */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Core</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  defaultValue={idea.scheduledDate || ""}
                  onBlur={(e) => {
                    const v = e.target.value || null;
                    if (v !== (idea.scheduledDate || null)) patchMutation.mutate({ scheduledDate: v });
                  }}
                  className="h-8 text-sm"
                  disabled={!canEdit}
                  data-testid="input-detail-date"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Day</Label>
                <div className="flex h-8 items-center text-sm text-muted-foreground">{dayOfWeek}</div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Post Type</Label>
              <Select
                value={idea.contentType}
                onValueChange={(v) => patchMutation.mutate({ contentType: v })}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-8 text-sm" data-testid="select-detail-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDIO_PIPELINE_CONTENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Topic</Label>
              <Input
                defaultValue={idea.topic}
                onBlur={autoSave("topic")}
                className="h-8 text-sm"
                disabled={!canEdit}
                data-testid="input-detail-topic"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Details / Brief</Label>
              <Textarea
                defaultValue={idea.brief ?? ""}
                onBlur={autoSave("brief")}
                rows={3}
                className="text-sm"
                disabled={!canEdit}
                data-testid="input-detail-brief"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reference Link</Label>
              <Input
                defaultValue={idea.referenceLink ?? ""}
                onBlur={autoSave("referenceLink")}
                className="h-8 text-sm"
                type="url"
                placeholder="https://"
                disabled={!canEdit}
                data-testid="input-detail-reference"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Caption / Copy</Label>
              <Textarea
                defaultValue={idea.captionCopy ?? ""}
                onBlur={autoSave("captionCopy")}
                rows={3}
                className="text-sm"
                disabled={!canEdit}
                data-testid="input-detail-caption"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Requirement</Label>
              <Input
                defaultValue={idea.requirement ?? ""}
                onBlur={autoSave("requirement")}
                className="h-8 text-sm"
                placeholder="e.g. carousel 9-slide, single image"
                disabled={!canEdit}
                data-testid="input-detail-requirement"
              />
            </div>
          </div>
        </div>

        {/* ── Final Creative ── */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Final Creative</p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Final Creative URL</Label>
              <Input
                defaultValue={idea.creativeLink ?? ""}
                onBlur={autoSave("creativeLink")}
                className="h-8 text-sm"
                type="url"
                placeholder="https://drive.google.com/..."
                disabled={!canEdit}
                data-testid="input-detail-creative-url"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground flex-1">Creative Done</Label>
              <Switch
                checked={idea.creativeDone ?? false}
                onCheckedChange={(v) => patchMutation.mutate({ creativeDone: v })}
                disabled={!canEdit}
                data-testid="switch-detail-creative-done"
              />
              <span className="text-xs text-muted-foreground">{idea.creativeDone ? "Done" : "Pending"}</span>
            </div>
          </div>
        </div>

        {/* ── Story Track ── */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Story Track</p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Story Content</Label>
              <Textarea
                defaultValue={idea.storyContent ?? ""}
                onBlur={autoSave("storyContent")}
                rows={3}
                className="text-sm"
                placeholder="Story copy / script"
                disabled={!canEdit}
                data-testid="input-detail-story-content"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Story Reference</Label>
              <Input
                defaultValue={idea.storyReference ?? ""}
                onBlur={autoSave("storyReference")}
                className="h-8 text-sm"
                type="url"
                placeholder="https://"
                disabled={!canEdit}
                data-testid="input-detail-story-reference"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Final Story Creative URL</Label>
              <Input
                defaultValue={idea.storyCreativeLink ?? ""}
                onBlur={autoSave("storyCreativeLink")}
                className="h-8 text-sm"
                type="url"
                placeholder="https://"
                disabled={!canEdit}
                data-testid="input-detail-story-creative-url"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground flex-1">Story Creative Done</Label>
              <Switch
                checked={idea.storyCreativeDone ?? false}
                onCheckedChange={(v) => patchMutation.mutate({ storyCreativeDone: v })}
                disabled={!canEdit}
                data-testid="switch-detail-story-creative-done"
              />
              <span className="text-xs text-muted-foreground">{idea.storyCreativeDone ? "Done" : "Pending"}</span>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Story Publish Date</Label>
              <Input
                type="date"
                defaultValue={(idea as any).storyPublishDate ?? ""}
                onBlur={(e) => {
                  const v = e.target.value || null;
                  if (v !== ((idea as any).storyPublishDate || null)) patchMutation.mutate({ storyPublishDate: v });
                }}
                className="h-8 text-sm"
                disabled={!canEdit}
                data-testid="input-detail-story-publish-date"
              />
            </div>
          </div>
        </div>

        {/* ── Workflow ── */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Workflow</p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Assignee</Label>
              <Select
                value={idea.assignedToUserId || "unassigned"}
                onValueChange={(v) => patchMutation.mutate({ assignedToUserId: v === "unassigned" ? null : v })}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-8 text-sm" data-testid="select-detail-assignee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Watchers</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {watchers.map((w) => {
                  const member = members.find((m) => m.id === w.userId);
                  return (
                    <div key={w.userId} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                      <div className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold dark:bg-indigo-900/40 dark:text-indigo-300">
                        {member?.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
                      </div>
                      <span>{member?.name ?? w.userId}</span>
                      {canEdit && (
                        <button onClick={() => removeWatcherMutation.mutate(w.userId)} className="ml-0.5 text-muted-foreground hover:text-foreground" data-testid={`button-remove-watcher-${w.userId}`}>
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {canEdit && (
                  <Select
                    value=""
                    onValueChange={(v) => { if (v && !watcherUserIds.has(v)) addWatcherMutation.mutate(v); }}
                  >
                    <SelectTrigger className="h-7 w-auto text-xs gap-1 border-dashed" data-testid="select-add-watcher">
                      <Eye className="h-3 w-3" />
                      <span>Add watcher</span>
                    </SelectTrigger>
                    <SelectContent>
                      {members.filter((m) => !watcherUserIds.has(m.id)).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Comments ── */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Comments {(idea.comments?.length ?? 0) > 0 && `(${idea.comments.length})`}
          </p>
          <div className="space-y-2 mb-3">
            {(idea.comments ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No comments yet</p>
            )}
            {(idea.comments ?? []).map((c) => (
              <div key={c.id} className={`rounded-md bg-muted/40 p-2.5 text-sm ${c.resolvedAt ? "opacity-50" : ""}`} data-testid={`comment-${c.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CommentText message={c.message} />
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  {!c.resolvedAt && (
                    <button onClick={() => resolveMutation.mutate(c.id)} className="shrink-0 text-muted-foreground hover:text-emerald-600" title="Resolve" data-testid={`button-resolve-comment-${c.id}`}>
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <MentionCommentInput ideaId={ideaId} members={members} onSuccess={invalidate} />
        </div>
      </div>
    </div>
  );
}

// ─── Quick Create Idea Row ────────────────────────────────────────────────────
function QuickCreateIdeaRow({
  date, projectId, onCreated,
}: {
  date: string | null;
  projectId: string | null;
  onCreated: (idea: StudioContentIdea) => void;
}) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState("social_post");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/studio/content-ideas", {
        projectId: projectId ?? undefined,
        topic: topic.trim(),
        contentType,
        channels: contentType === "article" ? ["website"] : ["linkedin"],
        scheduledDate: date ?? undefined,
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: (idea) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      toast({ title: "Idea added", description: `Scheduled for ${date ?? "later"}` });
      setTopic("");
      onCreated(idea);
    },
    onError: (err: Error) => toast({ title: "Could not create idea", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex items-center gap-2 border-t pt-3 mt-3">
      <Input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Topic for this date…"
        className="flex-1 h-8 text-sm"
        data-testid="input-quick-create-topic"
        onKeyDown={(e) => { if (e.key === "Enter" && topic.trim() && !createMutation.isPending) createMutation.mutate(); }}
      />
      <Select value={contentType} onValueChange={setContentType}>
        <SelectTrigger className="h-8 w-32 text-xs" data-testid="select-quick-create-type"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STUDIO_PIPELINE_CONTENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        className="h-8"
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending || !topic.trim() || !projectId}
        data-testid="button-quick-create-idea"
      >
        {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// ─── Draft Article Schedule Row ───────────────────────────────────────────────
function DraftScheduleRow({
  article, date,
}: {
  article: CalendarItem;
  date: string;
}) {
  const { toast } = useToast();
  const [time, setTime] = useState("09:00");

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const res = await apiRequest("POST", `/api/admin/studio/articles/${article.id}/schedule-draft`, { scheduledAt });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/calendar"] });
      toast({ title: `"${article.title}" scheduled for ${date} at ${time}` });
    },
    onError: (e: Error) => toast({ title: "Schedule failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="rounded-md border p-2.5 space-y-2" data-testid={`draft-schedule-row-${article.id}`}>
      <p className="text-xs font-medium truncate">{article.title}</p>
      <div className="flex items-center gap-2">
        <Input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="h-7 w-28 text-xs"
          data-testid={`input-schedule-time-${article.id}`}
        />
        <Button
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={() => scheduleMutation.mutate()}
          disabled={scheduleMutation.isPending}
          data-testid={`button-schedule-draft-${article.id}`}
        >
          {scheduleMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CalIcon className="mr-1 h-3 w-3" />}
          Schedule
        </Button>
      </div>
    </div>
  );
}

// ─── Date Workspace Sheet ─────────────────────────────────────────────────────
function DayWorkspaceSheet({
  date, projectId, occasions, ideas, articles, canCreateArticle, canEdit, canSchedule, members,
  initialIdeaId, campaignMap, articleStatusMap, onClose,
}: {
  date: string | null;
  projectId: string | null;
  occasions: StudioOccasion[];
  ideas: StudioContentIdea[];
  articles: CalendarItem[];
  canCreateArticle: boolean;
  canEdit: boolean;
  canSchedule: boolean;
  members: { id: string; name: string }[];
  initialIdeaId?: string | null;
  campaignMap?: Record<string, string>;
  articleStatusMap?: Record<string, string>;
  onClose: () => void;
}) {
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(initialIdeaId ?? null);
  const [planningFor, setPlanningFor] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIdeaId(initialIdeaId ?? null);
  }, [initialIdeaId, date]);

  // Batch-fetch comment counts for all visible idea cards
  const ideaIds = ideas.map((i) => i.id);
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

  const displayDate = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <Sheet open={!!date} onOpenChange={(o) => { if (!o) { onClose(); setSelectedIdeaId(null); } }}>
      <SheetContent
        className="w-[95vw] max-w-none sm:max-w-none overflow-hidden flex flex-col"
        style={{ width: "min(95vw, 1200px)" }}
        data-testid="sheet-day-workspace"
      >
        <SheetHeader className="border-b pb-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <CalIcon className="h-4 w-4 text-muted-foreground" />
              {displayDate}
            </SheetTitle>
            {date && (
              <a
                href={selectedIdeaId ? `/studio/table?idea=${selectedIdeaId}` : `/studio/table?scheduled_date=${date}`}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                data-testid="link-view-in-pipeline"
                title={selectedIdeaId ? "Open this idea in Pipeline" : "View all ideas for this date in Pipeline"}
              >
                <ExternalLink className="h-3 w-3" />
                {selectedIdeaId ? "View Idea in Pipeline" : "View in Pipeline"}
              </a>
            )}
          </div>
          {occasions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {occasions.map((occ) => (
                <div key={occ.id} className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400" data-testid={`occasion-badge-ws-${occ.id}`}>
                  <Star className="h-3 w-3 fill-current" />
                  {occ.name}
                  <span className="text-amber-500/70">· {OCCASION_REGION_LABELS[occ.region] ?? occ.region}</span>
                </div>
              ))}
            </div>
          )}
        </SheetHeader>

        <div className="flex flex-1 overflow-hidden gap-0 mt-0">
          {/* Left: idea list */}
          <div className="w-72 shrink-0 border-r flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {ideas.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <CalIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>No ideas for this date</p>
                </div>
              )}
              {/* BD Agent ideas */}
              {ideas.filter((i) => i.origin === "bd_agent").length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 px-1 flex items-center gap-1">
                    ⚡ BD Intel Ideas ({ideas.filter((i) => i.origin === "bd_agent").length})
                  </p>
                  {ideas.filter((i) => i.origin === "bd_agent").map((idea) => (
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
              )}
              {/* Article-linked ideas */}
              {ideas.filter((i) => i.origin !== "bd_agent" && i.linkedArticleId).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 px-1 flex items-center gap-1">
                    📰 Article Ideas ({ideas.filter((i) => i.origin !== "bd_agent" && i.linkedArticleId).length})
                  </p>
                  {ideas.filter((i) => i.origin !== "bd_agent" && i.linkedArticleId).map((idea) => (
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
              )}
              {/* Calendar / manual ideas */}
              {ideas.filter((i) => i.origin !== "bd_agent" && !i.linkedArticleId).length > 0 && (
                <div className="space-y-1.5">
                  {(ideas.filter((i) => i.origin === "bd_agent").length > 0 || ideas.filter((i) => i.origin !== "bd_agent" && i.linkedArticleId).length > 0) && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 px-1 flex items-center gap-1">
                      📅 Calendar Ideas ({ideas.filter((i) => i.origin !== "bd_agent" && !i.linkedArticleId).length})
                    </p>
                  )}
                  {ideas.filter((i) => i.origin !== "bd_agent" && !i.linkedArticleId).map((idea) => (
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
              )}

              {/* Draft articles — schedule them directly from the workspace */}
              {canSchedule && articles.filter((a) => a.status === "draft").length > 0 && date && (
                <div className="pt-2 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">Schedule Draft Articles</p>
                  {articles.filter((a) => a.status === "draft").map((a) => (
                    <DraftScheduleRow key={a.id} article={a} date={date} />
                  ))}
                </div>
              )}

              {/* Occasions for planning */}
              {occasions.length > 0 && canCreateArticle && projectId && (
                <div className="pt-2 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">Plan for an occasion</p>
                  {occasions.map((occ) => (
                    <div key={occ.id} className="rounded-md border border-amber-200 bg-amber-50/60 p-2 dark:border-amber-900 dark:bg-amber-950/20" data-testid={`occasion-ws-${occ.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{occ.name}</span>
                        {planningFor !== occ.id && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setPlanningFor(occ.id)} data-testid={`button-plan-content-ws-${occ.id}`}>
                            <Sparkles className="mr-1 h-3 w-3" />Plan
                          </Button>
                        )}
                      </div>
                      {occ.contentAngle && <p className="mt-0.5 text-[10px] text-muted-foreground">{occ.contentAngle}</p>}
                      {planningFor === occ.id && (
                        <div className="mt-2">
                          <PlanContentForm occasion={occ} projectId={projectId} onDone={() => { setPlanningFor(null); queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] }); }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canCreateArticle && projectId && (
              <div className="px-3 pb-3 shrink-0">
                <QuickCreateIdeaRow date={date} projectId={projectId} onCreated={(idea) => setSelectedIdeaId(idea.id)} />
              </div>
            )}
          </div>

          {/* Right: detail pane */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedIdeaId ? (
              <IdeaDetailPane ideaId={selectedIdeaId} members={members} onClose={() => setSelectedIdeaId(null)} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <MessageSquare className="h-10 w-10 opacity-20" />
                <p className="text-sm">Select an idea to view its planner</p>
                {canCreateArticle && projectId && (
                  <p className="text-xs text-center">or add one using the form on the left</p>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Calendar Component ──────────────────────────────────────────────────
export default function Calendar() {
  const [, navigate] = useLocation();
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } = useStudioProject();
  const { can } = usePermissions();
  const canCreateArticle = can("studio.create_article");
  const canSchedulePublish = can("studio.schedule_publish");
  const [scope, setScope] = useState<"hireins" | "all">("all");
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [exportItem, setExportItem] = useState<CalendarItem | null>(null);
  const [cursor, setCursor] = useState(() => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  // Week cursor: start of the week (Monday)
  const [weekCursor, setWeekCursor] = useState(() => {
    const n = new Date();
    const day = n.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(n);
    mon.setDate(n.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  });

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);

  // Week range (Mon–Sun)
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekCursor);
    d.setDate(weekCursor.getDate() + i);
    weekDates.push(d);
  }
  const weekEnd = weekDates[6];

  // Calendar articles (published/scheduled)
  const { data: items, isLoading } = useQuery<CalendarItem[]>({
    queryKey: ["/api/admin/studio/calendar", selectedProjectId, ymd(viewMode === "month" ? monthStart : weekCursor)],
    queryFn: async () => {
      const from = viewMode === "month" ? monthStart : weekCursor;
      const to = viewMode === "month" ? monthEnd : weekEnd;
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      const res = await fetch(`/api/admin/studio/calendar?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load calendar");
      return res.json();
    },
  });

  const visible = (items ?? []).filter((a) => scope === "hireins" ? a.publishesToInsights : true);
  const byDay: Record<string, CalendarItem[]> = {};
  for (const a of visible) {
    const when = a.status === "scheduled" ? a.scheduledAt : a.publishedAt;
    if (!when) continue;
    const key = ymd(new Date(when));
    (byDay[key] ??= []).push(a);
  }

  // Occasions
  const { data: occasions } = useQuery<StudioOccasion[]>({
    queryKey: ["/api/admin/studio/occasions", selectedProjectId, ymd(viewMode === "month" ? monthStart : weekCursor)],
    queryFn: async () => {
      const from = viewMode === "month" ? monthStart : weekCursor;
      const to = viewMode === "month" ? monthEnd : weekEnd;
      const params = new URLSearchParams({ from: ymd(from), to: ymd(to) });
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

  // Content ideas (social posts)
  const { data: contentIdeas } = useQuery<StudioContentIdea[]>({
    queryKey: ["/api/admin/studio/content-ideas", selectedProjectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      const res = await fetch(`/api/admin/studio/content-ideas?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const ideasByDay: Record<string, StudioContentIdea[]> = {};
  for (const idea of contentIdeas ?? []) {
    const key = normalizeScheduledDate(idea.scheduledDate as string | Date | null | undefined);
    if (!key) continue;
    (ideasByDay[key] ??= []).push(idea);
  }

  const hasIdeasThisMonth = (contentIdeas ?? []).some((idea) => {
    const ds = normalizeScheduledDate(idea.scheduledDate as string | Date | null | undefined);
    if (!ds) return false;
    const d = new Date(`${ds}T00:00:00`);
    return d >= monthStart && d <= monthEnd;
  });

  // Batch-fetch linked article statuses for all ideas in this project (used by chips + DayIdeaCard)
  const hasLinkedIdeas = (contentIdeas ?? []).some((i) => i.linkedArticleId);
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
    for (const a of linkedArticlesPage?.items ?? []) m[a.id] = a.status;
    return m;
  }, [linkedArticlesPage]);

  // Campaigns for this project — used for campaign dot on chips
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

  // Members for @mention + assignee
  const { data: members = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/studio/assignees"],
  });

  const todayKey = ymd(new Date());
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const weekLabel = `${weekCursor.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  const goToDay = (dateKey: string, ideaId?: string) => {
    const base = selectedProjectId
      ? `/admin/studio/calendar/${dateKey}?projectId=${encodeURIComponent(selectedProjectId)}`
      : `/admin/studio/calendar/${dateKey}`;
    navigate(ideaId ? `${base}${selectedProjectId ? "&" : "?"}idea=${ideaId}` : base);
  };

  // Build month grid cells
  const firstWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const exportKit = exportItem ? ((exportItem.socialKitJsonb as CanonicalSocialKit | null) ?? null) : null;

  const downloadSocialKit = (item: CalendarItem) => {
    const kit = (item.socialKitJsonb as CanonicalSocialKit | null) ?? {};
    const payload = { title: item.title, project: item.projectName, author: item.authorName, seoTitle: item.seoTitle, seoDescription: item.seoDescription, coverImageUrl: item.coverImageUrl, socialKit: kit };
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

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-calendar-title">Publishing Calendar</h1>
            <p className="text-sm text-muted-foreground">Click a day to open the workspace. Up to 2 idea chips per cell.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canCreateArticle && <AIPlanDialog projectId={selectedProjectId} monthStart={monthStart} monthEnd={monthEnd} />}
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "month" | "week")} variant="outline" size="sm">
              <ToggleGroupItem value="month" data-testid="toggle-month-view">Month</ToggleGroupItem>
              <ToggleGroupItem value="week" data-testid="toggle-week-view">Week</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="single" value={scope} onValueChange={(v) => v && setScope(v as "hireins" | "all")} variant="outline" size="sm">
              <ToggleGroupItem value="hireins" data-testid="toggle-hireins">Hire'in</ToggleGroupItem>
              <ToggleGroupItem value="all" data-testid="toggle-all-projects">All Projects</ToggleGroupItem>
            </ToggleGroup>
            <ProjectSwitcher projects={projects} projectsLoading={projectsLoading} selectedProjectId={selectedProjectId} onChange={setSelectedProjectId} />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {viewMode === "month" ? (
              <>
                <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} data-testid="button-prev-month"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="min-w-[160px] text-center text-sm font-semibold" data-testid="text-month-label">{monthLabel}</span>
                <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} data-testid="button-next-month"><ChevronRight className="h-4 w-4" /></Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="icon" onClick={() => { const d = new Date(weekCursor); d.setDate(d.getDate() - 7); setWeekCursor(d); }} data-testid="button-prev-week"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="min-w-[200px] text-center text-sm font-semibold" data-testid="text-week-label">{weekLabel}</span>
                <Button variant="outline" size="icon" onClick={() => { const d = new Date(weekCursor); d.setDate(d.getDate() + 7); setWeekCursor(d); }} data-testid="button-next-week"><ChevronRight className="h-4 w-4" /></Button>
              </>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); const day = n.getDay(); const diff = day === 0 ? -6 : 1 - day; const mon = new Date(n); mon.setDate(n.getDate() + diff); mon.setHours(0, 0, 0, 0); setWeekCursor(mon); }} data-testid="button-today">Today</Button>
        </div>

        {!isLoading && visible.length === 0 && !hasIdeasThisMonth && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center text-muted-foreground" data-testid="calendar-empty-state">
            <CalIcon className="mb-3 h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">Your calendar is empty</p>
            <p className="mt-1 text-xs">Schedule an article or add a planned idea to get started.</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : viewMode === "month" ? (
          /* ── Month view ── */
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="px-2 py-1 text-center text-xs font-semibold text-muted-foreground">{w}</div>
                ))}
                {cells.map((cell, i) => {
                  if (!cell) return <div key={i} className="min-h-[96px] rounded-md bg-muted/20" />;
                  const key = ymd(cell);
                  const dayItems = byDay[key] ?? [];
                  const dayOccasions = occByDay[key] ?? [];
                  const dayIdeas = ideasByDay[key] ?? [];
                  const visibleIdeas = dayIdeas.slice(0, 2);
                  const overflowCount = dayIdeas.length - 2;

                  return (
                    <div
                      key={i}
                      className={`group min-h-[96px] rounded-md border p-1.5 transition-colors cursor-pointer hover:bg-muted/30 ${key === todayKey ? "border-primary" : ""}`}
                      onClick={() => goToDay(key)}
                      data-testid={`calendar-day-${key}`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {cell.getDate()}
                          {dayOccasions.length > 0 && (
                            <span className="inline-flex items-center text-amber-500" title={dayOccasions.map((o) => o.name).join(" · ")} data-testid={`occasion-badge-${key}`}>
                              <Star className="h-3 w-3 fill-current" />
                            </span>
                          )}
                        </span>
                        {canCreateArticle && selectedProjectId && (
                          <button
                            className="hidden rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground group-hover:flex"
                            title="Open workspace for this date"
                            onClick={(e) => { e.stopPropagation(); goToDay(key); }}
                            data-testid={`button-add-article-${key}`}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {/* Article chips */}
                        {dayItems.map((a) => {
                          const isDraftPlanned = a.status === "draft";
                          const readyToExport = !isDraftPlanned && !a.publishesToInsights;
                          return (
                            <button
                              key={a.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (readyToExport) setExportItem(a);
                                else navigate(`/admin/studio/articles/${a.id}/edit`);
                              }}
                              className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] hover-elevate ${
                                isDraftPlanned ? "border border-dashed bg-gray-50 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400"
                                : readyToExport ? "border border-dashed bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                                : STATUS_BADGE_CLASS[a.status] ?? ""
                              }`}
                              title={isDraftPlanned ? `${a.title} — Planned Draft` : readyToExport ? `${a.title} — Ready to Export` : `${a.title} — ${a.status}`}
                              data-testid={`calendar-item-${a.id}`}
                            >
                              {isDraftPlanned ? `· ${a.title}` : readyToExport ? `⇩ ${a.title}` : a.title}
                            </button>
                          );
                        })}
                        {/* Idea chips (capped at 2) */}
                        {visibleIdeas.map((idea) => {
                          const campaignName = (idea as any).campaignId ? campaignMap[(idea as any).campaignId] : undefined;
                          const isBD = idea.origin === "bd_agent";
                          const linkedArtStatus = idea.linkedArticleId ? articleStatusMap[idea.linkedArticleId] : null;
                          return (
                            <button
                              key={idea.id}
                              onClick={(e) => { e.stopPropagation(); goToDay(key, idea.id); }}
                              className="flex w-full items-center gap-1 rounded border border-dashed border-violet-300 bg-violet-50 px-1.5 py-0.5 text-left text-[11px] text-violet-800 hover-elevate dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300"
                              title={`${idea.topic}${campaignName ? ` · ${campaignName}` : ""}${isBD ? " · BD Intel" : ""}${linkedArtStatus ? ` · Article: ${linkedArtStatus}` : ""}`}
                              data-testid={`calendar-idea-${idea.id}`}
                            >
                              {isBD && <span className="shrink-0 text-amber-500">⚡</span>}
                              {campaignName && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" title={campaignName} />}
                              {linkedArtStatus && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_BADGE_CLASS[linkedArtStatus] ? "bg-indigo-500" : "bg-indigo-300"}`} title={`Article: ${STATUS_LABELS[linkedArtStatus] ?? linkedArtStatus}`} />}
                              <span className="truncate">{TYPE_ICON[idea.contentType] || "✦"} {idea.topic}</span>
                            </button>
                          );
                        })}
                        {/* +N more overflow */}
                        {overflowCount > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); goToDay(key); }}
                            className="block w-full text-left px-1.5 text-[10px] text-violet-600 hover:text-violet-800 dark:text-violet-400 font-medium"
                            data-testid={`overflow-link-${key}`}
                          >
                            +{overflowCount} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* ── Week view ── */
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-7 gap-1">
                {weekDates.map((date) => {
                  const key = ymd(date);
                  const dayOccasions = occByDay[key] ?? [];
                  const dayIdeas = ideasByDay[key] ?? [];
                  const dayItems = byDay[key] ?? [];
                  return (
                    <div key={key} className={`rounded-md border ${key === todayKey ? "border-primary" : ""}`} data-testid={`week-day-${key}`}>
                      {/* Day header */}
                      <button
                        onClick={() => goToDay(key)}
                        className="w-full rounded-t-md px-2 py-2 text-center hover:bg-muted/40 transition-colors"
                        data-testid={`week-day-header-${key}`}
                      >
                        <div className="text-xs text-muted-foreground">{WEEKDAYS[date.getDay()]}</div>
                        <div className={`text-sm font-semibold ${key === todayKey ? "text-primary" : ""}`}>{date.getDate()}</div>
                        {dayOccasions.length > 0 && <Star className="h-3 w-3 text-amber-500 fill-current mx-auto mt-0.5" />}
                      </button>
                      {/* Cards */}
                      <div className="p-1.5 space-y-1 min-h-[120px]">
                        {dayItems.slice(0, 2).map((a) => (
                          <button
                            key={a.id}
                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/studio/articles/${a.id}/edit`); }}
                            className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] ${STATUS_BADGE_CLASS[a.status] ?? ""}`}
                            data-testid={`week-item-${a.id}`}
                          >
                            {a.title}
                          </button>
                        ))}
                        {dayIdeas.slice(0, 3).map((idea) => {
                          const campaignName = (idea as any).campaignId ? campaignMap[(idea as any).campaignId] : undefined;
                          const isBD = idea.origin === "bd_agent";
                          const linkedArtStatus = idea.linkedArticleId ? articleStatusMap[idea.linkedArticleId] : null;
                          return (
                            <button
                              key={idea.id}
                              onClick={(e) => { e.stopPropagation(); goToDay(key, idea.id); }}
                              className="flex w-full items-center gap-1 rounded border border-dashed border-violet-300 bg-violet-50 px-1.5 py-0.5 text-left text-[10px] text-violet-800 hover-elevate dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300"
                              title={`${idea.topic}${campaignName ? ` · ${campaignName}` : ""}${isBD ? " · BD Intel" : ""}${linkedArtStatus ? ` · Article: ${linkedArtStatus}` : ""}`}
                              data-testid={`week-idea-${idea.id}`}
                            >
                              {isBD && <span className="shrink-0 text-amber-500">⚡</span>}
                              {campaignName && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />}
                              {linkedArtStatus && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_BADGE_CLASS[linkedArtStatus] ? "bg-indigo-500" : "bg-indigo-300"}`} title={`Article: ${STATUS_LABELS[linkedArtStatus] ?? linkedArtStatus}`} />}
                              <span className="truncate">{TYPE_ICON[idea.contentType] || "✦"} {idea.topic}</span>
                            </button>
                          );
                        })}
                        {dayIdeas.length > 3 && (
                          <button
                            onClick={() => goToDay(key)}
                            className="block w-full text-left px-1.5 text-[10px] text-violet-600 hover:text-violet-800 dark:text-violet-400 font-medium"
                            data-testid={`week-overflow-${key}`}
                          >
                            +{dayIdeas.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded border border-dashed border-violet-300 bg-violet-50 px-1.5 py-0.5 text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300">✦ Planned idea</span>
          <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-current text-amber-500" /> Occasion</span>
          <span className="text-muted-foreground/60 ml-auto">Click a day to view its ideas</span>
        </div>
      </div>

      {/* Social kit export sheet */}
      <Sheet open={!!exportItem} onOpenChange={(open) => !open && setExportItem(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg" data-testid="sheet-social-kit">
          <SheetHeader>
            <SheetTitle>Ready to Export</SheetTitle>
            <SheetDescription>{exportItem?.title}{exportItem?.projectName ? ` — ${exportItem.projectName}` : ""}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <Button onClick={() => exportItem && downloadSocialKit(exportItem)} data-testid="button-download-social-kit">
              <Download className="mr-2 h-4 w-4" />Download Social Kit (JSON)
            </Button>
            <SocialKitPreview kit={exportKit} />
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
