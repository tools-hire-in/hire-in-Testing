import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StudioShell } from "@/components/studio/StudioShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Lightbulb,
  Loader2,
  Megaphone,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useStudioProject } from "@/pages/admin/studio/useStudioProject";
import { studioPath } from "@/lib/studioBase";
import { STUDIO_IDEA_STATUSES } from "@shared/studioContent";
import type { StudioContentIdea, StudioCampaign } from "@shared/schema";

// ── Constants ────────────────────────────────────────────────────────────────
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
  suggested: "bg-slate-100 text-slate-600 border border-dashed border-slate-400",
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

const PLATFORM_CLASS: Record<string, string> = {
  linkedin: "bg-blue-600 text-white",
  instagram: "bg-pink-500 text-white",
  facebook: "bg-indigo-600 text-white",
  x: "bg-slate-800 text-white",
  website: "bg-slate-200 text-slate-700",
};

// Canonical format values (slug → display label)
export const IDEA_FORMATS: { value: string; label: string }[] = [
  { value: "carousel", label: "Carousel" },
  { value: "static_post", label: "Static Post" },
  { value: "reel", label: "Reel" },
  { value: "story", label: "Story" },
  { value: "video_script", label: "Video Script" },
];

const FORMAT_LABEL: Record<string, string> = Object.fromEntries(
  IDEA_FORMATS.map((f) => [f.value, f.label]),
);

const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X (Twitter)" },
];

const CREATION_STEPS = ["Topic", "Platform", "Format", "Generate"] as const;

function fmtDate(d?: string | Date | null): string {
  if (!d) return "";
  try {
    const date = typeof d === "string" ? new Date(`${d.length === 10 ? d + "T00:00:00" : d}`) : d;
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}

function isMissed(idea: StudioContentIdea): boolean {
  if (!idea.scheduledDate) return false;
  if (["published", "done"].includes(idea.status)) return false;
  return idea.scheduledDate < new Date().toISOString().slice(0, 10);
}

// ── Multi-select filter component ────────────────────────────────────────────
function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  testId,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  testId?: string;
}) {
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((s) => s !== value) : [...selected, value]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors ${
            selected.length > 0
              ? "border-primary bg-primary/5 text-primary font-medium"
              : "border-border bg-background text-foreground hover:bg-muted"
          }`}
          data-testid={testId}
        >
          {selected.length > 0 ? `${label}: ${selected.length}` : label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <div className="space-y-1">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
                data-testid={`checkbox-${opt.value}`}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Idea card ─────────────────────────────────────────────────────────────────
function IdeaCard({
  idea,
  campaignMap,
  onClick,
}: {
  idea: StudioContentIdea;
  campaignMap: Record<string, string>;
  onClick: () => void;
}) {
  const channels = (idea.channels as string[] | null) ?? [];
  const missed = isMissed(idea);
  const fmt = (idea as any).format as string | null | undefined;
  const publishedAt = (idea as any).publishedAt as string | null | undefined;
  const isPublished = idea.status === "published";

  return (
    <button
      className="w-full text-left rounded-xl border bg-card hover:shadow-md transition-shadow p-4 space-y-3"
      onClick={onClick}
      data-testid={`card-idea-${idea.id}`}
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 min-w-0 text-sm font-semibold truncate" data-testid={`text-idea-topic-${idea.id}`}>
          {idea.topic}
        </p>
        {missed && (
          <span
            className="shrink-0 flex items-center gap-0.5 rounded-full bg-red-100 border border-red-300 px-1.5 py-0.5 text-[10px] font-semibold text-red-700"
            data-testid={`badge-missed-${idea.id}`}
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            Missed
          </span>
        )}
      </div>

      {idea.brief && (
        <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-idea-brief-${idea.id}`}>
          {idea.brief}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[idea.status] ?? "bg-slate-100 text-slate-700"}`}
          data-testid={`badge-status-${idea.id}`}
        >
          {STATUS_LABEL[idea.status] ?? idea.status}
        </span>

        {channels.slice(0, 2).map((c) => (
          <span
            key={c}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${PLATFORM_CLASS[c] ?? "bg-slate-100 text-slate-700"}`}
            data-testid={`badge-platform-${idea.id}-${c}`}
          >
            {c === "x" ? "X" : c}
          </span>
        ))}

        {fmt && (
          <span
            className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700"
            data-testid={`badge-format-${idea.id}`}
          >
            {FORMAT_LABEL[fmt] ?? fmt}
          </span>
        )}

        {(idea as any).campaignId && campaignMap[(idea as any).campaignId] && (
          <span
            className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
            data-testid={`badge-campaign-${idea.id}`}
          >
            <Megaphone className="h-2.5 w-2.5" />
            {campaignMap[(idea as any).campaignId]}
          </span>
        )}
      </div>

      {(idea.scheduledDate || isPublished) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-date-${idea.id}`}>
          <CalendarDays className="h-3 w-3" />
          {isPublished && publishedAt ? (
            <span className="text-violet-600 font-medium">Published {fmtDate(publishedAt)}</span>
          ) : isPublished ? (
            <span className="text-violet-600 font-medium">Published</span>
          ) : (
            fmtDate(idea.scheduledDate)
          )}
        </div>
      )}
    </button>
  );
}

// ── Creation dialog ───────────────────────────────────────────────────────────
function CreatePostDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");
  const [platform, setPlatform] = useState("linkedin");
  const [format, setFormat] = useState<string>("static_post");
  const [scheduledDate, setScheduledDate] = useState("");
  const [generatedCaption, setGeneratedCaption] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (caption?: string) => {
      const body: Record<string, unknown> = {
        projectId,
        topic: topic.trim(),
        contentType: "social_post",
        channels: [platform],
        format,
        brief: brief.trim() || undefined,
        scheduledDate: scheduledDate || undefined,
      };
      const res = await apiRequest("POST", "/api/studio/content-ideas", body);
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to create");
      }
      const idea = await res.json();
      if (caption && idea.id) {
        await apiRequest("PATCH", `/api/studio/content-ideas/${idea.id}`, {
          generatedContentJsonb: {
            platform,
            format,
            caption,
            generatedAt: new Date().toISOString(),
          },
        }).catch(() => {});
      }
      return idea;
    },
    onSuccess: (idea: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      toast({ title: "Social post created" });
      onOpenChange(false);
      navigate(studioPath(`/ideas/${idea.id}`));
    },
    onError: (e: Error) => toast({ title: "Failed to create", description: e.message, variant: "destructive" }),
  });

  async function handleGenerate() {
    if (!topic.trim()) return;
    setIsGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/admin/studio/calendar/generate-social-draft", {
        topic: topic.trim(),
        platform,
        format: FORMAT_LABEL[format] ?? format,
      });
      const data = await res.json();
      setGeneratedCaption(data.caption ?? "");
      setStep(3);
    } catch {
      toast({ title: "AI draft failed", description: "Could not generate draft. You can still save the idea.", variant: "destructive" });
      setStep(3);
    } finally {
      setIsGenerating(false);
    }
  }

  function reset() {
    setStep(0);
    setTopic("");
    setBrief("");
    setPlatform("linkedin");
    setFormat("static_post");
    setScheduledDate("");
    setGeneratedCaption("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg" data-testid="dialog-create-post">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            New Social Post
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {CREATION_STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
                data-testid={`step-indicator-${i}`}
              >
                {i + 1}
              </div>
              <span className={`text-xs ${i === step ? "font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
              {i < CREATION_STEPS.length - 1 && (
                <div className={`flex-1 h-px ${i < step ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="cp-topic">Topic / Title *</Label>
              <Input
                id="cp-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. 5 signs your hiring process is losing candidates"
                data-testid="input-create-topic"
              />
            </div>
            <div>
              <Label htmlFor="cp-brief">Brief (optional)</Label>
              <Textarea
                id="cp-brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Key points to cover, angle, or context"
                rows={2}
                data-testid="input-create-brief"
              />
            </div>
            <div>
              <Label htmlFor="cp-date">Scheduled date (optional)</Label>
              <Input
                id="cp-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                data-testid="input-create-date"
              />
            </div>
            <Button
              className="w-full"
              disabled={!topic.trim()}
              onClick={() => setStep(1)}
              data-testid="button-next-step-1"
            >
              Next: Choose Platform →
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Platform</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPlatform(p.value)}
                    className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                      platform === p.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                    data-testid={`button-platform-${p.value}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(0)} data-testid="button-back-step-0">
                ← Back
              </Button>
              <Button className="flex-1" onClick={() => setStep(2)} data-testid="button-next-step-2">
                Next: Choose Format →
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Post Format</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {IDEA_FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={`rounded-lg border p-3 text-sm font-medium text-center transition-colors ${
                      format === f.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                    data-testid={`button-format-${f.value}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)} data-testid="button-back-step-1">
                ← Back
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleGenerate}
                disabled={isGenerating}
                data-testid="button-generate-draft"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate AI Draft
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground text-sm"
              onClick={() => { setStep(3); setGeneratedCaption(""); }}
              data-testid="button-skip-generate"
            >
              Skip — save idea without AI draft
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {generatedCaption ? (
              <>
                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground" data-testid="badge-ai-generated">
                  <span className="font-semibold text-emerald-600">✓ AI draft generated</span>
                  {" "}· {PLATFORMS.find((p) => p.value === platform)?.label} · {FORMAT_LABEL[format] ?? format}
                </div>
                <div>
                  <Label htmlFor="cp-caption">Caption (edit as needed)</Label>
                  <Textarea
                    id="cp-caption"
                    value={generatedCaption}
                    onChange={(e) => setGeneratedCaption(e.target.value)}
                    rows={6}
                    className="text-sm"
                    data-testid="textarea-generated-caption"
                  />
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground" data-testid="panel-no-draft">
                <Lightbulb className="mx-auto h-6 w-6 mb-2 opacity-40" />
                Idea will be saved without an AI draft. You can generate one from the detail page.
              </div>
            )}

            <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <p><strong>Topic:</strong> {topic}</p>
              <p><strong>Platform:</strong> {PLATFORMS.find((p) => p.value === platform)?.label}</p>
              <p><strong>Format:</strong> {FORMAT_LABEL[format] ?? format}</p>
              {scheduledDate && <p><strong>Scheduled:</strong> {fmtDate(scheduledDate)}</p>}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)} data-testid="button-back-step-2">
                ← Back
              </Button>
              <Button
                className="flex-1"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate(generatedCaption || undefined)}
                data-testid="button-save-idea"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Social Post
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function IdeasBank() {
  const [, navigate] = useLocation();
  const { can } = usePermissions();
  const { selectedProjectId } = useStudioProject();
  const canCreate = can("studio.create_article");

  const [createOpen, setCreateOpen] = useState(() => {
    return new URLSearchParams(window.location.search).get("create") === "true";
  });

  // Multi-select filter state
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterPlatform, setFilterPlatform] = useState<string[]>([]);
  const [filterFormat, setFilterFormat] = useState<string[]>([]);
  const [filterCampaign, setFilterCampaign] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: ideas = [], isLoading } = useQuery<StudioContentIdea[]>({
    queryKey: ["/api/studio/content-ideas", { projectId: selectedProjectId, contentType: "social_post" }],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const params = new URLSearchParams({ projectId: selectedProjectId, contentType: "social_post" });
      const res = await fetch(`/api/studio/content-ideas?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: campaigns = [] } = useQuery<StudioCampaign[]>({
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
    const map: Record<string, string> = {};
    for (const c of campaigns) map[c.id] = c.name;
    return map;
  }, [campaigns]);

  const filtered = useMemo(() => {
    return ideas.filter((idea) => {
      if (filterStatus.length > 0 && !filterStatus.includes(idea.status)) return false;
      if (filterPlatform.length > 0) {
        const channels = (idea.channels as string[] | null) ?? [];
        if (!channels.some((c) => filterPlatform.includes(c))) return false;
      }
      if (filterFormat.length > 0) {
        const fmt = (idea as any).format as string | null;
        if (!fmt || !filterFormat.includes(fmt)) return false;
      }
      if (filterCampaign !== "all" && (idea as any).campaignId !== filterCampaign) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!idea.topic.toLowerCase().includes(q) && !(idea.brief ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [ideas, filterStatus, filterPlatform, filterFormat, filterCampaign, search]);

  const hasFilters = filterStatus.length > 0 || filterPlatform.length > 0 || filterFormat.length > 0 || filterCampaign !== "all" || !!search;

  const statusOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of ideas) counts[i.status] = (counts[i.status] ?? 0) + 1;
    return STUDIO_IDEA_STATUSES.map((s) => ({
      value: s,
      label: `${STATUS_LABEL[s] ?? s}${counts[s] ? ` (${counts[s]})` : ""}`,
    }));
  }, [ideas]);

  return (
    <StudioShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Ideas Bank
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Social posts — from idea to published
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} data-testid="button-new-social-post">
              <Plus className="mr-1.5 h-4 w-4" />
              New Social Post
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search ideas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48"
            data-testid="input-ideas-search"
          />

          <MultiSelectFilter
            label="Status"
            options={statusOptions}
            selected={filterStatus}
            onChange={setFilterStatus}
            testId="filter-status"
          />

          <MultiSelectFilter
            label="Platform"
            options={PLATFORMS}
            selected={filterPlatform}
            onChange={setFilterPlatform}
            testId="filter-platform"
          />

          <MultiSelectFilter
            label="Format"
            options={IDEA_FORMATS}
            selected={filterFormat}
            onChange={setFilterFormat}
            testId="filter-format"
          />

          {campaigns.length > 0 && (
            <Select value={filterCampaign} onValueChange={setFilterCampaign}>
              <SelectTrigger className="h-8 w-40" data-testid="select-filter-campaign">
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-muted-foreground"
              onClick={() => {
                setFilterStatus([]);
                setFilterPlatform([]);
                setFilterFormat([]);
                setFilterCampaign("all");
                setSearch("");
              }}
              data-testid="button-clear-filters"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : !selectedProjectId ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2" data-testid="panel-no-project">
            <AlertCircle className="h-8 w-8 opacity-40" />
            <p className="text-sm">Select a project to view ideas.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3" data-testid="panel-empty">
            <Lightbulb className="h-10 w-10 opacity-30" />
            <div className="text-center">
              <p className="font-medium">
                {hasFilters ? "No ideas match your filters" : "No social post ideas yet"}
              </p>
              <p className="text-sm mt-0.5">
                {hasFilters ? "Try adjusting your filters." : "Create your first social post idea to get started."}
              </p>
            </div>
            {!hasFilters && canCreate && (
              <Button onClick={() => setCreateOpen(true)} data-testid="button-empty-create">
                <Plus className="mr-1.5 h-4 w-4" />
                New Social Post
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground" data-testid="text-result-count">
              {filtered.length} idea{filtered.length !== 1 ? "s" : ""}
              {hasFilters && ` (filtered from ${ideas.length})`}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  campaignMap={campaignMap}
                  onClick={() => navigate(studioPath(`/ideas/${idea.id}`))}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {selectedProjectId && (
        <CreatePostDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={selectedProjectId}
        />
      )}
    </StudioShell>
  );
}
