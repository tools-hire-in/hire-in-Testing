import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link2,
  Code,
  Loader2,
  ArrowLeft,
  Save,
  History,
  RotateCcw,
  ImagePlus,
  Clock3,
  ChevronRight,
  Sparkles,
  Wand2,
  Share2,
  Copy,
  AlertTriangle,
  ShieldCheck,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { COMPLIANCE_MODES, type CanonicalSocialKit } from "@shared/studioAi";
import {
  STUDIO_CONTENT_TYPES,
  getStudioContentType,
  computeReadTime,
} from "@shared/studioContent";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "./studioConstants";
import type { StudioArticle, StudioArticleVersion, StudioAuthorProfile } from "@shared/schema";
import { cardVariantsForLayout, cardBudget, type CardBudget } from "@shared/socialCards";

// Client mirror of the server transition map (permission key per target).
const TRANSITIONS: Record<string, { to: string; label: string; permission: string }[]> = {
  draft: [{ to: "in_review", label: "Submit for Review", permission: "studio.edit_article" }],
  in_review: [
    { to: "approved", label: "Approve", permission: "studio.review_article" },
    { to: "draft", label: "Send back to Draft", permission: "studio.review_article" },
  ],
  approved: [
    { to: "published", label: "Publish", permission: "studio.publish_article" },
    { to: "draft", label: "Reopen as Draft", permission: "studio.edit_article" },
  ],
  scheduled: [{ to: "published", label: "Publish now", permission: "studio.publish_article" }],
  published: [],
  ready_to_export: [],
};

interface EditorState {
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  contentType: string;
  category: string;
  tags: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  coverImageUrl: string;
  authorProfileId: string;
}

function ArticleEditorInner({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can("studio.edit_article");
  const canGenerate = can("studio.generate_ai_draft");

  const [form, setForm] = useState<EditorState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // AI generation modal state.
  const [genOpen, setGenOpen] = useState(false);
  const [genMode, setGenMode] = useState<"topic" | "shape">("topic");
  const [genTopic, setGenTopic] = useState("");
  const [genRawInput, setGenRawInput] = useState("");
  const [genKeyPoints, setGenKeyPoints] = useState("");
  const [genSourceNotes, setGenSourceNotes] = useState("");
  const [genIndustry, setGenIndustry] = useState("");
  const [genCompliance, setGenCompliance] = useState("normal");
  const [riskFlags, setRiskFlags] = useState<string[]>([]);
  const [requiredEdits, setRequiredEdits] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<EditorState | null>(null);
  const dirtyRef = useRef(false);
  const lastUploadPath = useRef("");

  const { data: article, isLoading } = useQuery<StudioArticle>({
    queryKey: ["/api/admin/studio/articles", id],
    enabled: !!id,
  });

  const { data: authors } = useQuery<StudioAuthorProfile[]>({
    queryKey: [
      "/api/admin/studio/authors",
      { projectId: article?.projectId ?? "" },
    ],
    enabled: !!article?.projectId,
  });

  const { data: versions } = useQuery<StudioArticleVersion[]>({
    queryKey: ["/api/admin/studio/articles", id, "versions"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/articles/${id}/versions`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load versions");
      return res.json();
    },
    enabled: !!id,
  });

  // Hydrate the form once the article loads.
  useEffect(() => {
    if (article && !form) {
      const next: EditorState = {
        title: article.title ?? "",
        excerpt: article.excerpt ?? "",
        bodyMarkdown: article.bodyMarkdown ?? "",
        contentType: article.contentType ?? "quick_take",
        category: article.category ?? "",
        tags: (article.tags ?? []).join(", "),
        slug: article.slug ?? "",
        seoTitle: article.seoTitle ?? "",
        seoDescription: article.seoDescription ?? "",
        coverImageUrl: article.coverImageUrl ?? "",
        authorProfileId: article.authorProfileId ?? "",
      };
      setForm(next);
      formRef.current = next;
    }
  }, [article, form]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const update = (patch: Partial<EditorState>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
    setDirty(true);
  };

  const buildPayload = (state: EditorState, autosave: boolean) => ({
    title: state.title.trim() || "Untitled",
    excerpt: state.excerpt || null,
    bodyMarkdown: state.bodyMarkdown,
    contentType: state.contentType,
    category: state.category.trim() || null,
    tags: state.tags
      ? state.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [],
    slug: state.slug || null,
    seoTitle: state.seoTitle || null,
    seoDescription: state.seoDescription || null,
    coverImageUrl: state.coverImageUrl || null,
    authorProfileId: state.authorProfileId || null,
    autosave,
  });

  const saveMutation = useMutation({
    mutationFn: async (autosave: boolean) => {
      const state = formRef.current!;
      const res = await apiRequest(
        "PATCH",
        `/api/admin/studio/articles/${id}`,
        buildPayload(state, autosave),
      );
      return res.json();
    },
    onSuccess: () => {
      setDirty(false);
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles"] });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const saveVersionMutation = useMutation({
    mutationFn: async () => {
      // Persist current edits first, then snapshot.
      if (dirtyRef.current) {
        await apiRequest(
          "PATCH",
          `/api/admin/studio/articles/${id}`,
          buildPayload(formRef.current!, false),
        );
        setDirty(false);
        setLastSaved(new Date());
      }
      const res = await apiRequest("POST", `/api/admin/studio/articles/${id}/versions`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      toast({ title: "Version saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save version", description: err.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/studio/articles/${id}/versions/${versionId}/restore`,
        {},
      );
      return res.json();
    },
    onSuccess: (restored: StudioArticle) => {
      const next: EditorState = {
        title: restored.title ?? "",
        excerpt: restored.excerpt ?? "",
        bodyMarkdown: restored.bodyMarkdown ?? "",
        contentType: restored.contentType ?? "quick_take",
        category: restored.category ?? "",
        tags: (restored.tags ?? []).join(", "),
        slug: restored.slug ?? "",
        seoTitle: restored.seoTitle ?? "",
        seoDescription: restored.seoDescription ?? "",
        coverImageUrl: restored.coverImageUrl ?? "",
        authorProfileId: restored.authorProfileId ?? "",
      };
      setForm(next);
      formRef.current = next;
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      toast({ title: "Version restored" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not restore", description: err.message, variant: "destructive" });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async (to: string) => {
      if (dirtyRef.current) {
        await apiRequest(
          "PATCH",
          `/api/admin/studio/articles/${id}`,
          buildPayload(formRef.current!, false),
        );
        setDirty(false);
      }
      const res = await apiRequest("POST", `/api/admin/studio/articles/${id}/transition`, { to });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/stats"] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Transition failed", description: err.message, variant: "destructive" });
    },
  });

  const generateArticleMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        mode: genMode,
        industry: genIndustry || undefined,
        complianceMode: genCompliance,
        contentType: formRef.current?.contentType,
        sourceNotes: genSourceNotes || undefined,
      };
      if (genMode === "topic") {
        payload.topic = genTopic;
        payload.keyPoints = genKeyPoints
          ? genKeyPoints.split("\n").map((l) => l.trim()).filter(Boolean)
          : undefined;
      } else {
        payload.rawInput = genRawInput;
      }
      const res = await apiRequest(
        "POST",
        `/api/admin/studio/articles/${id}/generate-article`,
        payload,
      );
      return res.json();
    },
    onSuccess: (data: any) => {
      const draft = data.draft;
      // Apply the generated draft into the editor (never auto-publishes).
      setForm((f) =>
        f
          ? {
              ...f,
              title: draft.title || f.title,
              excerpt: draft.excerpt || f.excerpt,
              bodyMarkdown: draft.body_markdown || f.bodyMarkdown,
              slug: draft.slug || f.slug,
              seoTitle: draft.meta_title || f.seoTitle,
              seoDescription: draft.meta_description || f.seoDescription,
            }
          : f,
      );
      setDirty(true);
      setRiskFlags(data.riskFlags ?? data.qualityReview?.risk_flags ?? []);
      setRequiredEdits(data.qualityReview?.required_edits ?? []);
      setGenOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      const flagCount = (data.riskFlags ?? []).length;
      toast({
        title: "Draft generated",
        description:
          flagCount > 0
            ? `${flagCount} risk flag(s) raised — review before publishing.`
            : "Review the draft, then Save.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const generateSocialKitMutation = useMutation({
    mutationFn: async () => {
      // Persist current edits so the kit derives from saved content.
      if (dirtyRef.current) {
        await apiRequest(
          "PATCH",
          `/api/admin/studio/articles/${id}`,
          buildPayload(formRef.current!, false),
        );
        setDirty(false);
        setLastSaved(new Date());
      }
      const res = await apiRequest(
        "POST",
        `/api/admin/studio/articles/${id}/generate-social-kit`,
        { complianceMode: genCompliance, industry: genIndustry || undefined },
      );
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      const warnCount = (data.warnings ?? []).length;
      toast({
        title: "Social Kit generated",
        description: warnCount > 0 ? `${warnCount} length warning(s) — see the Social Kit tab.` : "See the Social Kit tab.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Social Kit failed", description: err.message, variant: "destructive" });
    },
  });

  const resolveRiskFlagsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/admin/studio/articles/${id}/resolve-risk-flags`,
        {},
      );
      return res.json();
    },
    onSuccess: () => {
      setRiskFlags([]);
      setRequiredEdits([]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      toast({ title: "Risk flags resolved" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not resolve flags", description: err.message, variant: "destructive" });
    },
  });

  const copyText = useCallback(
    (text: string, label: string) => {
      navigator.clipboard?.writeText(text).then(
        () => toast({ title: `${label} copied` }),
        () => toast({ title: "Copy failed", variant: "destructive" }),
      );
    },
    [toast],
  );

  // Auto-save every 60s when dirty.
  useEffect(() => {
    if (!canEdit) return;
    const interval = setInterval(() => {
      if (dirtyRef.current && formRef.current) {
        saveMutation.mutate(true);
      }
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  // Markdown toolbar: wrap or insert syntax around the current selection.
  const applyMarkdown = useCallback(
    (kind: string) => {
      const ta = textareaRef.current;
      if (!ta || !formRef.current) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const value = formRef.current.bodyMarkdown;
      const selected = value.slice(start, end);
      let inserted = selected;
      let cursorOffset = 0;
      switch (kind) {
        case "bold":
          inserted = `**${selected || "bold text"}**`;
          break;
        case "italic":
          inserted = `*${selected || "italic text"}*`;
          break;
        case "h2":
          inserted = `## ${selected || "Heading"}`;
          break;
        case "ul":
          inserted = (selected || "List item")
            .split("\n")
            .map((l) => `- ${l}`)
            .join("\n");
          break;
        case "ol":
          inserted = (selected || "List item")
            .split("\n")
            .map((l, i) => `${i + 1}. ${l}`)
            .join("\n");
          break;
        case "quote":
          inserted = `> ${selected || "Quote"}`;
          break;
        case "link":
          inserted = `[${selected || "link text"}](https://)`;
          cursorOffset = inserted.length - 1;
          break;
        case "code":
          inserted = selected.includes("\n")
            ? `\`\`\`\n${selected || "code"}\n\`\`\``
            : `\`${selected || "code"}\``;
          break;
      }
      const newValue = value.slice(0, start) + inserted + value.slice(end);
      update({ bodyMarkdown: newValue });
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + inserted.length - cursorOffset;
        ta.setSelectionRange(pos, pos);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (isLoading || !form || !article) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const contentType = getStudioContentType(form.contentType);
  const readTime = computeReadTime(form.bodyMarkdown, form.contentType);
  const availableTransitions = (TRANSITIONS[article.status] || []).filter((t) =>
    can(t.permission),
  );

  const toolbarButtons = [
    { kind: "bold", icon: Bold, label: "Bold" },
    { kind: "italic", icon: Italic, label: "Italic" },
    { kind: "h2", icon: Heading2, label: "Heading" },
    { kind: "ul", icon: List, label: "Bullet list" },
    { kind: "ol", icon: ListOrdered, label: "Numbered list" },
    { kind: "quote", icon: Quote, label: "Quote" },
    { kind: "link", icon: Link2, label: "Link" },
    { kind: "code", icon: Code, label: "Code" },
  ];

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={() => setLocation("/admin/studio/articles")}
            className="inline-flex items-center gap-1 hover:text-foreground"
            data-testid="button-back-articles"
          >
            <ArrowLeft className="h-4 w-4" />
            Articles
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="truncate font-medium text-foreground">{form.title || "Untitled"}</span>
          <Badge
            variant="secondary"
            className={STATUS_BADGE_CLASS[article.status] ?? ""}
            data-testid="badge-article-status"
          >
            {STATUS_LABELS[article.status] ?? article.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground" data-testid="text-save-state">
            {saveMutation.isPending
              ? "Saving…"
              : dirty
                ? "Unsaved changes"
                : lastSaved
                  ? `Saved ${lastSaved.toLocaleTimeString()}`
                  : "All changes saved"}
          </span>
          {canGenerate && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGenOpen(true)}
                disabled={generateArticleMutation.isPending}
                data-testid="button-open-generate"
              >
                {generateArticleMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate Draft
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateSocialKitMutation.mutate()}
                disabled={generateSocialKitMutation.isPending || !form.bodyMarkdown.trim()}
                data-testid="button-generate-social-kit"
              >
                {generateSocialKitMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="mr-2 h-4 w-4" />
                )}
                Social Kit
              </Button>
            </>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate(false)}
              disabled={saveMutation.isPending || !dirty}
              data-testid="button-save-article"
            >
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          )}
          {availableTransitions.map((t) => (
            <Button
              key={t.to}
              size="sm"
              variant={t.to === "draft" ? "outline" : "default"}
              onClick={() => transitionMutation.mutate(t.to)}
              disabled={transitionMutation.isPending}
              data-testid={`button-transition-${t.to}`}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main editor */}
        <div className="space-y-4">
          <Input
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Article title"
            className="h-auto border-0 px-0 text-2xl font-bold shadow-none focus-visible:ring-0"
            disabled={!canEdit}
            data-testid="input-article-title"
          />

          {riskFlags.length > 0 && (
            <Alert variant="destructive" data-testid="alert-risk-flags">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {riskFlags.length} AI risk flag{riskFlags.length > 1 ? "s" : ""} raised
              </AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-disc space-y-1 text-sm">
                  {riskFlags.map((f, i) => (
                    <li key={i} data-testid={`text-risk-flag-${i}`}>{f}</li>
                  ))}
                </ul>
                {requiredEdits.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide">Suggested edits</p>
                    <ul className="ml-4 list-disc space-y-1 text-sm">
                      {requiredEdits.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {can("studio.review_article") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => resolveRiskFlagsMutation.mutate()}
                    disabled={resolveRiskFlagsMutation.isPending}
                    data-testid="button-resolve-risk-flags"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Resolve flags (clears publish block)
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="write">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="write" data-testid="tab-write">
                  Write
                </TabsTrigger>
                <TabsTrigger value="preview" data-testid="tab-preview">
                  Preview
                </TabsTrigger>
                <TabsTrigger value="social" data-testid="tab-social">
                  Social Kit
                </TabsTrigger>
              </TabsList>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="h-3 w-3" />
                {readTime} min read
              </span>
            </div>

            <TabsContent value="write" className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
                {toolbarButtons.map((b) => (
                  <Button
                    key={b.kind}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={b.label}
                    disabled={!canEdit}
                    onClick={() => applyMarkdown(b.kind)}
                    data-testid={`button-md-${b.kind}`}
                  >
                    <b.icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
              <Textarea
                ref={textareaRef}
                value={form.bodyMarkdown}
                onChange={(e) => update({ bodyMarkdown: e.target.value })}
                placeholder="Write your article in Markdown…"
                className="min-h-[460px] font-mono text-sm leading-relaxed"
                disabled={!canEdit}
                data-testid="input-article-body"
              />
            </TabsContent>

            <TabsContent value="preview" className="mt-3">
              <Card>
                <CardContent className="p-6">
                  <div className="prose prose-sm max-w-none dark:prose-invert" data-testid="markdown-preview">
                    {form.bodyMarkdown ? (
                      <ReactMarkdown>{form.bodyMarkdown}</ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground">Nothing to preview yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="social" className="mt-3 space-y-4">
              <BrandedSocialCards article={article} />
              {(() => {
                const kit = (article.socialKitJsonb as CanonicalSocialKit | null) ?? null;
                if (!kit) {
                  return (
                    <Card>
                      <CardContent className="p-6 text-sm text-muted-foreground" data-testid="text-no-social-kit">
                        No Social Kit yet. Click <span className="font-medium">Social Kit</span> above to generate
                        captions, story frames, and cards from this article.
                      </CardContent>
                    </Card>
                  );
                }
                const platformLabels: Record<string, string> = {
                  linkedin: "LinkedIn",
                  instagram: "Instagram",
                  facebook: "Facebook",
                  twitter: "X (Twitter)",
                };
                return (
                  <div className="space-y-4">
                    {(kit.captions ?? []).map((cap) => (
                      <Card key={cap.platform} data-testid={`card-caption-${cap.platform}`}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm">
                            {platformLabels[cap.platform] ?? cap.platform}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {cap.text.length} chars
                            </span>
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => copyText(cap.text, platformLabels[cap.platform] ?? cap.platform)}
                            data-testid={`button-copy-${cap.platform}`}
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            Copy
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="whitespace-pre-wrap text-sm" data-testid={`text-caption-${cap.platform}`}>
                            {cap.text}
                          </p>
                          {(cap.variants ?? []).length > 0 && (
                            <div className="space-y-1.5 border-t pt-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Variants
                              </p>
                              {cap.variants!.map((v, i) => (
                                <div
                                  key={i}
                                  className="flex items-start justify-between gap-2 rounded-md bg-muted/40 p-2 text-xs"
                                  data-testid={`variant-${cap.platform}-${i}`}
                                >
                                  <span className="whitespace-pre-wrap">{v}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => copyText(v, "Variant")}
                                    data-testid={`button-copy-variant-${cap.platform}-${i}`}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          {(kit.hashtags?.[cap.platform] ?? []).length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {kit.hashtags![cap.platform].map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}

                    {(kit.thread ?? []).length > 0 && (
                      <Card data-testid="card-thread">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm">Thread</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => copyText(kit.thread!.join("\n\n"), "Thread")}
                            data-testid="button-copy-thread"
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            Copy
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-1.5">
                          {kit.thread!.map((t, i) => (
                            <p key={i} className="text-sm" data-testid={`text-thread-${i}`}>
                              {i + 1}. {t}
                            </p>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {(kit.story_frames ?? []).length > 0 && (
                      <Card data-testid="card-story-frames">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Story frames</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                          {kit.story_frames!.map((s, i) => (
                            <Badge key={i} variant="secondary" data-testid={`badge-story-${i}`}>
                              {s}
                            </Badge>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {kit.quote_card_text && (
                      <Card data-testid="card-quote">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm">Quote card</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => copyText(kit.quote_card_text, "Quote")}
                            data-testid="button-copy-quote"
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            Copy
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm italic">{kit.quote_card_text}</p>
                        </CardContent>
                      </Card>
                    )}

                    {(kit.checklist_card_items ?? []).length > 0 && (
                      <Card data-testid="card-checklist">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Checklist card</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="ml-4 list-disc space-y-1 text-sm">
                            {kit.checklist_card_items!.map((c, i) => (
                              <li key={i} data-testid={`text-checklist-${i}`}>{c}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {(kit.suggested_visual_template || kit.suggested_category_badge) && (
                      <p className="text-xs text-muted-foreground" data-testid="text-social-suggestions">
                        Suggested visual: {kit.suggested_visual_template || "n/a"}
                        {kit.suggested_category_badge ? ` · Badge: ${kit.suggested_category_badge}` : ""}
                      </p>
                    )}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </div>

        {/* Metadata sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Content type</Label>
                <Select
                  value={form.contentType}
                  onValueChange={(v) => update({ contentType: v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger data-testid="select-content-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDIO_CONTENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label} · {t.blurb}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {contentType && (
                  <p className="text-xs text-muted-foreground">
                    Target {contentType.blurb}. Read time clamps to this range.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={form.category}
                  onChange={(e) => update({ category: e.target.value })}
                  placeholder="e.g. Healthcare, IT, Engineering"
                  disabled={!canEdit}
                  data-testid="input-category"
                />
                <p className="text-xs text-muted-foreground">
                  Routes the review to the matching reviewer pool when submitted.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Author</Label>
                <Select
                  value={form.authorProfileId || "none"}
                  onValueChange={(v) => update({ authorProfileId: v === "none" ? "" : v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger data-testid="select-author">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {authors?.filter((a) => a.isActive).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  rows={3}
                  value={form.excerpt}
                  onChange={(e) => update({ excerpt: e.target.value })}
                  placeholder="Short summary…"
                  disabled={!canEdit}
                  data-testid="input-excerpt"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={form.tags}
                  onChange={(e) => update({ tags: e.target.value })}
                  placeholder="comma, separated"
                  disabled={!canEdit}
                  data-testid="input-tags"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => update({ slug: e.target.value })}
                  placeholder="url-slug"
                  disabled={!canEdit}
                  data-testid="input-slug"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Featured image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.coverImageUrl ? (
                <img
                  src={form.coverImageUrl}
                  alt="Cover"
                  className="aspect-video w-full rounded-md border object-cover"
                  data-testid="img-cover"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                  No image yet
                </div>
              )}
              {canEdit && (
                <div className="flex gap-2">
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={10485760}
                    buttonClassName="w-full"
                    onGetUploadParameters={async (file) => {
                      const res = await apiRequest("POST", "/api/admin/studio/upload-url", {
                        name: file.name,
                        size: file.size,
                        contentType: file.type,
                      });
                      const data = await res.json();
                      lastUploadPath.current = data.objectPath;
                      return { method: "PUT" as const, url: data.uploadURL };
                    }}
                    onComplete={() => {
                      if (lastUploadPath.current) {
                        update({ coverImageUrl: lastUploadPath.current });
                        toast({ title: "Image uploaded" });
                      }
                    }}
                  >
                    <span className="inline-flex items-center">
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {form.coverImageUrl ? "Replace image" : "Upload image"}
                    </span>
                  </ObjectUploader>
                  {form.coverImageUrl && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => update({ coverImageUrl: "" })}
                      data-testid="button-remove-cover"
                    >
                      ✕
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="seo-title">SEO title</Label>
                <Input
                  id="seo-title"
                  value={form.seoTitle}
                  onChange={(e) => update({ seoTitle: e.target.value })}
                  disabled={!canEdit}
                  data-testid="input-seo-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-desc">SEO description</Label>
                <Textarea
                  id="seo-desc"
                  rows={2}
                  value={form.seoDescription}
                  onChange={(e) => update({ seoDescription: e.target.value })}
                  disabled={!canEdit}
                  data-testid="input-seo-description"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4" />
                Versions
              </CardTitle>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveVersionMutation.mutate()}
                  disabled={saveVersionMutation.isPending}
                  data-testid="button-save-version"
                >
                  {saveVersionMutation.isPending && (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  )}
                  Snapshot
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {!versions || versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No versions saved yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs"
                      data-testid={`version-${v.id}`}
                    >
                      <div className="min-w-0">
                        <span className="font-medium">v{v.versionNo}</span>
                        <span className="ml-2 text-muted-foreground">
                          {v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}
                        </span>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => restoreMutation.mutate(v.id)}
                          disabled={restoreMutation.isPending}
                          data-testid={`button-restore-${v.id}`}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Restore
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Generate Draft modal — two input modes. */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Generate article draft
            </DialogTitle>
            <DialogDescription>
              AI generates a brand-safe draft into the editor. It never publishes — you review and save.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGenMode("topic")}
                className={`rounded-md border p-3 text-left text-sm transition ${
                  genMode === "topic" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
                data-testid="button-mode-topic"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Sparkles className="h-4 w-4" /> Start from a topic
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Give a topic and key points; AI writes the draft.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setGenMode("shape")}
                className={`rounded-md border p-3 text-left text-sm transition ${
                  genMode === "shape" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
                data-testid="button-mode-shape"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Wand2 className="h-4 w-4" /> Shape my idea / draft
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Paste your notes; AI keeps your facts and polishes.
                </span>
              </button>
            </div>

            {genMode === "topic" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="gen-topic">Topic</Label>
                  <Input
                    id="gen-topic"
                    value={genTopic}
                    onChange={(e) => setGenTopic(e.target.value)}
                    placeholder="e.g. How to reduce time-to-hire for night-shift nurses"
                    data-testid="input-gen-topic"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gen-key-points">Key points (one per line, optional)</Label>
                  <Textarea
                    id="gen-key-points"
                    rows={3}
                    value={genKeyPoints}
                    onChange={(e) => setGenKeyPoints(e.target.value)}
                    placeholder={"Credentialing checks\nShift reliability\nCompliance"}
                    data-testid="input-gen-key-points"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="gen-raw">Your idea, notes, or rough draft</Label>
                <Textarea
                  id="gen-raw"
                  rows={6}
                  value={genRawInput}
                  onChange={(e) => setGenRawInput(e.target.value)}
                  placeholder="Paste your draft or notes here. AI preserves your facts and figures."
                  data-testid="input-gen-raw"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="gen-source-notes">Source notes (verified facts only, optional)</Label>
              <Textarea
                id="gen-source-notes"
                rows={2}
                value={genSourceNotes}
                onChange={(e) => setGenSourceNotes(e.target.value)}
                placeholder="Any stats or facts the AI may cite. Unsupported claims get flagged."
                data-testid="input-gen-source-notes"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Industry</Label>
                <Select value={genIndustry || "none"} onValueChange={(v) => setGenIndustry(v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-gen-industry">
                    <SelectValue placeholder="General" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="it">IT</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="non_it">Non-IT</SelectItem>
                    <SelectItem value="hr_tech">HR tech</SelectItem>
                    <SelectItem value="food">Food / hospitality</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Compliance mode</Label>
                <Select value={genCompliance} onValueChange={setGenCompliance}>
                  <SelectTrigger data-testid="select-gen-compliance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPLIANCE_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {getComplianceBlurb(genCompliance)}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)} data-testid="button-cancel-generate">
              Cancel
            </Button>
            <Button
              onClick={() => generateArticleMutation.mutate()}
              disabled={
                generateArticleMutation.isPending ||
                (genMode === "topic" ? !genTopic.trim() : !genRawInput.trim())
              }
              data-testid="button-run-generate"
            >
              {generateArticleMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // ref declared below to keep hook order stable
}

function getComplianceBlurb(value: string): string {
  return COMPLIANCE_MODES.find((m) => m.value === value)?.blurb ?? "";
}

// Holds the most recent presigned upload object path between request + complete.
const lastUploadPath = { current: "" as string };

export default function ArticleEditor() {
  const params = useParams();
  const id = params.id as string;
  return (
    <AdminLayout>
      <ArticleEditorInner id={id} key={id} />
    </AdminLayout>
  );
}

const CARD_LAYOUT_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "checklist", label: "Checklist" },
  { value: "quote", label: "Quote" },
];

interface GeneratedCard {
  layout: string;
  platform: string;
  url: string;
  width: number;
  height: number;
}

function budgetSummary(b: CardBudget): string {
  const parts: string[] = [];
  if (b.title) parts.push(`Title ≤${b.title}`);
  if (b.quote) parts.push(`Quote ≤${b.quote}`);
  if (b.supporting) parts.push(`Body ≤${b.supporting}`);
  if (b.category) parts.push(`Tag ≤${b.category}`);
  if (b.tipTitle) parts.push(`Tip title ≤${b.tipTitle}`);
  if (b.tipDesc) parts.push(`Tip text ≤${b.tipDesc}`);
  if (b.maxTips) parts.push(`${b.maxTips} tips max`);
  return parts.join(" · ");
}

function BrandedSocialCards({ article }: { article: StudioArticle }) {
  const { toast } = useToast();
  const stored = (article.socialCardsJsonb as { layout?: string; cards?: GeneratedCard[] } | null) ?? null;
  const [layout, setLayout] = useState<string>(article.cardLayout ?? stored?.layout ?? "standard");
  const cards = stored?.cards ?? [];
  const variants = cardVariantsForLayout(layout as any);

  const regenerate = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/admin/studio/articles/${article.id}/regenerate-cards`, { layout }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", article.id] });
      toast({ title: "Social cards regenerated" });
    },
    onError: (e: any) => {
      toast({ title: "Could not regenerate cards", description: e?.message, variant: "destructive" });
    },
  });

  return (
    <Card data-testid="card-branded-social-cards">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-sm">Branded Social Cards</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Auto-generated when the article is approved. Pick a layout and regenerate any time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={layout} onValueChange={setLayout}>
            <SelectTrigger className="h-8 w-[140px]" data-testid="select-card-layout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CARD_LAYOUT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} data-testid={`option-layout-${o.value}`}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending}
            data-testid="button-regenerate-cards"
          >
            {regenerate.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            Regenerate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-md border bg-muted/30 p-3" data-testid="section-char-budgets">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Character budgets for the {layout} layout
          </p>
          <ul className="space-y-1">
            {variants.map((v) => {
              const summary = budgetSummary(cardBudget(layout, v.platform));
              return (
                <li
                  key={v.platform}
                  className="flex flex-wrap items-baseline gap-x-2 text-xs"
                  data-testid={`budget-${v.platform}`}
                >
                  <span className="font-medium">{v.platform}</span>
                  <span className="text-muted-foreground">
                    {summary || "No specific limits"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        {cards.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground" data-testid="text-no-cards">
            No cards generated yet. Approve the article or click Regenerate.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <div
                key={`${c.layout}-${c.platform}`}
                className="rounded-lg border p-2"
                data-testid={`card-social-${c.platform}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium">{c.platform}</span>
                  <a href={c.url} download data-testid={`link-download-${c.platform}`}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
                <div className="overflow-hidden rounded-md border bg-muted/30">
                  <img
                    src={c.url}
                    alt={`${c.layout} ${c.platform}`}
                    className="w-full"
                    style={{ aspectRatio: `${c.width} / ${c.height}` }}
                    data-testid={`img-card-${c.platform}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
