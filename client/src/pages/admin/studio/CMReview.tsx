import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, BookOpen, Clock3, XCircle, CheckCircle2, FileText, User } from "lucide-react";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { useStudioProject } from "./useStudioProject";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { StudioArticle, StudioAuthorProfile } from "@shared/schema";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "./studioConstants";
import { getStudioContentType } from "@shared/studioContent";
import { ForcePublishButton } from "./ForcePublishButton";

type QueueItem = StudioArticle & {
  authorName: string | null;
  projectName: string | null;
  reviewerName: string | null;
};

export default function CMReview() {
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } = useStudioProject();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();

  const [reason, setReason] = useState("");
  // "auto" is the sentinel for "let the server auto-assign"; never use "" (Radix SelectItem forbids empty values).
  const [authorProfileId, setAuthorProfileId] = useState<string>("auto");

  const { data: items, isLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/admin/studio/cm-review", selectedProjectId],
    queryFn: async () => {
      const url = selectedProjectId
        ? `/api/admin/studio/cm-review?projectId=${selectedProjectId}`
        : "/api/admin/studio/cm-review";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load CM review queue");
      return res.json();
    },
  });

  // Load authors unconditionally so the picker is ready when a queue item is selected.
  const { data: authors } = useQuery<StudioAuthorProfile[]>({
    queryKey: ["/api/admin/studio/authors"],
    queryFn: async () => {
      const res = await fetch("/api/admin/studio/authors", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Load full article detail for the selected item so we can show a content preview.
  const { data: articleDetail } = useQuery<StudioArticle & { authorName: string | null }>({
    queryKey: ["/api/admin/studio/articles", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/articles/${selectedId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load article");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const decisionMutation = useMutation({
    mutationFn: async (decision: "approve" | "reject") => {
      if (decision === "reject" && !reason.trim()) throw new Error("A reason is required to reject");
      const res = await apiRequest("POST", `/api/admin/studio/articles/${selectedId}/cm-decision`, {
        decision,
        reason: reason.trim() || undefined,
        authorProfileId: authorProfileId === "auto" ? undefined : authorProfileId || undefined,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Action failed");
      }
      return res.json();
    },
    onSuccess: (_d, decision) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/cm-review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/cm-review/count"] });
      setReason("");
      setAuthorProfileId("auto");
      setSelectedId(null);
      toast({
        title: decision === "approve" ? "Sent for author sign-off" : "Article sent back to draft",
      });
    },
    onError: (err: Error) => toast({ title: "Action failed", description: err.message, variant: "destructive" }),
  });

  const list = items ?? [];
  const active = selectedId && list.some((a) => a.id === selectedId) ? selectedId : null;
  const activeItem = active ? list.find((a) => a.id === active) : null;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-cm-review-title">
              Content Manager Review
            </h1>
            <p className="text-sm text-muted-foreground">
              Review peer-approved articles, assign authors, and advance to author sign-off.
            </p>
          </div>
          <ProjectSwitcher
            projects={projects}
            projectsLoading={projectsLoading}
            selectedProjectId={selectedProjectId}
            onChange={setSelectedProjectId}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Queue list */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : list.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                  <BookOpen className="h-8 w-8" />
                  <span data-testid="text-empty-cm-review">No articles awaiting CM review.</span>
                </CardContent>
              </Card>
            ) : (
              list.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setSelectedId(a.id);
                    setReason("");
                    setAuthorProfileId((a as any).authorProfileId ?? "auto");
                  }}
                  className={`w-full rounded-lg border p-3 text-left transition hover-elevate ${
                    active === a.id ? "border-primary bg-muted/40" : ""
                  }`}
                  data-testid={`card-cm-review-${a.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-sm font-medium">{a.title}</span>
                    <Badge variant="secondary" className={`shrink-0 text-[10px] ${STATUS_BADGE_CLASS[a.status] ?? ""}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {a.projectName && <Badge variant="outline">{a.projectName}</Badge>}
                    <span>{getStudioContentType(a.contentType)?.label ?? a.contentType}</span>
                    {a.authorName && <span>· by {a.authorName}</span>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3 w-3" />
                    updated {new Date(a.updatedAt).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Detail + decision panel */}
          <div className="space-y-4">
            {active && activeItem ? (
              <>
                {/* Article metadata card */}
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-base font-semibold" data-testid="text-cm-article-title">
                          {activeItem.title}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {getStudioContentType(activeItem.contentType)?.label ?? activeItem.contentType}
                          </span>
                          {activeItem.authorName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {activeItem.authorName}
                            </span>
                          )}
                          {activeItem.readTimeMinutes && (
                            <span className="flex items-center gap-1">
                              <Clock3 className="h-3 w-3" />
                              {activeItem.readTimeMinutes}m read
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className={STATUS_BADGE_CLASS[activeItem.status] ?? ""}>
                        {STATUS_LABELS[activeItem.status] ?? activeItem.status}
                      </Badge>
                    </div>
                    {articleDetail?.excerpt && (
                      <>
                        <Separator />
                        <p className="text-sm text-muted-foreground line-clamp-4">{articleDetail.excerpt}</p>
                      </>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/admin/studio/articles/${active}/edit`, "_blank")}
                        data-testid="button-cm-open-editor"
                      >
                        Open in Editor
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Decision card */}
                <Card>
                  <CardContent className="space-y-4 p-4">
                    <h3 className="text-sm font-semibold">CM Decision</h3>
                    <div className="space-y-2">
                      <Label>Assign author (optional)</Label>
                      <Select value={authorProfileId} onValueChange={setAuthorProfileId}>
                        <SelectTrigger data-testid="select-cm-author">
                          <SelectValue placeholder="Auto-assign or leave unset" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto-assign</SelectItem>
                          {(authors ?? []).filter((a) => a.isActive).map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.displayName}{a.title ? ` — ${a.title}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cm-reason">Reason (required to reject)</Label>
                      <Textarea
                        id="cm-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="Required when sending back to draft"
                        data-testid="input-cm-reason"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => decisionMutation.mutate("approve")}
                        disabled={decisionMutation.isPending}
                        data-testid="button-cm-approve"
                      >
                        {decisionMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Send for Author Sign-Off
                      </Button>
                      <Button
                        variant="outline"
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                        onClick={() => decisionMutation.mutate("reject")}
                        disabled={decisionMutation.isPending}
                        data-testid="button-cm-reject"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Send Back to Draft
                      </Button>
                    </div>
                    <ForcePublishButton
                      articleId={active}
                      articleTitle={activeItem.title}
                      riskFlags={(activeItem as any).riskFlags}
                      onDone={() => { setSelectedId(null); }}
                    />
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-24 text-center text-sm text-muted-foreground">
                  Select an article from the queue to review it.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
