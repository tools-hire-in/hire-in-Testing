import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useStudioProject } from "@/pages/admin/studio/useStudioProject";
import { ProjectSwitcher } from "@/pages/admin/studio/ProjectSwitcher";
import { studioPath } from "@/lib/studioBase";
import { StudioTip } from "@/components/studio/StudioTip";
import { Link } from "wouter";
import {
  STUDIO_PIPELINE_CONTENT_TYPES,
  STUDIO_IDEA_STATUSES,
  STUDIO_IDEA_TRANSITIONS,
  STUDIO_CHANNELS,
  STUDIO_PILLARS,
  STUDIO_IDEA_ORIGINS,
  getPipelineContentType,
  type StudioIdeaStatus,
} from "@shared/studioContent";
import type { StudioContentIdea, StudioIdeaComment, StudioImportBatch } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  ExternalLink,
  ImageIcon,
  Inbox,
  Loader2,
  MessageSquare,
  Plus,
  Pencil,
  Table2,
  Undo2,
  Upload,
} from "lucide-react";

type Lens = "calendar" | "board" | "table";

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
  suggested: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-dashed border-slate-400",
  idea: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  in_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  changes_requested: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  in_production: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  scheduled: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  published: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  done: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const TYPE_ICON: Record<string, string> = {
  article: "📄",
  social_post: "📣",
  story: "⏱",
};

const BOARD_COLUMNS: StudioIdeaStatus[] = [
  "suggested",
  "idea",
  "in_review",
  "changes_requested",
  "approved",
  "in_production",
  "scheduled",
  "published",
  "done",
];

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={`text-[10px] px-1.5 py-0 font-medium ${STATUS_CLASS[status] || ""}`}
      data-testid={`badge-idea-status-${status}`}
    >
      {STATUS_LABEL[status] || status}
    </Badge>
  );
}

// Inline click-to-edit text cell used by the Table lens.
function EditableTextCell({
  value,
  placeholder,
  onSave,
  isLink,
  testId,
}: {
  value: string | null | undefined;
  placeholder: string;
  onSave: (v: string | null) => void;
  isLink?: boolean;
  testId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim() || null;
    if (next !== (value?.trim() || null)) onSave(next);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-7 min-w-32 text-xs"
        placeholder={placeholder}
        data-testid={`input-${testId}`}
      />
    );
  }
  return (
    <div className="group/cell flex min-w-24 items-center gap-1">
      {value && isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="max-w-40 truncate text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
          data-testid={`link-${testId}`}
        >
          {value.replace(/^https?:\/\//, "")}
        </a>
      ) : (
        <span className={`max-w-48 truncate ${value ? "" : "text-muted-foreground"}`} data-testid={`text-${testId}`}>
          {value || "—"}
        </span>
      )}
      <button
        className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted group-hover/cell:opacity-100"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        title={`Edit ${placeholder.toLowerCase()}`}
        data-testid={`button-edit-${testId}`}
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Quick create ────────────────────────────────────────────────────────────
function QuickCreateDialog({
  open,
  onOpenChange,
  projectId,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  defaultDate?: string;
}) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState("social_post");
  const [channels, setChannels] = useState<string[]>([]);
  const [pillar, setPillar] = useState("");
  const [brief, setBrief] = useState("");
  const [scheduledDate, setScheduledDate] = useState(defaultDate || "");

  useEffect(() => {
    if (open) {
      setScheduledDate(defaultDate || "");
      setTopic("");
      setBrief("");
    }
  }, [open, defaultDate]);

  const typeCfg = getPipelineContentType(contentType);
  const allowedChannels = typeCfg?.channels ?? [];

  useEffect(() => {
    setChannels((prev) => prev.filter((c) => (allowedChannels as readonly string[]).includes(c)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/studio/content-ideas", {
        projectId,
        topic,
        contentType,
        channels,
        pillar: pillar || undefined,
        brief: brief || undefined,
        scheduledDate: scheduledDate || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      toast({ title: "Idea created", description: scheduledDate ? "Added to the plan." : "Added to the backlog." });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Couldn't create idea", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New content idea</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="qc-topic">Topic *</Label>
            <Input
              id="qc-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 5 interview red flags"
              data-testid="input-idea-topic"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger data-testid="select-idea-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STUDIO_PIPELINE_CONTENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="qc-date">Scheduled date</Label>
              <Input
                id="qc-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                data-testid="input-idea-date"
              />
            </div>
          </div>
          <div>
            <Label>Channels</Label>
            <div className="mt-1 flex flex-wrap gap-3">
              {allowedChannels.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={channels.includes(c)}
                    onCheckedChange={(v) =>
                      setChannels((prev) => (v ? [...prev, c] : prev.filter((x) => x !== c)))
                    }
                    data-testid={`checkbox-channel-${c}`}
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Pillar</Label>
            <Select value={pillar || "none"} onValueChange={(v) => setPillar(v === "none" ? "" : v)}>
              <SelectTrigger data-testid="select-idea-pillar"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {STUDIO_PILLARS.map((p) => (
                  <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="qc-brief">Brief</Label>
            <Textarea
              id="qc-brief"
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="What should this piece cover?"
              data-testid="input-idea-brief"
            />
          </div>
          <Button
            className="w-full"
            disabled={!topic.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            data-testid="button-create-idea"
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create idea
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Import wizard ───────────────────────────────────────────────────────────
function ImportWizardDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"import" | "batches">("import");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("import.csv");
  const [preview, setPreview] = useState<any | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: batches } = useQuery<StudioImportBatch[]>({
    queryKey: ["/api/studio/import/batches", { projectId }],
    enabled: open && tab === "batches" && !!projectId,
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/studio/import/content-calendar/preview", { csv });
      return res.json();
    },
    onSuccess: (data) => setPreview(data),
    onError: (e: Error) => toast({ title: "Preview failed", description: e.message, variant: "destructive" }),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/studio/import/content-calendar/commit", {
        csv,
        projectId,
        fileName,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio/import/batches"] });
      toast({
        title: "Import complete",
        description: `${data.createdIdeas} idea(s) created from ${data.validRows} row(s).`,
      });
      setCsv("");
      setPreview(null);
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const rollbackMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const res = await apiRequest("POST", `/api/studio/import/${batchId}/rollback`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio/import/batches"] });
      toast({ title: "Batch rolled back", description: `${data.archivedIdeas} idea(s) archived.` });
    },
    onError: (e: Error) => toast({ title: "Rollback failed", description: e.message, variant: "destructive" }),
  });

  const handleFile = (f: File) => {
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result || ""));
      setPreview(null);
    };
    reader.readAsText(f);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import content plan (CSV)</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 border-b pb-2">
          <Button size="sm" variant={tab === "import" ? "default" : "ghost"} onClick={() => setTab("import")} data-testid="tab-import">
            Import
          </Button>
          <Button size="sm" variant={tab === "batches" ? "default" : "ghost"} onClick={() => setTab("batches")} data-testid="tab-batches">
            Past imports
          </Button>
        </div>

        {tab === "import" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} data-testid="button-pick-csv">
                <Upload className="mr-1.5 h-4 w-4" />
                Choose CSV file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <a href="/api/studio/import/template" download>
                <Button size="sm" variant="ghost" data-testid="button-download-template">
                  <Download className="mr-1.5 h-4 w-4" />
                  Download template
                </Button>
              </a>
              {fileName !== "import.csv" && <span className="text-xs text-muted-foreground">{fileName}</span>}
            </div>
            <Textarea
              rows={6}
              value={csv}
              onChange={(e) => { setCsv(e.target.value); setPreview(null); }}
              placeholder="…or paste CSV content here"
              className="font-mono text-xs"
              data-testid="input-import-csv"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!csv.trim() || previewMutation.isPending}
                onClick={() => previewMutation.mutate()}
                data-testid="button-preview-import"
              >
                {previewMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Preview
              </Button>
              <Button
                size="sm"
                disabled={!preview || preview.validCount === 0 || commitMutation.isPending}
                onClick={() => commitMutation.mutate()}
                data-testid="button-commit-import"
              >
                {commitMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Import {preview ? `${preview.ideaCount} idea(s)` : ""}
              </Button>
            </div>
            {preview && (
              <div className="space-y-2 rounded-md border p-3 text-sm" data-testid="panel-import-preview">
                <p>
                  <strong>{preview.validCount}</strong> valid row(s) → {preview.ideaCount} idea(s);{" "}
                  <strong className={preview.invalidCount ? "text-red-600" : ""}>{preview.invalidCount}</strong> invalid row(s) will be skipped.
                </p>
                {preview.rows?.filter((r: any) => r.errors.length).slice(0, 8).map((r: any) => (
                  <p key={r.rowNumber} className="text-xs text-red-600" data-testid={`text-import-error-${r.rowNumber}`}>
                    Row {r.rowNumber}: {r.errors.join("; ")}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {!batches?.length && <p className="text-sm text-muted-foreground">No imports yet.</p>}
            {batches?.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm" data-testid={`row-batch-${b.id}`}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.rowCountValid} valid / {b.rowCountInvalid} invalid ·{" "}
                    {b.createdAt ? new Date(b.createdAt as any).toLocaleString() : ""}
                    {b.rolledBackAt ? " · rolled back" : ""}
                  </p>
                </div>
                {!b.rolledBackAt && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rollbackMutation.isPending}
                    onClick={() => rollbackMutation.mutate(b.id)}
                    data-testid={`button-rollback-${b.id}`}
                  >
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                    Roll back
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Peek panel ──────────────────────────────────────────────────────────────
export function IdeaPeek({
  ideaId,
  onClose,
  onOpenGallery,
  fromCalendar,
  onMutated,
}: {
  ideaId: string | null;
  onClose: () => void;
  onOpenGallery?: () => void;
  fromCalendar?: boolean;
  onMutated?: () => void;
}) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const [, navigate] = useLocation();
  const [comment, setComment] = useState("");

  const { data: idea, isLoading } = useQuery<StudioContentIdea & { comments: StudioIdeaComment[] }>({
    queryKey: ["/api/studio/content-ideas", ideaId],
    enabled: !!ideaId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
    if (ideaId) queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas", ideaId] });
    onMutated?.();
  };

  const transitionMutation = useMutation({
    mutationFn: async (to: string) => {
      const res = await apiRequest("POST", `/api/studio/content-ideas/${ideaId}/transition`, { to });
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Status updated" }); },
    onError: (e: Error) => toast({ title: "Couldn't change status", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/studio/content-ideas/${ideaId}`, patch);
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Idea updated" }); },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/studio/content-ideas/${ideaId}/promote`, {});
      return res.json();
    },
    onSuccess: (data) => {
      invalidate();
      toast({
        title: data.article?.contentType === "article"
          ? "Promoted to article draft"
          : "Draft created — generate the Social Kit from the editor",
      });
      navigate(studioPath(`/articles/${data.article.id}/edit`));
    },
    onError: (e: Error) => toast({ title: "Couldn't promote", description: e.message, variant: "destructive" }),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/studio/content-ideas/${ideaId}/comments`, { message: comment });
      return res.json();
    },
    onSuccess: () => { setComment(""); invalidate(); },
    onError: (e: Error) => toast({ title: "Comment failed", description: e.message, variant: "destructive" }),
  });

  const resolveMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiRequest("PATCH", `/api/studio/idea-comments/${commentId}/resolve`, {});
      return res.json();
    },
    onSuccess: invalidate,
  });

  const canEdit = can("studio.edit_article");
  const canReview = can("studio.review_article");
  const { data: assignees } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/studio/assignees"],
    enabled: !!ideaId,
  });
  const { data: campaigns } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/studio/campaigns", { projectId: idea?.projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/studio/campaigns?projectId=${encodeURIComponent(idea!.projectId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
    enabled: !!idea?.projectId,
  });
  const campaignMutation = useMutation({
    mutationFn: async (campaignId: string | null) => {
      const res = await apiRequest("PATCH", `/api/studio/content-ideas/${ideaId}/campaign`, { campaignId });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/studio/campaigns"] });
      toast({ title: "Campaign updated" });
    },
    onError: (e: Error) => toast({ title: "Couldn't update campaign", description: e.message, variant: "destructive" }),
  });
  // Inline "New Campaign" quick form (bottom-up flow): create a draft
  // campaign with just a name, then attach this idea to it.
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const createCampaignMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/studio/campaigns", {
        projectId: idea!.projectId,
        name,
        status: "draft",
      });
      return res.json();
    },
    onSuccess: (created: { id: string; name: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/campaigns"] });
      setNewCampaignOpen(false);
      setNewCampaignName("");
      campaignMutation.mutate(created.id);
    },
    onError: (e: Error) => toast({ title: "Couldn't create campaign", description: e.message, variant: "destructive" }),
  });
  const assigneeName = (userId?: string | null) =>
    userId ? assignees?.find((a) => a.id === userId)?.name : undefined;
  const nextStates = idea ? (STUDIO_IDEA_TRANSITIONS[idea.status as StudioIdeaStatus] ?? []) : [];
  const visibleNext = nextStates.filter((s) =>
    ["approved", "rejected", "changes_requested"].includes(s) ? canReview : canEdit,
  );
  const typeCfg = idea ? getPipelineContentType(idea.contentType) : undefined;
  const promotable = !!idea && !!typeCfg && idea.status === "approved" && !idea.linkedArticleId;
  const isSocialIdea = typeCfg?.family === "social";

  return (
    <Sheet open={!!ideaId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {isLoading || !idea ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 text-left" data-testid="text-peek-topic">
                {TYPE_ICON[idea.contentType] || ""} {idea.topic}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-3 space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={idea.status} />
                <Badge variant="outline" className="text-[10px]">{typeCfg?.label || idea.contentType}</Badge>
                {idea.origin !== "manual" && idea.origin === "bd_agent" ? (
                  <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400">
                    ⚡ From BD Intel
                  </Badge>
                ) : idea.origin !== "manual" ? (
                  <Badge variant="outline" className="text-[10px]">{idea.origin}</Badge>
                ) : null}
                {(idea.channels as string[] | null)?.map((c) => (
                  <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Scheduled</Label>
                  {canEdit ? (
                    <Input
                      type="date"
                      defaultValue={idea.scheduledDate || ""}
                      onBlur={(e) => {
                        const v = e.target.value || null;
                        if (v !== (idea.scheduledDate || null)) updateMutation.mutate({ scheduledDate: v });
                      }}
                      className="h-8"
                      data-testid="input-peek-date"
                    />
                  ) : (
                    <p>{fmtDate(idea.scheduledDate)}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Pillar</Label>
                  <p data-testid="text-peek-pillar">{idea.pillar ? idea.pillar.replace(/_/g, " ") : "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Assignee</Label>
                  {canEdit ? (
                    <Select
                      value={idea.assignedToUserId || "unassigned"}
                      onValueChange={(v) =>
                        updateMutation.mutate({ assignedToUserId: v === "unassigned" ? null : v })
                      }
                    >
                      <SelectTrigger className="h-8" data-testid="select-peek-assignee"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {(assignees ?? []).map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p data-testid="text-peek-assignee">{assigneeName(idea.assignedToUserId) || "—"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Owner</Label>
                  <p data-testid="text-peek-owner">{assigneeName(idea.createdByUserId) || "—"}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Campaign</Label>
                  {canEdit ? (
                    <div className="space-y-2">
                      <Select
                        value={(idea as any).campaignId || "none"}
                        onValueChange={(v) => {
                          if (v === "__new__") {
                            setNewCampaignOpen(true);
                            return;
                          }
                          campaignMutation.mutate(v === "none" ? null : v);
                        }}
                      >
                        <SelectTrigger className="h-8" data-testid="select-peek-campaign"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No campaign</SelectItem>
                          {(campaigns ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                          <SelectItem value="__new__">+ New campaign...</SelectItem>
                        </SelectContent>
                      </Select>
                      {newCampaignOpen && (
                        <div className="flex items-center gap-2">
                          <Input
                            className="h-8"
                            placeholder="New campaign name"
                            value={newCampaignName}
                            onChange={(e) => setNewCampaignName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newCampaignName.trim() && !createCampaignMutation.isPending) {
                                createCampaignMutation.mutate(newCampaignName.trim());
                              }
                            }}
                            autoFocus
                            data-testid="input-peek-new-campaign"
                          />
                          <Button
                            size="sm"
                            className="h-8"
                            disabled={!newCampaignName.trim() || createCampaignMutation.isPending}
                            onClick={() => createCampaignMutation.mutate(newCampaignName.trim())}
                            data-testid="button-peek-create-campaign"
                          >
                            {createCampaignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => { setNewCampaignOpen(false); setNewCampaignName(""); }}
                            data-testid="button-peek-cancel-campaign"
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p data-testid="text-peek-campaign">
                      {campaigns?.find((c) => c.id === (idea as any).campaignId)?.name || "—"}
                    </p>
                  )}
                </div>
              </div>

              {idea.origin === "bd_agent" && (idea as any).bdIntelMetadata && (
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2 space-y-1">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    ⚡ BD Intel
                  </p>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {(idea as any).bdIntelMetadata?.detectedDomain && (
                      <div>
                        <span className="font-medium">Domain:</span>{" "}
                        <span className="capitalize">{String((idea as any).bdIntelMetadata.detectedDomain).replace(/_/g, " ")}</span>
                      </div>
                    )}
                    {(idea as any).bdIntelMetadata?.buyerStage && (
                      <div>
                        <span className="font-medium">Stage:</span>{" "}
                        <span className="capitalize">{String((idea as any).bdIntelMetadata.buyerStage).replace(/_/g, " ")}</span>
                      </div>
                    )}
                    {(idea as any).bdIntelMetadata?.painPointTheme && (
                      <div>
                        <span className="font-medium">Pain point:</span>{" "}
                        <span className="capitalize">{String((idea as any).bdIntelMetadata.painPointTheme).replace(/_/g, " ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {idea.brief && (
                <div>
                  <Label className="text-xs text-muted-foreground">Brief</Label>
                  <p className="whitespace-pre-wrap" data-testid="text-peek-brief">{idea.brief}</p>
                </div>
              )}
              {idea.captionCopy && (
                <div>
                  <Label className="text-xs text-muted-foreground">Caption</Label>
                  <p className="whitespace-pre-wrap">{idea.captionCopy}</p>
                </div>
              )}
              {idea.referenceLink && (
                <a href={idea.referenceLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Reference
                </a>
              )}
              {idea.linkedArticleId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(studioPath(`/articles/${idea.linkedArticleId}/edit`))}
                  data-testid="button-open-linked-article"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open linked article
                </Button>
              )}

              {isSocialIdea && onOpenGallery && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenGallery}
                  data-testid="button-peek-creative-cards"
                >
                  <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                  Creative Cards
                </Button>
              )}

              {(visibleNext.length > 0 || promotable) && (
                <div>
                  <Label className="text-xs text-muted-foreground">Actions</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {visibleNext.map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={s === "rejected" ? "destructive" : "outline"}
                        disabled={transitionMutation.isPending}
                        onClick={() => transitionMutation.mutate(s)}
                        data-testid={`button-transition-${s}`}
                      >
                        {STATUS_LABEL[s]}
                      </Button>
                    ))}
                    {promotable && canEdit && (
                      <Button
                        size="sm"
                        disabled={promoteMutation.isPending}
                        onClick={() => promoteMutation.mutate()}
                        data-testid="button-promote-idea"
                      >
                        {promoteMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        {isSocialIdea ? "Generate Social Kit" : "Promote to article"}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" /> Comments ({idea.comments?.length ?? 0})
                </Label>
                <div className="mt-1 space-y-2">
                  {idea.comments?.map((c) => (
                    <div key={c.id} className={`rounded-md border p-2 text-xs ${c.resolvedAt ? "opacity-50" : ""}`} data-testid={`comment-${c.id}`}>
                      <p className="whitespace-pre-wrap">{c.message}</p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{c.createdAt ? new Date(c.createdAt as any).toLocaleString() : ""}</span>
                        {!c.resolvedAt && (
                          <button className="text-primary hover:underline" onClick={() => resolveMutation.mutate(c.id)} data-testid={`button-resolve-${c.id}`}>
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment…"
                      className="h-8 text-xs"
                      data-testid="input-peek-comment"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!comment.trim() || commentMutation.isPending}
                      onClick={() => commentMutation.mutate()}
                      data-testid="button-add-comment"
                    >
                      Post
                    </Button>
                  </div>
                </div>
              </div>

              {fromCalendar && ideaId && (
                <div className="border-t pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => navigate(studioPath(`?idea=${ideaId}`))}
                    data-testid="button-view-in-pipeline"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    View in Pipeline
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function PipelineView({ lens }: { lens: Lens }) {
  const [, navigate] = useLocation();
  const { can } = usePermissions();
  const { toast } = useToast();
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } = useStudioProject();
  const canCreate = can("studio.create_article");
  const canEdit = can("studio.edit_article");
  const canReview = can("studio.review_article");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [peekId, setPeekId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  const [showBacklog, setShowBacklog] = useState(true);
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);

  // Deep links: ?idea=<id> opens the peek; ?create=1 opens quick-create;
  // ?campaignId=<id> filters the pipeline to one campaign's content (T2).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idea = params.get("idea");
    if (idea) setPeekId(idea);
    if (params.get("create")) setCreateOpen(true);
    const campaign = params.get("campaignId");
    if (campaign) setCampaignFilter(campaign);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters = useMemo(() => {
    const f: Record<string, string> = { projectId: selectedProjectId };
    if (statusFilter !== "all") f.status = statusFilter;
    if (typeFilter !== "all") f.contentType = typeFilter;
    if (channelFilter !== "all") f.channel = channelFilter;
    if (originFilter !== "all") f.origin = originFilter;
    if (pillarFilter !== "all") f.pillar = pillarFilter;
    if (assigneeFilter !== "all") f.assignedTo = assigneeFilter;
    if (campaignFilter) f.campaignId = campaignFilter;
    if (search.trim()) f.search = search.trim();
    return f;
  }, [selectedProjectId, statusFilter, typeFilter, channelFilter, originFilter, pillarFilter, assigneeFilter, campaignFilter, search]);

  const { data: assignees } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/studio/assignees"],
  });

  const { data: ideas, isLoading } = useQuery<StudioContentIdea[]>({
    queryKey: ["/api/studio/content-ideas", filters],
    enabled: !!selectedProjectId,
  });

  // Inline edits from the Table lens (caption, links, date, status).
  const inlinePatchMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/studio/content-ideas/${id}`, fields);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] }),
    onError: (e: Error) => toast({ title: "Couldn't save change", description: e.message, variant: "destructive" }),
  });

  const inlineTransitionMutation = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: string }) => {
      const res = await apiRequest("POST", `/api/studio/content-ideas/${id}/transition`, { to });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] }),
    onError: (e: Error) => toast({ title: "Couldn't change status", description: e.message, variant: "destructive" }),
  });

  const scheduled = useMemo(() => (ideas ?? []).filter((i) => i.scheduledDate), [ideas]);
  const backlog = useMemo(() => (ideas ?? []).filter((i) => !i.scheduledDate), [ideas]);

  const byDate = useMemo(() => {
    const m = new Map<string, StudioContentIdea[]>();
    for (const i of scheduled) {
      const k = i.scheduledDate!;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(i);
    }
    return m;
  }, [scheduled]);

  const monthDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first grid
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const exportCsv = () => {
    const rows = ideas ?? [];
    const header = ["Date", "Type", "Status", "Topic", "Channels", "Pillar", "Origin", "Brief"];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [
      header.join(","),
      ...rows.map((i) =>
        [
          i.scheduledDate || "",
          i.contentType,
          i.status,
          i.topic,
          ((i.channels as string[] | null) || []).join("; "),
          i.pillar || "",
          i.origin,
          i.brief || "",
        ].map((c) => esc(String(c))).join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "content-plan.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const IdeaChip = ({ idea }: { idea: StudioContentIdea }) => (
    <button
      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight ${STATUS_CLASS[idea.status] || "bg-muted"}`}
      onClick={() => setPeekId(idea.id)}
      title={idea.topic}
      data-testid={`chip-idea-${idea.id}`}
    >
      {TYPE_ICON[idea.contentType] || ""} {idea.topic}
    </button>
  );

  const LensButton = ({ value, icon: Icon, label }: { value: Lens; icon: any; label: string }) => (
    <Button
      size="sm"
      variant={lens === value ? "default" : "outline"}
      onClick={() => navigate(studioPath(`/${value}`))}
      data-testid={`button-lens-${value}`}
    >
      <Icon className="mr-1.5 h-4 w-4" />
      {label}
    </Button>
  );

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-pipeline-title">Content Plan</h1>
            <p className="text-sm text-muted-foreground">One pipeline for articles, posts, and stories.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ProjectSwitcher
              projects={projects}
              projectsLoading={projectsLoading}
              selectedProjectId={selectedProjectId}
              onChange={setSelectedProjectId}
            />
            {canCreate && (
              <>
                <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} data-testid="button-open-import">
                  <Upload className="mr-1.5 h-4 w-4" /> Import
                </Button>
                <Button size="sm" onClick={() => { setCreateDate(undefined); setCreateOpen(true); }} data-testid="button-open-create">
                  <Plus className="mr-1.5 h-4 w-4" /> New idea
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LensButton value="calendar" icon={CalendarDays} label="Calendar" />
          <LensButton value="board" icon={Columns3} label="Board" />
          <LensButton value="table" icon={Table2} label="Table" />
          <div className="mx-1 h-6 w-px bg-border" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topics…"
            className="h-8 w-44"
            data-testid="input-pipeline-search"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36" data-testid="filter-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STUDIO_IDEA_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-32" data-testid="filter-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {STUDIO_PIPELINE_CONTENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="h-8 w-32" data-testid="filter-channel"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              {STUDIO_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="h-8 w-32" data-testid="filter-origin"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All origins</SelectItem>
              {STUDIO_IDEA_ORIGINS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pillarFilter} onValueChange={setPillarFilter}>
            <SelectTrigger className="h-8 w-36" data-testid="filter-pillar"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All pillars</SelectItem>
              {STUDIO_PILLARS.map((p) => (
                <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-8 w-36" data-testid="filter-assignee"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {(assignees ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lens === "table" && (
            <Button size="sm" variant="ghost" onClick={exportCsv} data-testid="button-export-csv">
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {lens === "calendar" && (
              <div className="space-y-3">
                {(() => {
                  const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
                  const monthIdeas = scheduled.filter((i) => (i.scheduledDate ?? "").startsWith(monthPrefix));
                  return (
                    <>
                      {monthIdeas.length === 0 && (
                        <StudioTip
                          id="calendar-empty-month"
                          title="Your calendar is empty"
                          body="Click any date to plan a content idea — or create a Campaign and let AI draft the whole month's schedule for you."
                          action={{ label: "Create a Campaign", href: studioPath("/campaigns") }}
                        />
                      )}
                      {(ideas?.length ?? 0) === 1 && (
                        <StudioTip
                          id="calendar-first-idea"
                          title="Great start"
                          body="Ideas stay as ideas until someone Approves them. Assign yourself or a reviewer and move it to review."
                        />
                      )}
                      {(ideas?.length ?? 0) === 0 && (
                        <p className="text-center text-sm text-muted-foreground">
                          New to the Studio?{" "}
                          <Link href={studioPath("/guide")}>
                            <span className="cursor-pointer font-medium text-primary hover:underline" data-testid="link-calendar-playbook">
                              Read the Studio Playbook →
                            </span>
                          </Link>
                        </p>
                      )}
                    </>
                  );
                })()}
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} data-testid="button-prev-month">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-36 text-center text-sm font-semibold" data-testid="text-month-label">
                    {month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </span>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} data-testid="button-next-month">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-xs">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d} className="bg-muted px-2 py-1 font-medium text-muted-foreground">{d}</div>
                  ))}
                  {monthDays.map((d, i) => {
                    const iso = d ? toISODate(d) : "";
                    const dayIdeas = d ? byDate.get(iso) ?? [] : [];
                    return (
                      <div key={i} className={`min-h-24 bg-background p-1 ${d ? "" : "opacity-40"}`} data-testid={d ? `cell-day-${iso}` : undefined}>
                        {d && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{d.getDate()}</span>
                            {canCreate && (
                              <button
                                className="rounded p-0.5 text-muted-foreground opacity-40 hover:bg-muted hover:opacity-100"
                                onClick={() => { setCreateDate(iso); setCreateOpen(true); }}
                                data-testid={`button-add-on-${iso}`}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                        <div className="mt-0.5 space-y-0.5">
                          {dayIdeas.map((idea) => <IdeaChip key={idea.id} idea={idea} />)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Card>
                  <CardContent className="p-3">
                    <button className="flex w-full items-center justify-between text-sm font-semibold" onClick={() => setShowBacklog((v) => !v)} data-testid="button-toggle-backlog">
                      <span className="flex items-center gap-2"><Inbox className="h-4 w-4" /> Backlog — unscheduled ({backlog.length})</span>
                      <span className="text-xs text-muted-foreground">{showBacklog ? "Hide" : "Show"}</span>
                    </button>
                    {showBacklog && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {backlog.length === 0 && <p className="text-xs text-muted-foreground">Nothing in the backlog.</p>}
                        {backlog.map((idea) => (
                          <button
                            key={idea.id}
                            className={`rounded px-2 py-1 text-[11px] ${STATUS_CLASS[idea.status] || "bg-muted"}`}
                            onClick={() => setPeekId(idea.id)}
                            data-testid={`backlog-idea-${idea.id}`}
                          >
                            {TYPE_ICON[idea.contentType] || ""} {idea.topic}
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {lens === "board" && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {BOARD_COLUMNS.map((col) => {
                  const colIdeas = (ideas ?? []).filter((i) => i.status === col);
                  return (
                    <div key={col} className="w-56 shrink-0 rounded-md border bg-muted/30" data-testid={`board-column-${col}`}>
                      <div className="flex items-center justify-between border-b px-2 py-1.5">
                        <span className="text-xs font-semibold">{STATUS_LABEL[col]}</span>
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{colIdeas.length}</Badge>
                      </div>
                      <div className="space-y-1.5 p-1.5">
                        {colIdeas.map((idea) => (
                          <button
                            key={idea.id}
                            className="w-full rounded-md border bg-background p-2 text-left text-xs shadow-sm hover:border-primary/40"
                            onClick={() => setPeekId(idea.id)}
                            data-testid={`board-card-${idea.id}`}
                          >
                            <p className="font-medium leading-snug">{TYPE_ICON[idea.contentType] || ""} {idea.topic}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {idea.scheduledDate ? fmtDate(idea.scheduledDate) : "Backlog"}
                              {idea.pillar ? ` · ${idea.pillar.replace(/_/g, " ")}` : ""}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {lens === "table" && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Caption</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Creative</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Pillar</TableHead>
                      <TableHead>Origin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ideas ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">No ideas match your filters.</TableCell></TableRow>
                    )}
                    {(ideas ?? []).map((idea) => {
                      const nextStates = (STUDIO_IDEA_TRANSITIONS[idea.status as StudioIdeaStatus] ?? []).filter((s) =>
                        ["approved", "rejected", "changes_requested"].includes(s) ? canReview : canEdit,
                      );
                      return (
                        <TableRow key={idea.id} className="cursor-pointer" onClick={() => setPeekId(idea.id)} data-testid={`row-idea-${idea.id}`}>
                          <TableCell className="whitespace-nowrap text-xs" onClick={(e) => canEdit && e.stopPropagation()}>
                            {canEdit ? (
                              <Input
                                type="date"
                                defaultValue={idea.scheduledDate || ""}
                                onBlur={(e) => {
                                  const v = e.target.value || null;
                                  if (v !== (idea.scheduledDate || null)) {
                                    inlinePatchMutation.mutate({ id: idea.id, fields: { scheduledDate: v } });
                                  }
                                }}
                                className="h-7 w-32 text-xs"
                                data-testid={`input-table-date-${idea.id}`}
                              />
                            ) : (
                              idea.scheduledDate ? fmtDate(idea.scheduledDate) : "Backlog"
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{getPipelineContentType(idea.contentType)?.label || idea.contentType}</TableCell>
                          <TableCell className="max-w-64 truncate text-sm font-medium">{idea.topic}</TableCell>
                          <TableCell onClick={(e) => nextStates.length > 0 && e.stopPropagation()}>
                            {nextStates.length > 0 ? (
                              <Select
                                value={idea.status}
                                onValueChange={(to) => {
                                  if (to !== idea.status) inlineTransitionMutation.mutate({ id: idea.id, to });
                                }}
                              >
                                <SelectTrigger className="h-7 w-40 text-xs" data-testid={`select-table-status-${idea.id}`}>
                                  <SelectValue>
                                    <StatusBadge status={idea.status} />
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={idea.status}>{STATUS_LABEL[idea.status] || idea.status}</SelectItem>
                                  {nextStates.map((s) => (
                                    <SelectItem key={s} value={s}>→ {STATUS_LABEL[s] || s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <StatusBadge status={idea.status} />
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {canEdit ? (
                              <EditableTextCell
                                value={idea.captionCopy}
                                placeholder="Caption"
                                onSave={(v) => inlinePatchMutation.mutate({ id: idea.id, fields: { captionCopy: v } })}
                                testId={`table-caption-${idea.id}`}
                              />
                            ) : (
                              <span className="block max-w-48 truncate">{idea.captionCopy || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {canEdit ? (
                              <EditableTextCell
                                value={idea.referenceLink}
                                placeholder="Reference link"
                                onSave={(v) => inlinePatchMutation.mutate({ id: idea.id, fields: { referenceLink: v } })}
                                isLink
                                testId={`table-reference-${idea.id}`}
                              />
                            ) : idea.referenceLink ? (
                              <a href={idea.referenceLink} target="_blank" rel="noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>Link</a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {canEdit ? (
                              <EditableTextCell
                                value={idea.creativeLink}
                                placeholder="Creative link"
                                onSave={(v) => inlinePatchMutation.mutate({ id: idea.id, fields: { creativeLink: v } })}
                                isLink
                                testId={`table-creative-${idea.id}`}
                              />
                            ) : idea.creativeLink ? (
                              <a href={idea.creativeLink} target="_blank" rel="noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>Link</a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{((idea.channels as string[] | null) || []).join(", ") || "—"}</TableCell>
                          <TableCell className="text-xs">{idea.pillar ? idea.pillar.replace(/_/g, " ") : "—"}</TableCell>
                          <TableCell className="text-xs">{idea.origin}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>

      <IdeaPeek ideaId={peekId} onClose={() => setPeekId(null)} />
      <QuickCreateDialog open={createOpen} onOpenChange={setCreateOpen} projectId={selectedProjectId} defaultDate={createDate} />
      <ImportWizardDialog open={importOpen} onOpenChange={setImportOpen} projectId={selectedProjectId} />
    </AdminLayout>
  );
}
