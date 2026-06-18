import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, ArrowLeft, PenLine } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { StudioArticle } from "@shared/schema";

export default function AuthorSignOff() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  const { data: article, isLoading, error } = useQuery<StudioArticle>({
    queryKey: ["/api/admin/studio/articles", id, "author-signoff"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/articles/${id}/author-signoff`, {
        credentials: "include",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Article not found or access denied");
      }
      return res.json();
    },
    enabled: !!id,
  });

  const decisionMutation = useMutation({
    mutationFn: async (decision: "approve" | "request_changes") => {
      if (decision === "request_changes" && !reason.trim()) {
        throw new Error("Please provide a reason for requesting changes.");
      }
      const res = await apiRequest("POST", `/api/admin/studio/articles/${id}/author-decision`, {
        decision,
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Action failed");
      }
      return res.json();
    },
    onSuccess: (_d, decision) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/inbox"] });
      toast({
        title: decision === "approve" ? "Article approved" : "Changes requested",
        description:
          decision === "approve"
            ? "The article has been approved and will move to the marketing queue."
            : "The article has been sent back to draft for revisions.",
      });
      navigate("/admin/studio/inbox");
    },
    onError: (err: Error) =>
      toast({ title: "Action failed", description: err.message, variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/studio/inbox")}
            data-testid="button-back-inbox"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Inbox
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            <PenLine className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-signoff-title">
              Author Sign-Off
            </h1>
            <p className="text-sm text-muted-foreground">
              Review the article below and approve or request changes before it goes to marketing.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="p-6 text-center text-destructive">
              {(error as Error).message}
            </CardContent>
          </Card>
        ) : article ? (
          <div className="space-y-4">
            {/* Article overview */}
            <Card>
              <CardContent className="space-y-3 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                    Author Sign-Off Required
                  </Badge>
                  {article.contentType && (
                    <Badge variant="outline">{article.contentType}</Badge>
                  )}
                </div>
                <h2 className="text-xl font-semibold" data-testid="text-article-title">
                  {article.title}
                </h2>
                {article.excerpt && (
                  <p className="text-muted-foreground">{article.excerpt}</p>
                )}
                {article.seoDescription && article.seoDescription !== article.excerpt && (
                  <p className="text-sm text-muted-foreground border-l-2 pl-3 italic">
                    {article.seoDescription}
                  </p>
                )}
                {(article as any).category && (
                  <div className="text-xs text-muted-foreground">
                    Category: {(article as any).category}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Article body preview */}
            {article.bodyMarkdown && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Article Content
                  </h3>
                  <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm leading-relaxed">
                    {article.bodyMarkdown.slice(0, 4000)}
                    {article.bodyMarkdown.length > 4000 && (
                      <span className="text-muted-foreground"> …(truncated for preview)</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Decision panel */}
            <Card>
              <CardContent className="space-y-4 p-6">
                <h3 className="text-sm font-semibold">Your Decision</h3>
                <div className="space-y-2">
                  <Label htmlFor="reason">
                    Reason / feedback{" "}
                    <span className="text-muted-foreground font-normal">(required to request changes)</span>
                  </Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Optional note for approve; required if requesting changes"
                    data-testid="input-signoff-reason"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => decisionMutation.mutate("approve")}
                    disabled={decisionMutation.isPending}
                    className="gap-2"
                    data-testid="button-author-approve"
                  >
                    {decisionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Approve &amp; Sign Off
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => decisionMutation.mutate("request_changes")}
                    disabled={decisionMutation.isPending}
                    className="gap-2"
                    data-testid="button-author-request-changes"
                  >
                    {decisionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Request Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
