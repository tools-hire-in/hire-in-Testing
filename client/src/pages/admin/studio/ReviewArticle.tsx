import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  MessageSquareWarning,
  XCircle,
  Users,
  Clock3,
  ChevronRight,
} from "lucide-react";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "./studioConstants";
import type { StudioArticle, StudioReviewAssignment } from "@shared/schema";

interface Reviewer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface ReviewDetail {
  article: StudioArticle;
  assignments: StudioReviewAssignment[];
  activeAssignment: StudioReviewAssignment | null;
}

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  changes_requested: "Changes requested",
  declined: "Declined",
  reassigned: "Reassigned",
};

function reviewerName(r: Reviewer) {
  const name = `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim();
  return name || r.email;
}

function ReviewArticleInner({ id }: { id: string }) {
  const { enabled: newLook } = useNewLook();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { role } = usePermissions();
  const isPrivileged = role === "super_admin" || role === "admin";

  const [comment, setComment] = useState("");
  const [reassignTo, setReassignTo] = useState("");

  const { data, isLoading, error } = useQuery<ReviewDetail>({
    queryKey: ["/api/admin/studio/articles", id, "review"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/articles/${id}/review`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load review");
      }
      return res.json();
    },
    enabled: !!id,
    retry: false,
  });

  const { data: reviewers } = useQuery<Reviewer[]>({
    queryKey: ["/api/admin/studio/reviewers"],
  });

  const decisionMutation = useMutation({
    mutationFn: async (decision: "approve" | "request_changes" | "decline") => {
      const res = await apiRequest("POST", `/api/admin/studio/articles/${id}/review-decision`, {
        decision,
        comment: comment.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id, "review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/stats"] });
      toast({ title: "Decision recorded" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not record decision", description: err.message, variant: "destructive" });
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/studio/articles/${id}/reassign`, {
        reviewerUserId: reassignTo,
        comment: comment.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setComment("");
      setReassignTo("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id, "review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/inbox"] });
      toast({ title: "Article reassigned" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not reassign", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout>
        <div className="mx-auto max-w-md py-24 text-center">
          <XCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Unable to open review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {(error as Error)?.message || "This article is not available for review."}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setLocation("/admin/studio/inbox")}
            data-testid="button-back-inbox"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to inbox
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const { article, assignments, activeAssignment } = data;
  const inReview = article.status === "in_review";
  const busy = decisionMutation.isPending || reassignMutation.isPending;
  const reassignOptions = (reviewers ?? []).filter(
    (r) => r.id !== activeAssignment?.reviewerUserId,
  );

  return (
    <AdminLayout>
      <div className="space-y-4 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={PenLine}
            eyebrow="Studio"
            title="Review Article"
            subtitle={article.title}
            testId="text-review-title"
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              onClick={() => setLocation("/admin/studio/inbox")}
              className="inline-flex items-center gap-1 hover:text-foreground"
              data-testid="button-back-inbox"
            >
              <ArrowLeft className="h-4 w-4" />
              Inbox
            </button>
            <ChevronRight className="h-3 w-3" />
            <span className="truncate font-medium text-foreground">{article.title}</span>
            <Badge variant="secondary" className={STATUS_BADGE_CLASS[article.status] ?? ""}>
              {STATUS_LABELS[article.status] ?? article.status}
            </Badge>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          {/* Article content */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-review-title">
                {article.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {article.category && <Badge variant="outline">{article.category}</Badge>}
                <span>{article.contentType}</span>
                {article.readTimeMinutes ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    {article.readTimeMinutes} min read
                  </span>
                ) : null}
              </div>
              {article.excerpt && (
                <p className="mt-3 text-sm text-muted-foreground">{article.excerpt}</p>
              )}
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="prose prose-sm max-w-none dark:prose-invert" data-testid="markdown-review">
                  {article.bodyMarkdown ? (
                    <ReactMarkdown>{article.bodyMarkdown}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground">This article has no content yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Decision panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Your decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!inReview ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-not-in-review">
                    This article is not currently in review. No action is needed.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="review-comment">Comment</Label>
                      <Textarea
                        id="review-comment"
                        rows={4}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Required for Request Changes / Decline"
                        data-testid="input-review-comment"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Button
                        onClick={() => decisionMutation.mutate("approve")}
                        disabled={busy}
                        data-testid="button-approve"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => decisionMutation.mutate("request_changes")}
                        disabled={busy}
                        data-testid="button-request-changes"
                      >
                        <MessageSquareWarning className="mr-2 h-4 w-4" />
                        Request Changes
                      </Button>
                      <Button
                        variant="outline"
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                        onClick={() => decisionMutation.mutate("decline")}
                        disabled={busy}
                        data-testid="button-decline"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Decline
                      </Button>
                    </div>

                    <div className="space-y-2 border-t pt-3">
                      <Label className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {isPrivileged ? "Reassign (override)" : "Hand off to"}
                      </Label>
                      <Select value={reassignTo} onValueChange={setReassignTo}>
                        <SelectTrigger data-testid="select-reassign">
                          <SelectValue placeholder="Choose a reviewer" />
                        </SelectTrigger>
                        <SelectContent>
                          {reassignOptions.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {reviewerName(r)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => reassignMutation.mutate()}
                        disabled={busy || !reassignTo}
                        data-testid="button-reassign"
                      >
                        Reassign
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Assignment history */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Review history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assignments yet.</p>
                ) : (
                  assignments.map((a) => {
                    const who = reviewers?.find((r) => r.id === a.reviewerUserId);
                    return (
                      <div
                        key={a.id}
                        className="space-y-1 rounded-md border p-3 text-sm"
                        data-testid={`assignment-${a.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {who ? reviewerName(who) : "Reviewer"}
                          </span>
                          <Badge variant="outline">
                            {ASSIGNMENT_STATUS_LABELS[a.status] ?? a.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Assigned {new Date(a.createdAt).toLocaleString()}
                          {a.dueAt ? ` · due ${new Date(a.dueAt).toLocaleDateString()}` : ""}
                        </div>
                        {a.comment && <p className="text-xs">{a.comment}</p>}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default function ReviewArticle() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <ReviewArticleInner id={id} />;
}
