import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  XCircle,
  Clock3,
  Send,
  CalendarClock,
  Rocket,
  Save,
} from "lucide-react";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "./studioConstants";
import { SocialKitPreview } from "./SocialKitPreview";
import type { StudioArticle, StudioReviewAssignment, StudioAuditEvent } from "@shared/schema";
import type { CanonicalSocialKit } from "@shared/studioAi";

interface WorkflowDetail {
  article: StudioArticle;
  authorName: string | null;
  projectName: string | null;
  assignments: StudioReviewAssignment[];
  auditEvents: StudioAuditEvent[];
}

const AUDIT_LABELS: Record<string, string> = {
  review_approved: "Reviewer approved",
  review_changes_requested: "Reviewer requested changes",
  review_declined: "Reviewer declined",
  marketing_polished: "Marketing edited",
  marketing_recommended: "Marketing recommended",
  marketing_rejected: "Marketing sent back",
  final_approved: "Final sign-off",
  final_rejected: "Final sign-off rejected",
  article_published: "Published",
  article_scheduled: "Scheduled",
  article_unpublished: "Unpublished",
  article_archived: "Archived",
  status_changed: "Status changed",
};

const platformLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X (Twitter)",
};

type CaptionEdit = { platform: string; text: string };

export function WorkflowReviewPanel({
  articleId,
  mode,
  onDone,
}: {
  articleId: string;
  mode: "marketing" | "final";
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  // Marketing polish state.
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [captions, setCaptions] = useState<CaptionEdit[]>([]);
  const [authorConfirmed, setAuthorConfirmed] = useState(false);

  const { data, isLoading, error } = useQuery<WorkflowDetail>({
    queryKey: ["/api/admin/studio/articles", articleId, "workflow"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/articles/${articleId}/workflow`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load article");
      }
      return res.json();
    },
    enabled: !!articleId,
    retry: false,
  });

  // Seed the editable polish fields whenever a new article loads.
  useEffect(() => {
    if (!data) return;
    const a = data.article;
    const kit = (a.socialKitJsonb as CanonicalSocialKit | null) ?? null;
    setSeoTitle(a.seoTitle ?? "");
    setSeoDescription(a.seoDescription ?? "");
    setCoverImageUrl(a.coverImageUrl ?? "");
    setCaptions((kit?.captions ?? []).map((c) => ({ platform: c.platform, text: c.text })));
    setAuthorConfirmed(false);
    setReason("");
    setScheduledAt("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, data?.article?.id]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", articleId, "workflow"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/approvals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/final-approval"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/calendar"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/stats"] });
  };

  const buildEdits = () => ({
    seoTitle,
    seoDescription,
    coverImageUrl,
    captions: captions.map((c) => ({ platform: c.platform, text: c.text })),
  });

  const marketingMutation = useMutation({
    mutationFn: async (decision: "recommend" | "reject" | "save") => {
      const res = await apiRequest("POST", `/api/admin/studio/articles/${articleId}/marketing-decision`, {
        decision,
        reason: reason.trim() || undefined,
        edits: decision === "reject" ? undefined : buildEdits(),
      });
      return res.json();
    },
    onSuccess: (_d, decision) => {
      invalidate();
      if (decision === "save") {
        toast({ title: "Changes saved" });
        return;
      }
      setReason("");
      toast({ title: decision === "recommend" ? "Recommended for final sign-off" : "Sent back to draft" });
      onDone?.();
    },
    onError: (err: Error) => toast({ title: "Action failed", description: err.message, variant: "destructive" }),
  });

  const finalMutation = useMutation({
    mutationFn: async (decision: "publish" | "schedule" | "reject") => {
      const res = await apiRequest("POST", `/api/admin/studio/articles/${articleId}/final-decision`, {
        decision,
        reason: reason.trim() || undefined,
        scheduledAt: decision === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
      });
      return res.json();
    },
    onSuccess: (_d, decision) => {
      setReason("");
      setScheduledAt("");
      invalidate();
      toast({
        title:
          decision === "publish"
            ? "Article published"
            : decision === "schedule"
            ? "Article scheduled"
            : "Sent back to draft",
      });
      onDone?.();
    },
    onError: (err: Error) => toast({ title: "Action failed", description: err.message, variant: "destructive" }),
  });

  const busy = marketingMutation.isPending || finalMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground" data-testid="text-workflow-error">
        {(error as Error)?.message || "Unable to load this article."}
      </div>
    );
  }

  const { article } = data;
  const kit = (article.socialKitJsonb as CanonicalSocialKit | null) ?? null;
  const isMarketing = mode === "marketing";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-workflow-title">
            {article.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className={STATUS_BADGE_CLASS[article.status] ?? ""}>
              {STATUS_LABELS[article.status] ?? article.status}
            </Badge>
            {data.projectName && <Badge variant="outline">{data.projectName}</Badge>}
            {article.category && <Badge variant="outline">{article.category}</Badge>}
            <span>{article.contentType}</span>
            {article.readTimeMinutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3 w-3" />
                {article.readTimeMinutes} min read
              </span>
            ) : null}
            {data.authorName && <span>by {data.authorName}</span>}
          </div>
          {article.excerpt && <p className="mt-3 text-sm text-muted-foreground">{article.excerpt}</p>}
        </div>

        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content" data-testid="tab-content">Article</TabsTrigger>
            <TabsTrigger value="social" data-testid="tab-social">Social Kit</TabsTrigger>
            {isMarketing && <TabsTrigger value="polish" data-testid="tab-polish">Polish</TabsTrigger>}
          </TabsList>
          <TabsContent value="content" className="mt-3">
            <Card>
              <CardContent className="p-6">
                <div className="prose prose-sm max-w-none dark:prose-invert" data-testid="markdown-workflow">
                  {article.bodyMarkdown ? (
                    <ReactMarkdown>{article.bodyMarkdown}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground">This article has no content yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="social" className="mt-3">
            <SocialKitPreview kit={kit} />
          </TabsContent>
          {isMarketing && (
            <TabsContent value="polish" className="mt-3 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">SEO metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="seo-title">SEO title</Label>
                    <Input
                      id="seo-title"
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                      placeholder="Title used for search & social previews"
                      data-testid="input-seo-title"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="seo-description">SEO description</Label>
                    <Textarea
                      id="seo-description"
                      rows={3}
                      value={seoDescription}
                      onChange={(e) => setSeoDescription(e.target.value)}
                      placeholder="Meta description (≈155 characters)"
                      data-testid="input-seo-description"
                    />
                    <p className="text-xs text-muted-foreground">{seoDescription.length} characters</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Featured image</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cover-image">Image URL</Label>
                    <Input
                      id="cover-image"
                      value={coverImageUrl}
                      onChange={(e) => setCoverImageUrl(e.target.value)}
                      placeholder="https://…"
                      data-testid="input-cover-image"
                    />
                  </div>
                  {coverImageUrl ? (
                    <img
                      src={coverImageUrl}
                      alt="Featured preview"
                      className="max-h-40 w-full rounded-md border object-cover"
                      data-testid="img-cover-preview"
                    />
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Social captions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {captions.length === 0 ? (
                    <p className="text-sm text-muted-foreground" data-testid="text-no-captions">
                      No social captions to edit.
                    </p>
                  ) : (
                    captions.map((c, i) => (
                      <div key={c.platform} className="space-y-1.5">
                        <Label htmlFor={`caption-${c.platform}`}>
                          {platformLabels[c.platform] ?? c.platform}
                        </Label>
                        <Textarea
                          id={`caption-${c.platform}`}
                          rows={3}
                          value={c.text}
                          onChange={(e) =>
                            setCaptions((prev) =>
                              prev.map((p, idx) => (idx === i ? { ...p, text: e.target.value } : p)),
                            )
                          }
                          data-testid={`input-caption-${c.platform}`}
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Author attribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    Byline: <span className="font-medium">{data.authorName ?? "Unassigned"}</span>
                  </p>
                  <label className="flex items-center gap-2 text-sm" htmlFor="confirm-author">
                    <Checkbox
                      id="confirm-author"
                      checked={authorConfirmed}
                      onCheckedChange={(v) => setAuthorConfirmed(v === true)}
                      data-testid="checkbox-confirm-author"
                    />
                    I confirm the author attribution is correct
                  </label>
                </CardContent>
              </Card>

              <Button
                variant="secondary"
                onClick={() => marketingMutation.mutate("save")}
                disabled={busy}
                data-testid="button-save-polish"
              >
                <Save className="mr-2 h-4 w-4" />
                Save changes
              </Button>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {isMarketing ? "Marketing decision" : "Final sign-off"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === "final" && (
              <div className="space-y-2">
                <Label htmlFor="schedule-at" className="flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Schedule for
                </Label>
                <Input
                  id="schedule-at"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  data-testid="input-schedule-at"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="workflow-reason">
                {isMarketing ? "Notes / reason" : "Reason (required to reject)"}
              </Label>
              <Textarea
                id="workflow-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required when sending back to draft"
                data-testid="input-workflow-reason"
              />
            </div>

            {isMarketing ? (
              <div className="grid gap-2">
                {!authorConfirmed && (
                  <p className="text-xs text-muted-foreground" data-testid="text-confirm-hint">
                    Confirm author attribution (Polish tab) to recommend.
                  </p>
                )}
                <Button
                  onClick={() => marketingMutation.mutate("recommend")}
                  disabled={busy || !authorConfirmed}
                  data-testid="button-recommend"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Recommend for sign-off
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                  onClick={() => marketingMutation.mutate("reject")}
                  disabled={busy}
                  data-testid="button-marketing-reject"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Send back to draft
                </Button>
              </div>
            ) : (
              <div className="grid gap-2">
                <Button
                  onClick={() => finalMutation.mutate("publish")}
                  disabled={busy}
                  data-testid="button-publish-now"
                >
                  <Rocket className="mr-2 h-4 w-4" />
                  Publish now
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => finalMutation.mutate("schedule")}
                  disabled={busy || !scheduledAt}
                  data-testid="button-schedule"
                >
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Schedule
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                  onClick={() => finalMutation.mutate("reject")}
                  disabled={busy}
                  data-testid="button-final-reject"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Send back to draft
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Workflow history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.auditEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              [...data.auditEvents]
                .filter((e) => e.eventType !== "status_changed")
                .reverse()
                .map((e) => {
                  const meta = (e.metadata ?? {}) as Record<string, any>;
                  return (
                    <div key={e.id} className="space-y-1 rounded-md border p-3 text-sm" data-testid={`audit-${e.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{AUDIT_LABELS[e.eventType] ?? e.eventType}</span>
                        {meta.scheduled !== undefined && (
                          <Badge variant="outline">{meta.scheduled ? "scheduled" : "now"}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.createdAt).toLocaleString()}
                      </div>
                      {meta.reason && <p className="text-xs">{meta.reason}</p>}
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
