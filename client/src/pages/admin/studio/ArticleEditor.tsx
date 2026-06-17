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
} from "lucide-react";
import {
  STUDIO_CONTENT_TYPES,
  getStudioContentType,
  computeReadTime,
} from "@shared/studioContent";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "./studioConstants";
import type { StudioArticle, StudioArticleVersion, StudioAuthorProfile } from "@shared/schema";

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

  const [form, setForm] = useState<EditorState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
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

          <Tabs defaultValue="write">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="write" data-testid="tab-write">
                  Write
                </TabsTrigger>
                <TabsTrigger value="preview" data-testid="tab-preview">
                  Preview
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
    </div>
  );

  // ref declared below to keep hook order stable
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
