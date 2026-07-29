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
import { isInsightsContentType } from "@shared/studioAi";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  Activity,
  AlertTriangle,
  BarChart2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  ExternalLink,
  FileText,
  Film,
  Filter,
  ImageIcon,
  Inbox,
  LayoutGrid,
  Loader2,
  MessageSquare,
  MonitorPlay,
  Plus,
  Pencil,
  RotateCcw,
  Table2,
  TrendingDown,
  TrendingUp,
  Undo2,
  Upload,
  Video,
  XCircle,
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

const FORMAT_ICON: Record<string, JSX.Element> = {
  Carousel: <LayoutGrid className="h-3 w-3" />,
  Reel: <Film className="h-3 w-3" />,
  Static: <ImageIcon className="h-3 w-3" />,
  Video: <Video className="h-3 w-3" />,
  Infographic: <FileText className="h-3 w-3" />,
  Slides: <MonitorPlay className="h-3 w-3" />,
};

const KNOWN_FORMATS = [
  "Carousel", "Reel", "Static", "Video", "Infographic", "Slides",
  "Story", "UGC", "Meme", "Poll", "Text",
];

function FormatSelectorField({
  value,
  onValueChange,
  triggerClassName,
  testId,
}: {
  value: string | null | undefined;
  onValueChange: (v: string | null) => void;
  triggerClassName?: string;
  testId?: string;
}) {
  const isKnown = !!(value && KNOWN_FORMATS.includes(value));
  const [customMode, setCustomMode] = useState(!!(value && !isKnown));
  return (
    <div className="space-y-1.5">
      <Select
        value={customMode ? "__custom__" : (value || "none")}
        onValueChange={(v) => {
          if (v === "none") { setCustomMode(false); onValueChange(null); }
          else if (v === "__custom__") { setCustomMode(true); }
          else { setCustomMode(false); onValueChange(v); }
        }}
      >
        <SelectTrigger className={triggerClassName} data-testid={testId}>
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {KNOWN_FORMATS.map((f) => (
            <SelectItem key={f} value={f}>{f}</SelectItem>
          ))}
          <SelectItem value="__custom__">Custom…</SelectItem>
        </SelectContent>
      </Select>
      {customMode && (
        <Input
          placeholder="e.g. Interview Q&A"
          value={value || ""}
          onChange={(e) => onValueChange(e.target.value || null)}
          className="h-8 text-sm"
          data-testid={testId ? `${testId}-input` : undefined}
        />
      )}
    </div>
  );
}

function FormatBadge({ format }: { format: string | null | undefined }) {
  if (!format) return null;
  const icon = FORMAT_ICON[format];
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-300"
      data-testid={`badge-format-${format}`}
    >
      {icon}
      {format}
    </span>
  );
}

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
  const [postFormat, setPostFormat] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [pillar, setPillar] = useState("");
  const [brief, setBrief] = useState("");
  const [scheduledDate, setScheduledDate] = useState(defaultDate || "");

  useEffect(() => {
    if (open) {
      setScheduledDate(defaultDate || "");
      setTopic("");
      setBrief("");
      setPostFormat("");
    }
  }, [open, defaultDate]);

  const isInsights = isInsightsContentType(contentType);
  const typeCfg = getPipelineContentType(contentType);
  const allowedChannels: readonly string[] = isInsights ? ["website"] : (typeCfg?.channels ?? []);

  useEffect(() => {
    if (isInsights) {
      setChannels(["website"]);
    } else {
      setChannels((prev) => prev.filter((c) => (allowedChannels as readonly string[]).includes(c)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/studio/content-ideas", {
        projectId,
        topic,
        contentType,
        postFormat: postFormat || undefined,
        channels,
        pillar: pillar || undefined,
        brief: brief || undefined,
        scheduledDate: scheduledDate || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
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
                  <SelectGroup>
                    <SelectLabel>Standard</SelectLabel>
                    {STUDIO_PIPELINE_CONTENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Insights Editorial (AI-planned)</SelectLabel>
                    <SelectItem value="FLAGSHIP_INSIGHT">Flagship Insight</SelectItem>
                    <SelectItem value="FIELD_SIGNAL">Field Signal</SelectItem>
                    <SelectItem value="DECISION_GUIDE">Decision Guide</SelectItem>
                    <SelectItem value="RESEARCH_BRIEF">Research Brief</SelectItem>
                    <SelectItem value="TOOL_TECH_WATCH">Tool &amp; Tech Watch</SelectItem>
                    <SelectItem value="SCENARIO_ANALYSIS">Scenario Analysis</SelectItem>
                    <SelectItem value="EDITORIAL_PERSPECTIVE">Editorial Perspective</SelectItem>
                    <SelectItem value="MONTHLY_INTELLIGENCE_BRIEF">Monthly Intelligence Brief</SelectItem>
                  </SelectGroup>
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
              {!scheduledDate && (
                <p className="mt-1 text-[11px] text-muted-foreground" data-testid="hint-no-date">
                  No date set — this idea won't appear on the calendar until you add a scheduled date.
                </p>
              )}
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
            <Label>Post Format</Label>
            <FormatSelectorField
              key={open ? "open" : "closed"}
              value={postFormat || null}
              onValueChange={(v) => setPostFormat(v || "")}
              testId="select-idea-format"
            />
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
type QualityScore = "high" | "medium" | "needs_work";
type WizardStep = "upload" | "mapping" | "review";
type SystemFieldDef = { key: string; label: string; required: boolean; description: string };

const QUALITY_BADGE: Record<QualityScore, { label: string; className: string; icon: JSX.Element }> = {
  high: {
    label: "High",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  medium: {
    label: "Medium",
    className: "bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  needs_work: {
    label: "Needs Work",
    className: "bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "mapping", label: "Map Fields" },
  { key: "review", label: "Review & Import" },
];

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

  // Tab: import wizard vs past imports
  const [tab, setTab] = useState<"import" | "batches">("import");

  // Wizard step
  const [step, setStep] = useState<WizardStep>("upload");

  // File state
  const [csv, setCsv] = useState("");
  const [excelB64, setExcelB64] = useState<string | null>(null);
  const [fileName, setFileName] = useState("import.csv");
  const [showPasteArea, setShowPasteArea] = useState(false);

  // From parse-headers response
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [systemFields, setSystemFields] = useState<SystemFieldDef[]>([]);
  const [suggestedMapping, setSuggestedMapping] = useState<Record<string, string>>({});
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [fileInfo, setFileInfo] = useState<{ sourceFormat: string; sheetUsed: string | null; dataRowCount: number } | null>(null);

  // Review state
  const [preview, setPreview] = useState<any | null>(null);
  const [skipQualityAudit, setSkipQualityAudit] = useState(false);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const fileRef = useRef<HTMLInputElement>(null);

  // Reset the wizard when the dialog closes
  useEffect(() => {
    if (!open) {
      setStep("upload");
      setCsv("");
      setExcelB64(null);
      setFileName("import.csv");
      setShowPasteArea(false);
      setDetectedColumns([]);
      setSampleValues({});
      setSystemFields([]);
      setSuggestedMapping({});
      setFieldMapping({});
      setFileInfo(null);
      setPreview(null);
      setSkipQualityAudit(false);
      setShowFlaggedOnly(false);
      setExpandedRows(new Set());
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  // ── Past imports ──
  const { data: batches } = useQuery<StudioImportBatch[]>({
    queryKey: ["/api/studio/import/batches", { projectId }],
    enabled: open && tab === "batches" && !!projectId,
  });

  // ── Duplicate cleaner ──
  type DuplicateGroup = { topic: string; scheduledDate: string | null; ids: string[]; createdAts: string[]; keeperId: string };
  const [showDupeDialog, setShowDupeDialog] = useState(false);
  const [selectedDupeGroups, setSelectedDupeGroups] = useState<Set<string>>(new Set());

  const { data: dupesData, isLoading: dupesLoading, refetch: refetchDupes } = useQuery<{ groups: DuplicateGroup[] }>({
    queryKey: ["/api/studio/content-ideas/duplicates", { projectId }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/studio/content-ideas/duplicates?projectId=${encodeURIComponent(projectId)}`);
      return res.json();
    },
    enabled: showDupeDialog && !!projectId,
  });
  const dupeGroups = dupesData?.groups ?? [];

  const removeDupesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/studio/content-ideas/duplicates/remove", { projectId, ids });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      toast({ title: `Removed ${data.archived} duplicate entr${data.archived === 1 ? "y" : "ies"}` });
      setShowDupeDialog(false);
      setSelectedDupeGroups(new Set());
    },
    onError: (e: Error) => toast({ title: "Couldn't remove duplicates", description: e.message, variant: "destructive" }),
  });

  const handleConfirmRemoveDupes = () => {
    const idsToRemove: string[] = [];
    for (const grp of dupeGroups) {
      const key = `${grp.topic}|||${grp.scheduledDate ?? ""}`;
      if (selectedDupeGroups.has(key)) {
        for (const id of grp.ids) {
          if (id !== grp.keeperId) idsToRemove.push(id);
        }
      }
    }
    if (idsToRemove.length > 0) removeDupesMutation.mutate(idsToRemove);
  };

  // ── Payload builders ──
  const buildParsePayload = () =>
    excelB64 !== null ? { fileData: excelB64, fileName } : { csv };

  const buildPreviewPayload = () =>
    excelB64 !== null
      ? { fileData: excelB64, fileName, skipQualityAudit, fieldMapping }
      : { csv, skipQualityAudit, fieldMapping };

  const buildCommitPayload = () =>
    excelB64 !== null
      ? { fileData: excelB64, fileName, skipQualityAudit, fieldMapping, projectId }
      : { csv, skipQualityAudit, fieldMapping, projectId, fileName };

  // ── Mutations ──
  const parseHeadersMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/studio/import/content-calendar/parse-headers", payload);
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as any).error || "Failed to read file");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      setDetectedColumns(data.detectedColumns ?? []);
      setSampleValues(data.sampleValues ?? {});
      setSystemFields(data.systemFields ?? []);
      setSuggestedMapping(data.suggestedMapping ?? {});
      setFieldMapping({ ...(data.suggestedMapping ?? {}) });
      setFileInfo({ sourceFormat: data.sourceFormat, sheetUsed: data.sheetUsed, dataRowCount: data.dataRowCount });
      setStep("mapping");
    },
    onError: (e: Error) => toast({ title: "Couldn't read file", description: e.message, variant: "destructive" }),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/studio/import/content-calendar/preview", buildPreviewPayload());
      return res.json();
    },
    onSuccess: (data) => { setPreview(data); setShowFlaggedOnly(false); setExpandedRows(new Set()); },
    onError: (e: Error) => toast({ title: "Preview failed", description: e.message, variant: "destructive" }),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/studio/import/content-calendar/commit", buildCommitPayload());
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio/import/batches"] });
      const skipped = data.skippedDuplicates ?? 0;
      const skippedNote = skipped > 0 ? ` ${skipped} row${skipped === 1 ? "" : "s"} skipped — already exist.` : "";
      toast({
        title: "Import complete",
        description: `${data.createdIdeas} idea(s) created from ${data.validRows} row(s).${skippedNote}`,
      });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const rollbackMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const res = await apiRequest("POST", `/api/studio/import/${batchId}/rollback`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/content-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio/import/batches"] });
      toast({ title: "Batch rolled back", description: `${data.archivedIdeas} idea(s) archived.` });
    },
    onError: (e: Error) => toast({ title: "Rollback failed", description: e.message, variant: "destructive" }),
  });

  // ── File reading + immediate parse-headers call ──
  const handleFile = (f: File) => {
    setFileName(f.name);
    setPreview(null);
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const buf = ev.target?.result as ArrayBuffer | null;
        if (!buf) return;
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        setExcelB64(b64);
        setCsv("");
        parseHeadersMutation.mutate({ fileData: b64, fileName: f.name });
      };
      reader.readAsArrayBuffer(f);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || "");
        setCsv(text);
        setExcelB64(null);
        parseHeadersMutation.mutate({ csv: text });
      };
      reader.readAsText(f);
    }
  };

  // ── Wizard helpers ──
  const requiredFields = systemFields.filter((f) => f.required);
  const mappedSystemKeys = Object.values(fieldMapping).filter(Boolean);
  const unmappedRequired = requiredFields.filter((f) => !mappedSystemKeys.includes(f.key));
  const canContinueFromMapping = unmappedRequired.length === 0;

  const goToReview = () => {
    setPreview(null);
    setStep("review");
    // Auto-trigger preview immediately
    setTimeout(() => previewMutation.mutate(), 0);
  };

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === step);

  // ── Quality audit panel (shared between old API and step 3) ──
  const renderQualityPanel = () => {
    if (!preview) return null;
    return (
      <div className="space-y-3 rounded-md border p-3 text-sm" data-testid="panel-import-preview">
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {preview.validCount - (preview.flaggedCount ?? 0)} ready
          </span>
          {(preview.flaggedCount ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {preview.flaggedCount} need attention
            </span>
          )}
          {preview.invalidCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {preview.invalidCount} have errors
            </span>
          )}
          {preview.sourceFormat === "excel" && preview.sheetUsed && (
            <span className="ml-auto text-muted-foreground text-xs">({preview.sheetUsed})</span>
          )}
          {(preview.flaggedCount ?? 0) > 0 && !preview.skipQualityAudit && (
            <button
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setShowFlaggedOnly((v) => !v)}
              data-testid="button-show-flagged-only"
            >
              <Filter className="h-3 w-3" />
              {showFlaggedOnly ? "Show all" : "Show flagged only"}
            </button>
          )}
        </div>
        {preview.balanceWarning && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400" data-testid="panel-balance-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {preview.balanceWarning}
          </div>
        )}
        {!preview.skipQualityAudit && (() => {
          const validRows = (preview.rows ?? []).filter((r: any) => !r.errors.length);
          const displayRows = showFlaggedOnly
            ? validRows.filter((r: any) => r.qualityScore === "needs_work" || r.qualityScore === "medium")
            : validRows;
          if (!displayRows.length) return null;
          return (
            <div className="space-y-1.5">
              {displayRows.map((r: any) => {
                const qs: QualityScore = r.qualityScore ?? "high";
                const cfg = QUALITY_BADGE[qs];
                const isExpanded = expandedRows.has(r.rowNumber);
                const hasFlags = r.qualityFlags?.length > 0;
                return (
                  <div key={r.rowNumber} className="rounded-md border bg-muted/20 px-2 py-1.5" data-testid={`row-quality-${r.rowNumber}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-10 shrink-0">Row {r.rowNumber}</span>
                      <span className="flex-1 text-xs font-medium truncate">{r.ideas?.[0]?.topic || "—"}</span>
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.className}`} data-testid={`badge-quality-${r.rowNumber}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {hasFlags && (
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setExpandedRows((prev) => {
                            const next = new Set(prev);
                            isExpanded ? next.delete(r.rowNumber) : next.add(r.rowNumber);
                            return next;
                          })}
                          data-testid={`button-expand-row-${r.rowNumber}`}
                        >
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                    {isExpanded && hasFlags && (
                      <ul className="mt-1.5 ml-12 space-y-0.5 list-disc list-inside" data-testid={`list-flags-${r.rowNumber}`}>
                        {r.qualityFlags.map((f: string, i: number) => (
                          <li key={i} className="text-[10px] text-muted-foreground">{f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
        {preview.rows?.filter((r: any) => r.errors.length).slice(0, 8).map((r: any) => (
          <p key={r.rowNumber} className="text-xs text-red-600" data-testid={`text-import-error-${r.rowNumber}`}>
            Row {r.rowNumber}: {r.errors.join("; ")}
          </p>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import content plan</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-2 border-b pb-2">
          <Button size="sm" variant={tab === "import" ? "default" : "ghost"} onClick={() => setTab("import")} data-testid="tab-import">
            Import
          </Button>
          <Button size="sm" variant={tab === "batches" ? "default" : "ghost"} onClick={() => setTab("batches")} data-testid="tab-batches">
            Past imports
          </Button>
        </div>

        {tab === "import" ? (
          <div className="space-y-4">
            {/* Step indicator */}
            <div className="flex items-center" data-testid="wizard-step-indicator">
              {WIZARD_STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center">
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${i === stepIndex ? "text-primary" : i < stepIndex ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${i === stepIndex ? "bg-primary text-primary-foreground" : i < stepIndex ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {i < stepIndex ? "✓" : i + 1}
                    </span>
                    {s.label}
                  </div>
                  {i < WIZARD_STEPS.length - 1 && (
                    <div className={`mx-2 h-px w-8 shrink-0 ${i < stepIndex ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>

            {/* ── Step 1: Upload ── */}
            {step === "upload" && (
              <div className="space-y-3">
                {/* File already loaded — show resume card when navigating back from step 2 */}
                {fileInfo ? (
                  <div className="space-y-3" data-testid="panel-upload-resume">
                    <div className="flex items-center gap-3 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3" data-testid="panel-file-loaded-resume">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {fileInfo.sourceFormat === "excel" ? "Excel" : "CSV"}
                          {fileInfo.sheetUsed ? ` · ${fileInfo.sheetUsed}` : ""}
                          {" "}· {fileInfo.dataRowCount} row{fileInfo.dataRowCount !== 1 ? "s" : ""} · {detectedColumns.length} column{detectedColumns.length !== 1 ? "s" : ""} detected
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => setStep("mapping")}
                        data-testid="button-continue-to-mapping"
                      >
                        Continue to mapping
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setFileInfo(null);
                          setDetectedColumns([]);
                          setSampleValues({});
                          setSystemFields([]);
                          setSuggestedMapping({});
                          setFieldMapping({});
                          setCsv("");
                          setExcelB64(null);
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                        data-testid="button-change-file"
                      >
                        Change file
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Fresh upload — no file loaded yet */
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileRef.current?.click()}
                        disabled={parseHeadersMutation.isPending}
                        data-testid="button-pick-file"
                      >
                        {parseHeadersMutation.isPending
                          ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          : <Upload className="mr-1.5 h-4 w-4" />
                        }
                        {parseHeadersMutation.isPending ? "Reading file…" : "Choose file"}
                      </Button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                        data-testid="input-file-upload"
                      />
                      <a href="/api/studio/import/template" download data-testid="link-template-csv">
                        <Button size="sm" variant="ghost">
                          <Download className="mr-1.5 h-4 w-4" />
                          CSV template
                        </Button>
                      </a>
                      <a href="/api/studio/import/template?format=xlsx" download data-testid="link-template-xlsx">
                        <Button size="sm" variant="ghost">
                          <Download className="mr-1.5 h-4 w-4" />
                          Excel template
                        </Button>
                      </a>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Accepts .csv or .xlsx. After selecting a file, you'll map columns to fields before importing.
                    </p>

                    {/* Paste CSV toggle — collapsed by default */}
                    <button
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => setShowPasteArea((v) => !v)}
                      data-testid="button-toggle-paste"
                    >
                      {showPasteArea ? "Hide paste area" : "…or paste CSV instead"}
                    </button>
                    {showPasteArea && (
                      <div className="space-y-2">
                        <Textarea
                          rows={5}
                          value={csv}
                          onChange={(e) => setCsv(e.target.value)}
                          placeholder="Paste CSV content here…"
                          className="font-mono text-xs"
                          data-testid="input-import-csv"
                        />
                        <Button
                          size="sm"
                          disabled={!csv.trim() || parseHeadersMutation.isPending}
                          onClick={() => {
                            setExcelB64(null);
                            parseHeadersMutation.mutate({ csv });
                          }}
                          data-testid="button-parse-pasted-csv"
                        >
                          {parseHeadersMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                          Continue
                          <ChevronRight className="ml-1.5 h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Step 2: Field Mapping ── */}
            {step === "mapping" && (
              <div className="space-y-3">
                {/* File info pill */}
                {fileInfo && (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid="panel-file-loaded">
                    <span className="flex-1 truncate text-muted-foreground text-xs">
                      {fileName}
                      {fileInfo.sourceFormat === "excel" ? ` · Excel${fileInfo.sheetUsed ? ` · ${fileInfo.sheetUsed}` : ""}` : " · CSV"}
                      {" "}· {fileInfo.dataRowCount} row{fileInfo.dataRowCount !== 1 ? "s" : ""}
                    </span>
                    <button
                      className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => { setStep("upload"); setPreview(null); }}
                      data-testid="button-change-file"
                    >
                      Change file
                    </button>
                  </div>
                )}

                {/* Required-field status chips */}
                <div className="flex flex-wrap items-center gap-2" data-testid="panel-required-fields-status">
                  {requiredFields.map((f) => {
                    const isMapped = mappedSystemKeys.includes(f.key);
                    return (
                      <span
                        key={f.key}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${isMapped ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"}`}
                        data-testid={`chip-required-${f.key}`}
                      >
                        {isMapped
                          ? <CheckCircle2 className="h-3 w-3" />
                          : <AlertTriangle className="h-3 w-3" />
                        }
                        {f.label}
                      </span>
                    );
                  })}
                  <span className="text-[11px] text-muted-foreground">— required fields</span>
                </div>

                {/* Mapping table */}
                <div className="rounded-md border overflow-hidden" data-testid="table-field-mapping">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-[45%]">Your column</TableHead>
                        <TableHead className="text-xs">Maps to</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detectedColumns.map((col) => {
                        const sample = sampleValues[col] ?? "";
                        const current = fieldMapping[col] ?? "";
                        const isRequiredField = current !== "" && requiredFields.some((f) => f.key === current);
                        const isUnmapped = current === "";
                        // Highlight rows that map to required fields (positive) or rows that are skipped
                        // while required fields still need a home (amber nudge).
                        const rowAmber = isUnmapped && unmappedRequired.length > 0;
                        return (
                          <TableRow
                            key={col}
                            className={rowAmber ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}
                            data-testid={`row-mapping-${col}`}
                          >
                            <TableCell className="py-2 align-top">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium">{col}</span>
                                {isRequiredField && (
                                  <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1.5 py-0 text-[9px] font-semibold leading-4">
                                    required
                                  </span>
                                )}
                              </div>
                              {sample && (
                                <div className="mt-0.5 max-w-[180px] truncate text-[10px] text-muted-foreground">{sample}</div>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              <Select
                                value={current || "__skip__"}
                                onValueChange={(v) =>
                                  setFieldMapping((prev) => ({ ...prev, [col]: v === "__skip__" ? "" : v }))
                                }
                              >
                                <SelectTrigger
                                  className={`h-7 text-xs ${isUnmapped && unmappedRequired.length > 0 ? "border-amber-300 dark:border-amber-700 text-muted-foreground" : current === "" ? "text-muted-foreground" : ""}`}
                                  data-testid={`select-mapping-${col}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__skip__">
                                    <span className="text-muted-foreground">— Skip this column —</span>
                                  </SelectItem>
                                  {systemFields.map((f) => (
                                    <SelectItem key={f.key} value={f.key}>
                                      {f.label}{f.required ? " *" : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Required-field warning */}
                {unmappedRequired.length > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400" data-testid="panel-required-unmapped">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Required field{unmappedRequired.length > 1 ? "s" : ""} not mapped:{" "}
                    {unmappedRequired.map((f) => f.label).join(", ")}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <button
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => setFieldMapping({ ...suggestedMapping })}
                    data-testid="button-reset-mapping"
                  >
                    Reset to suggestions
                  </button>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStep("upload")}
                      data-testid="button-back-to-upload"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      size="sm"
                      disabled={!canContinueFromMapping}
                      onClick={goToReview}
                      data-testid="button-continue-to-review"
                    >
                      Continue
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Review & Import ── */}
            {step === "review" && (
              <div className="space-y-3">
                {/* File info pill */}
                {fileInfo && (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid="panel-file-info-review">
                    <span className="flex-1 truncate text-muted-foreground text-xs">
                      {fileName} · {fileInfo.dataRowCount} row{fileInfo.dataRowCount !== 1 ? "s" : ""}
                    </span>
                    <button
                      className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => { setStep("mapping"); setPreview(null); }}
                      data-testid="button-edit-mapping"
                    >
                      Edit mapping
                    </button>
                  </div>
                )}

                {/* Loading */}
                {previewMutation.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-preview-loading">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validating rows…
                  </div>
                )}

                {/* Quality audit panel */}
                {renderQualityPanel()}

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setStep("mapping"); setPreview(null); }}
                    data-testid="button-back-to-mapping"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
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
                  <label
                    className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none"
                    data-testid="label-skip-quality-audit"
                  >
                    <Checkbox
                      checked={skipQualityAudit}
                      onCheckedChange={(v) => {
                        setSkipQualityAudit(!!v);
                        setPreview(null);
                        setTimeout(() => previewMutation.mutate(), 0);
                      }}
                      data-testid="checkbox-skip-quality-audit"
                    />
                    Skip quality audit
                  </label>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
          {/* ── Past imports tab ── */}
          <div className="space-y-3">
            {/* Duplicate cleaner action */}
            <div className="flex items-center justify-between rounded-md border border-dashed border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">Duplicate entries</p>
                <p className="text-xs text-muted-foreground">Find and remove content ideas imported more than once.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setShowDupeDialog(true); refetchDupes(); }}
                data-testid="button-find-duplicates"
              >
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                Clean up
              </Button>
            </div>

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

          {/* Duplicate cleaner dialog */}
          <Dialog open={showDupeDialog} onOpenChange={(v) => { setShowDupeDialog(v); if (!v) setSelectedDupeGroups(new Set()); }}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-duplicates">
              <DialogHeader>
                <DialogTitle>Find &amp; Remove Duplicates</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Groups below share the same topic and scheduled date. The oldest entry in each group is kept; extras will be archived.
                </p>
              </DialogHeader>

              {dupesLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!dupesLoading && dupeGroups.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground" data-testid="text-no-duplicates">
                  No duplicates found in this project.
                </p>
              )}

              {!dupesLoading && dupeGroups.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{dupeGroups.length} duplicate group{dupeGroups.length === 1 ? "" : "s"} found</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => {
                        if (selectedDupeGroups.size === dupeGroups.length) {
                          setSelectedDupeGroups(new Set());
                        } else {
                          setSelectedDupeGroups(new Set(dupeGroups.map((g) => `${g.topic}|||${g.scheduledDate ?? ""}`)));
                        }
                      }}
                      data-testid="button-select-all-dupes"
                    >
                      {selectedDupeGroups.size === dupeGroups.length ? "Deselect all" : "Select all"}
                    </Button>
                  </div>

                  {dupeGroups.map((grp, i) => {
                    const key = `${grp.topic}|||${grp.scheduledDate ?? ""}`;
                    const checked = selectedDupeGroups.has(key);
                    const extras = grp.ids.length - 1;
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-3 rounded-md border p-2.5 cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-border"}`}
                        onClick={() => {
                          setSelectedDupeGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key); else next.add(key);
                            return next;
                          });
                        }}
                        data-testid={`row-dupe-group-${i}`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => {}}
                          className="mt-0.5 pointer-events-none"
                          data-testid={`checkbox-dupe-${i}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{grp.topic}</p>
                          <p className="text-xs text-muted-foreground">
                            {grp.scheduledDate ? fmtDate(grp.scheduledDate) : "No date"} ·{" "}
                            <span className="font-medium text-amber-600 dark:text-amber-400">{grp.ids.length}×</span> copies
                            {extras > 0 && <span className="ml-1 text-muted-foreground">— {extras} will be archived</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    className="w-full mt-2"
                    disabled={selectedDupeGroups.size === 0 || removeDupesMutation.isPending}
                    onClick={handleConfirmRemoveDupes}
                    data-testid="button-confirm-remove-dupes"
                  >
                    {removeDupesMutation.isPending
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <XCircle className="mr-2 h-4 w-4" />}
                    Archive extras in {selectedDupeGroups.size} group{selectedDupeGroups.size === 1 ? "" : "s"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
          </>
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
  standalone,
}: {
  ideaId: string | null;
  onClose: () => void;
  onOpenGallery?: () => void;
  fromCalendar?: boolean;
  onMutated?: () => void;
  standalone?: boolean;
}) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const [, navigate] = useLocation();
  const [comment, setComment] = useState("");
  const [peekTab, setPeekTab] = useState<"details" | "performance">("details");

  // Performance log state
  const [logPerfOpen, setLogPerfOpen] = useState(false);
  const [perfPlatform, setPerfPlatform] = useState("linkedin");
  const [perfDate, setPerfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [perfImpressions, setPerfImpressions] = useState("");
  const [perfReactions, setPerfReactions] = useState("");
  const [perfComments, setPerfComments] = useState("");
  const [perfShares, setPerfShares] = useState("");
  const [perfClicks, setPerfClicks] = useState("");
  const [perfReach, setPerfReach] = useState("");
  const [perfWhatWorked, setPerfWhatWorked] = useState("");

  const { data: idea, isLoading } = useQuery<StudioContentIdea & { comments: StudioIdeaComment[] }>({
    queryKey: ["/api/studio/content-ideas", ideaId],
    enabled: !!ideaId,
  });

  const { data: linkedArticle } = useQuery<{ id: string; status: string; title: string }>({
    queryKey: ["/api/admin/studio/articles", idea?.linkedArticleId],
    enabled: !!idea?.linkedArticleId,
  });

  // Performance entries
  type PerfEntry = {
    id: string; platform: string; measuredAt: string;
    impressions: number|null; reactions: number|null; comments: number|null;
    shares: number|null; clicks: number|null; reach: number|null;
    whatWorked: string|null; loggedByName: string; createdAt: string;
  };
  const { data: perfEntries = [], refetch: refetchPerf } = useQuery<PerfEntry[]>({
    queryKey: ["/api/studio/content-ideas", ideaId, "performance"],
    queryFn: async () => {
      const res = await fetch(`/api/studio/content-ideas/${ideaId}/performance`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!ideaId && peekTab === "performance",
  });

  const logPerfMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/studio/content-ideas/${ideaId}/performance`, {
        platform: perfPlatform,
        measuredAt: perfDate,
        impressions: perfImpressions || undefined,
        reactions: perfReactions || undefined,
        comments: perfComments || undefined,
        shares: perfShares || undefined,
        clicks: perfClicks || undefined,
        reach: perfReach || undefined,
        whatWorked: perfWhatWorked || undefined,
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      setLogPerfOpen(false);
      setPerfImpressions(""); setPerfReactions(""); setPerfComments("");
      setPerfShares(""); setPerfClicks(""); setPerfReach(""); setPerfWhatWorked("");
      setPerfDate(new Date().toISOString().slice(0, 10));
      refetchPerf();
      toast({ title: "Performance logged", description: "Entry saved." });
    },
    onError: (e: Error) => toast({ title: "Failed to log", description: e.message, variant: "destructive" }),
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
  const isInsightsIdea = !!idea && isInsightsContentType(idea.contentType);
  const promotable = !!idea && (!!typeCfg || isInsightsIdea) && idea.status === "approved" && !idea.linkedArticleId;
  const isSocialIdea = typeCfg?.family === "social";

  const innerBody = !idea ? null : (
    <>
      {standalone ? (
        <div className="flex items-center gap-3 pb-2 border-b mb-3">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            data-testid="button-peek-back"
          >
            ← Back
          </button>
          <h1 className="pr-6 text-left text-base font-semibold" data-testid="text-peek-topic">
            {TYPE_ICON[idea.contentType] || ""} {idea.topic}
          </h1>
        </div>
      ) : (
        <SheetHeader>
          <SheetTitle className="pr-6 text-left" data-testid="text-peek-topic">
            {TYPE_ICON[idea.contentType] || ""} {idea.topic}
          </SheetTitle>
        </SheetHeader>
      )}

      {/* Tab switcher */}
            <div className="mt-3 flex gap-1 border-b pb-0">
              <button
                className={`flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${peekTab === "details" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setPeekTab("details")}
                data-testid="tab-peek-details"
              >
                Details
              </button>
              <button
                className={`flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${peekTab === "performance" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setPeekTab("performance")}
                data-testid="tab-peek-performance"
              >
                <Activity className="h-3.5 w-3.5" />
                Performance
                {perfEntries.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0 text-[10px] text-primary">{perfEntries.length}</span>
                )}
              </button>
            </div>

            {/* ─── Performance tab ─────────────────────────────── */}
            {peekTab === "performance" && (
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    {perfEntries.length === 0
                      ? "No performance entries yet. Log after publishing."
                      : `${perfEntries.length} entr${perfEntries.length === 1 ? "y" : "ies"} logged`}
                  </p>
                  {(["published", "done", "scheduled", "approved"].includes(idea.status)) && can("studio.create_article") && (
                    <Button size="sm" variant="outline" onClick={() => setLogPerfOpen(true)} data-testid="button-log-performance">
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Log Performance
                    </Button>
                  )}
                </div>

                {perfEntries.length > 0 && (() => {
                    const best = perfEntries[0];
                    return (
                      <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1" data-testid="perf-summary-card">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Latest Entry</p>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold capitalize">{best.platform}</span>
                          <span className="text-muted-foreground">{best.measuredAt}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                          {best.impressions != null && <span><strong className="text-foreground">{best.impressions.toLocaleString()}</strong> impr.</span>}
                          {best.reactions != null && <span><strong className="text-foreground">{best.reactions}</strong> react.</span>}
                          {best.shares != null && <span><strong className="text-foreground">{best.shares}</strong> shares</span>}
                          {best.reach != null && <span><strong className="text-foreground">{best.reach.toLocaleString()}</strong> reach</span>}
                        </div>
                        {best.whatWorked && <p className="italic text-muted-foreground">"{best.whatWorked}"</p>}
                      </div>
                    );
                  })()}

                {perfEntries.length > 1 && (
                  <div className="space-y-2">
                    {perfEntries.map((entry) => {
                      const samePlatformPrev = perfEntries
                        .filter((e) => e.platform === entry.platform && e.measuredAt < entry.measuredAt)
                        .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
                      const trend = samePlatformPrev && entry.impressions != null && samePlatformPrev.impressions != null
                        ? entry.impressions > samePlatformPrev.impressions ? "up"
                          : entry.impressions < samePlatformPrev.impressions ? "down" : "flat"
                        : null;
                      return (
                        <div key={entry.id} className="rounded-md border p-3 text-xs space-y-1" data-testid={`perf-entry-${entry.id}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold capitalize">{entry.platform}</span>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              {trend === "up" && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                              {trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
                              <span>{entry.measuredAt}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-muted-foreground">
                            {entry.impressions != null && <span><strong className="text-foreground">{entry.impressions.toLocaleString()}</strong> impr.</span>}
                            {entry.reactions != null && <span><strong className="text-foreground">{entry.reactions}</strong> react.</span>}
                            {entry.comments != null && <span><strong className="text-foreground">{entry.comments}</strong> cmts</span>}
                            {entry.shares != null && <span><strong className="text-foreground">{entry.shares}</strong> shares</span>}
                            {entry.clicks != null && <span><strong className="text-foreground">{entry.clicks}</strong> clicks</span>}
                            {entry.reach != null && <span><strong className="text-foreground">{entry.reach.toLocaleString()}</strong> reach</span>}
                          </div>
                          {entry.whatWorked && (
                            <p className="mt-1 italic text-muted-foreground">"{entry.whatWorked}"</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">by {entry.loggedByName}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-xs text-muted-foreground border-t pt-3">
                  <a href="/studio/guide/analytics" target="_blank" className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-analytics-guide">
                    <ExternalLink className="h-3 w-3" />
                    Where do I find these numbers? →
                  </a>
                </p>
              </div>
            )}

            {/* ─── Details tab ─────────────────────────────────── */}
            <div className={`mt-3 space-y-4 text-sm ${peekTab !== "details" ? "hidden" : ""}`}>
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

              {(idea as any).needsAttention && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2" data-testid="panel-needs-attention-notice">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">This idea was flagged at import</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Review the topic, brief, and platform settings, then mark it as reviewed when ready.</p>
                  </div>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 border-amber-300 bg-amber-50 text-amber-700 text-xs hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400"
                      onClick={() => updateMutation.mutate({ needsAttention: false })}
                      disabled={updateMutation.isPending}
                      data-testid="button-mark-reviewed"
                    >
                      {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark as reviewed"}
                    </Button>
                  )}
                </div>
              )}

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
                  <Label className="text-xs text-muted-foreground">Post Format</Label>
                  {canEdit ? (
                    <FormatSelectorField
                      key={idea.id}
                      value={(idea as any).postFormat}
                      onValueChange={(v) => updateMutation.mutate({ postFormat: v } as any)}
                      triggerClassName="h-8"
                      testId="select-peek-format"
                    />
                  ) : (
                    <p data-testid="text-peek-format">
                      {(idea as any).postFormat ? <FormatBadge format={(idea as any).postFormat} /> : "—"}
                    </p>
                  )}
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
                <div className="flex items-center gap-2 flex-wrap" data-testid="panel-linked-article">
                  {linkedArticle && (
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${STATUS_CLASS[linkedArticle.status] ?? ""}`}
                      data-testid="badge-linked-article-status"
                    >
                      {STATUS_LABEL[linkedArticle.status] ?? linkedArticle.status}
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(studioPath(`/articles/${idea.linkedArticleId}/edit`))}
                    data-testid="button-open-linked-article"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Open article
                  </Button>
                </div>
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

            {/* ─── Log Performance Dialog ─────────────────────── */}
            <Dialog open={logPerfOpen} onOpenChange={setLogPerfOpen}>
              <DialogContent className="sm:max-w-sm" data-testid="dialog-log-performance">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" />
                    Log Performance
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div>
                    <Label className="text-xs">Platform</Label>
                    <select
                      className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm bg-background"
                      value={perfPlatform}
                      onChange={(e) => setPerfPlatform(e.target.value)}
                      data-testid="select-perf-platform"
                    >
                      <option value="linkedin">LinkedIn</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="x">X (Twitter)</option>
                      <option value="website">Website / Blog</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Measured Date</Label>
                    <Input type="date" className="mt-1 h-8 text-sm" value={perfDate} onChange={(e) => setPerfDate(e.target.value)} data-testid="input-perf-date" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Impressions</Label>
                      <Input type="number" className="mt-1 h-8 text-sm" placeholder="e.g. 4500" value={perfImpressions} onChange={(e) => setPerfImpressions(e.target.value)} data-testid="input-perf-impressions" />
                    </div>
                    <div>
                      <Label className="text-xs">Reach</Label>
                      <Input type="number" className="mt-1 h-8 text-sm" placeholder="e.g. 3200" value={perfReach} onChange={(e) => setPerfReach(e.target.value)} data-testid="input-perf-reach" />
                    </div>
                    <div>
                      <Label className="text-xs">Reactions / Likes</Label>
                      <Input type="number" className="mt-1 h-8 text-sm" placeholder="e.g. 87" value={perfReactions} onChange={(e) => setPerfReactions(e.target.value)} data-testid="input-perf-reactions" />
                    </div>
                    <div>
                      <Label className="text-xs">Comments</Label>
                      <Input type="number" className="mt-1 h-8 text-sm" placeholder="e.g. 23" value={perfComments} onChange={(e) => setPerfComments(e.target.value)} data-testid="input-perf-comments" />
                    </div>
                    <div>
                      <Label className="text-xs">Shares / Reposts</Label>
                      <Input type="number" className="mt-1 h-8 text-sm" placeholder="e.g. 14" value={perfShares} onChange={(e) => setPerfShares(e.target.value)} data-testid="input-perf-shares" />
                    </div>
                    <div>
                      <Label className="text-xs">Link Clicks</Label>
                      <Input type="number" className="mt-1 h-8 text-sm" placeholder="e.g. 61" value={perfClicks} onChange={(e) => setPerfClicks(e.target.value)} data-testid="input-perf-clicks" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">What worked? <span className="text-muted-foreground">(optional — used by AI on regen)</span></Label>
                    <Textarea
                      className="mt-1 text-sm min-h-[60px]"
                      placeholder="e.g. Opening question hooked readers, short sentences boosted shares"
                      value={perfWhatWorked}
                      onChange={(e) => setPerfWhatWorked(e.target.value)}
                      data-testid="textarea-perf-what-worked"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setLogPerfOpen(false)} data-testid="button-perf-cancel">Cancel</Button>
                    <Button
                      size="sm"
                      disabled={logPerfMutation.isPending}
                      onClick={() => logPerfMutation.mutate()}
                      data-testid="button-perf-save"
                    >
                      {logPerfMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
    </>
  );

  const loadingEl = <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  if (standalone) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 overflow-y-auto" data-testid="idea-detail-standalone">
        {isLoading || !idea ? loadingEl : innerBody}
      </div>
    );
  }

  return (
    <Sheet open={!!ideaId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {isLoading || !idea ? loadingEl : innerBody}
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function PipelineView({ lens, navigateOnClick }: { lens: Lens; navigateOnClick?: boolean }) {
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
  const handleIdeaClick = (id: string) => {
    if (navigateOnClick) navigate(`/studio/ideas/${id}`);
    else setPeekId(id);
  };
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  const [showBacklog, setShowBacklog] = useState(true);
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [boardDateMode, setBoardDateMode] = useState<"all" | "today" | "pick">("all");
  const [boardPickDate, setBoardPickDate] = useState(() => toISODate(new Date()));
  const [showRejected, setShowRejected] = useState(true);
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [recoverDate, setRecoverDate] = useState("");

  // Deep links: ?idea=<id> opens the peek; ?create=1 opens quick-create;
  // ?campaignId=<id> filters by campaign; ?status=<s> filters by status;
  // ?scheduled_date=<yyyy-mm-dd> filters to a single day (from Calendar workspace link).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idea = params.get("idea");
    if (idea) setPeekId(idea);
    if (params.get("create")) setCreateOpen(true);
    const campaign = params.get("campaignId");
    if (campaign) setCampaignFilter(campaign);
    const status = params.get("status");
    if (status) setStatusFilter(status);
    const sd = params.get("scheduled_date");
    if (sd) setDateFilter(sd);
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
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`/api/studio/content-ideas?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch content ideas");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  // Batch-fetch linked article statuses so board/table cards can show real status.
  const hasLinkedArticles = (ideas ?? []).some((i) => i.linkedArticleId);
  const { data: linkedArticlesPage } = useQuery<{ items: { id: string; status: string; title: string }[] }>({
    queryKey: ["/api/admin/studio/articles", { projectId: selectedProjectId, batch: true }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/articles?projectId=${encodeURIComponent(selectedProjectId)}&limit=500`, { credentials: "include" });
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled: !!selectedProjectId && hasLinkedArticles,
  });
  const articleStatusMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of linkedArticlesPage?.items ?? []) m[a.id] = a.status;
    return m;
  }, [linkedArticlesPage]);

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

  // Client-side date filter — applied when navigating from Calendar "View in Pipeline" link.
  const filteredIdeas = useMemo(() => {
    if (!dateFilter) return ideas ?? [];
    return (ideas ?? []).filter((i) => i.scheduledDate === dateFilter);
  }, [ideas, dateFilter]);

  const scheduled = useMemo(() => (ideas ?? []).filter((i) => i.scheduledDate), [ideas]);
  const backlog = useMemo(() => (ideas ?? []).filter((i) => !i.scheduledDate), [ideas]);

  const boardActiveDateStr = useMemo(() => {
    if (boardDateMode === "today") return toISODate(new Date());
    if (boardDateMode === "pick") return boardPickDate;
    return null;
  }, [boardDateMode, boardPickDate]);

  const rejectedIdeas = useMemo(
    () => (ideas ?? []).filter((i) => i.status === "rejected"),
    [ideas],
  );

  const recoverMutation = useMutation({
    mutationFn: async ({ id, scheduledDate }: { id: string; scheduledDate: string | null }) => {
      const res = await apiRequest("PATCH", `/api/studio/content-ideas/${id}`, {
        status: "draft",
        scheduledDate: scheduledDate || null,
        rejectionNote: null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      setRecoveringId(null);
      setRecoverDate("");
      toast({ title: "Idea recovered", description: "Moved back to Draft." });
    },
    onError: (e: Error) => toast({ title: "Recovery failed", description: e.message, variant: "destructive" }),
  });

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
      className={`block w-full rounded px-1.5 py-0.5 text-left text-[11px] leading-tight ${STATUS_CLASS[idea.status] || "bg-muted"}`}
      onClick={() => handleIdeaClick(idea.id)}
      title={idea.topic}
      data-testid={`chip-idea-${idea.id}`}
    >
      <span className="flex items-center gap-1 truncate">
        <span className="truncate">{TYPE_ICON[idea.contentType] || ""} {idea.topic}</span>
        {(idea as any).postFormat && (
          <span className="shrink-0"><FormatBadge format={(idea as any).postFormat} /></span>
        )}
      </span>
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

        {dateFilter && (
          <div className="flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300" data-testid="date-filter-badge">
            <span>📅 Showing ideas scheduled for <strong>{new Date(`${dateFilter}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</strong></span>
            <button className="ml-1 rounded px-1 hover:bg-violet-100 dark:hover:bg-violet-900" onClick={() => setDateFilter(null)} data-testid="button-clear-date-filter">✕ Clear</button>
          </div>
        )}

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
                            onClick={() => handleIdeaClick(idea.id)}
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

            {lens === "board" && (() => {
              // Compute board date filter from the base ideas list (with status/type/channel filters
              // but WITHOUT the URL dateFilter param) so Board's Today/Pick-a-date toggle works
              // independently of the Calendar deep-link date filter.
              const boardBaseIdeas = ideas ?? [];
              const boardDateIdeas = boardActiveDateStr
                ? boardBaseIdeas.filter((i) => i.scheduledDate === boardActiveDateStr)
                : boardBaseIdeas;
              return (
                <div className="space-y-3">
                  {/* ── View toggle: All / Today / Pick a date ── */}
                  <div className="flex flex-wrap items-center gap-2" data-testid="board-date-toggle">
                    <span className="text-xs text-muted-foreground font-medium">Show:</span>
                    <button
                      className={`rounded-md px-3 py-1 text-xs font-medium border transition-colors ${boardDateMode === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                      onClick={() => setBoardDateMode("all")}
                      data-testid="button-board-filter-all"
                    >
                      All
                    </button>
                    <button
                      className={`rounded-md px-3 py-1 text-xs font-medium border transition-colors ${boardDateMode === "today" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                      onClick={() => setBoardDateMode("today")}
                      data-testid="button-board-filter-today"
                    >
                      Today
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        className={`rounded-md px-3 py-1 text-xs font-medium border transition-colors ${boardDateMode === "pick" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                        onClick={() => setBoardDateMode("pick")}
                        data-testid="button-board-filter-pick"
                      >
                        Pick a date
                      </button>
                      {boardDateMode === "pick" && (
                        <Input
                          type="date"
                          value={boardPickDate}
                          onChange={(e) => e.target.value && setBoardPickDate(e.target.value)}
                          className="h-7 w-36 text-xs"
                          data-testid="input-board-date-pick"
                        />
                      )}
                    </div>
                    {boardActiveDateStr && (
                      <span className="text-xs text-muted-foreground">
                        — {new Date(`${boardActiveDateStr}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>

                  {/* ── Kanban columns ── */}
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {BOARD_COLUMNS.map((col) => {
                      const colIdeas = boardDateIdeas.filter((i) => i.status === col);
                      const totalColIdeas = filteredIdeas.filter((i) => i.status === col);
                      const isFiltered = !!boardActiveDateStr;
                      return (
                        <div key={col} className="w-56 shrink-0 rounded-md border bg-muted/30" data-testid={`board-column-${col}`}>
                          <div className="flex items-center justify-between border-b px-2 py-1.5">
                            <span className="text-xs font-semibold">{STATUS_LABEL[col]}</span>
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{colIdeas.length}</Badge>
                              {isFiltered && totalColIdeas.length > colIdeas.length && (
                                <span className="text-[10px] text-muted-foreground">/ {totalColIdeas.length}</span>
                              )}
                            </div>
                          </div>
                          <div className="min-h-12 space-y-1.5 p-1.5">
                            {colIdeas.length === 0 && isFiltered && (
                              <p className="text-center py-3 text-[11px] text-muted-foreground" data-testid={`board-column-empty-${col}`}>
                                No content for this day
                              </p>
                            )}
                            {colIdeas.map((idea) => {
                              const linkedArtStatus = idea.linkedArticleId ? articleStatusMap[idea.linkedArticleId] : null;
                              return (
                                <button
                                  key={idea.id}
                                  className="w-full rounded-md border bg-background p-2 text-left text-xs shadow-sm hover:border-primary/40"
                                  onClick={() => handleIdeaClick(idea.id)}
                                  data-testid={`board-card-${idea.id}`}
                                >
                                  <p className="font-medium leading-snug">{TYPE_ICON[idea.contentType] || ""} {idea.topic}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                                    {idea.scheduledDate ? (
                                      <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                                        📅 {new Date(`${idea.scheduledDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                      </span>
                                    ) : (
                                      <span>Backlog</span>
                                    )}
                                    {idea.pillar && <span>· {idea.pillar.replace(/_/g, " ")}</span>}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {(idea as any).needsAttention && (
                                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" data-testid={`badge-needs-attention-${idea.id}`}>
                                        <AlertTriangle className="h-2.5 w-2.5" /> Review
                                      </span>
                                    )}
                                    {idea.origin === "bd_agent" && (
                                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" title={(idea as any).bdIntelMetadata?.detectedDomain || "BD Intel"} data-testid={`badge-bd-${idea.id}`}>
                                        ⚡ BD
                                      </span>
                                    )}
                                    {(idea as any).postFormat && (
                                      <FormatBadge format={(idea as any).postFormat} />
                                    )}
                                    {idea.linkedArticleId && (
                                      <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_CLASS[linkedArtStatus ?? ""] ?? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"}`} data-testid={`badge-article-${idea.id}`}>
                                        📰 {linkedArtStatus ? STATUS_LABEL[linkedArtStatus] ?? linkedArtStatus : "Article"}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Rejected strip ── */}
                  {rejectedIdeas.length > 0 && (
                    <Card data-testid="rejected-strip">
                      <CardContent className="p-3">
                        <button
                          className="flex w-full items-center justify-between text-sm font-semibold"
                          onClick={() => setShowRejected((v) => !v)}
                          data-testid="button-toggle-rejected"
                        >
                          <span className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            Rejected ({rejectedIdeas.length})
                          </span>
                          <span className="text-xs text-muted-foreground">{showRejected ? "Hide" : "Show"}</span>
                        </button>

                        {showRejected && (
                          <div className="mt-3 space-y-2">
                            {rejectedIdeas.map((idea) => (
                              <div
                                key={idea.id}
                                className="rounded-md border border-red-100 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20 p-2.5"
                                data-testid={`rejected-card-${idea.id}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium leading-snug truncate">
                                      {TYPE_ICON[idea.contentType] || ""} {idea.topic}
                                    </p>
                                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                      {idea.scheduledDate && (
                                        <span>📅 Originally: {fmtDate(idea.scheduledDate)}</span>
                                      )}
                                      {(idea as any).rejectionNote && (
                                        <span className="text-red-600 dark:text-red-400">
                                          ✕ {(idea as any).rejectionNote}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0 h-7 text-xs border-red-200 hover:bg-red-50 dark:border-red-800"
                                    onClick={() => {
                                      setRecoveringId(idea.id);
                                      setRecoverDate(idea.scheduledDate ?? "");
                                    }}
                                    data-testid={`button-recover-${idea.id}`}
                                  >
                                    <RotateCcw className="mr-1 h-3 w-3" />
                                    Recover → Draft
                                  </Button>
                                </div>

                                {recoveringId === idea.id && (
                                  <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-md border bg-background px-2.5 py-2" data-testid={`recover-form-${idea.id}`}>
                                    <label className="text-[11px] text-muted-foreground shrink-0">New date (optional):</label>
                                    <Input
                                      type="date"
                                      value={recoverDate}
                                      onChange={(e) => setRecoverDate(e.target.value)}
                                      className="h-7 w-36 text-xs"
                                      data-testid={`input-recover-date-${idea.id}`}
                                    />
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs"
                                      disabled={recoverMutation.isPending}
                                      onClick={() => recoverMutation.mutate({ id: idea.id, scheduledDate: recoverDate || null })}
                                      data-testid={`button-recover-confirm-${idea.id}`}
                                    >
                                      {recoverMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                      Confirm
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() => { setRecoveringId(null); setRecoverDate(""); }}
                                      data-testid={`button-recover-cancel-${idea.id}`}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })()}

            {lens === "table" && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Format</TableHead>
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
                    {filteredIdeas.length === 0 && (
                      <TableRow><TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">No ideas match your filters.</TableCell></TableRow>
                    )}
                    {filteredIdeas.map((idea) => {
                      const nextStates = (STUDIO_IDEA_TRANSITIONS[idea.status as StudioIdeaStatus] ?? []).filter((s) =>
                        ["approved", "rejected", "changes_requested"].includes(s) ? canReview : canEdit,
                      );
                      const linkedArtStatus = idea.linkedArticleId ? articleStatusMap[idea.linkedArticleId] : null;
                      return (
                        <TableRow key={idea.id} className="cursor-pointer" onClick={() => handleIdeaClick(idea.id)} data-testid={`row-idea-${idea.id}`}>
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
                          <TableCell className="text-xs">
                            {(idea as any).postFormat ? <FormatBadge format={(idea as any).postFormat} /> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="max-w-64 text-sm font-medium">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate">{idea.topic}</span>
                              {(idea as any).needsAttention && (
                                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" data-testid={`badge-needs-attention-${idea.id}`}>
                                  <AlertTriangle className="h-2.5 w-2.5" /> Review
                                </span>
                              )}
                              {idea.linkedArticleId && (
                                <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_CLASS[linkedArtStatus ?? ""] ?? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"}`} data-testid={`badge-article-table-${idea.id}`}>
                                  📰 {linkedArtStatus ? STATUS_LABEL[linkedArtStatus] ?? linkedArtStatus : "Article"}
                                </span>
                              )}
                            </span>
                          </TableCell>
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
                          <TableCell className="text-xs">
                            {idea.origin === "bd_agent" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" title={(idea as any).bdIntelMetadata?.detectedDomain} data-testid={`badge-origin-bd-${idea.id}`}>
                                ⚡ BD Intel
                              </span>
                            ) : (
                              idea.origin
                            )}
                          </TableCell>
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
