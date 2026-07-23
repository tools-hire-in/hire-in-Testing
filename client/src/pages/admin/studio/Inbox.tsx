import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Inbox as InboxIcon, Clock3, AlertTriangle, ChevronRight, PenLine } from "lucide-react";
import type { StudioArticle, StudioReviewAssignment } from "@shared/schema";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "./studioConstants";

type ReviewItem = StudioReviewAssignment & {
  type?: undefined;
  article: StudioArticle | null;
  projectName: string | null;
};

type AuthorSignOffItem = {
  id: string;
  articleId: string;
  reviewerUserId: string;
  status: "pending";
  type: "author_signoff";
  dueAt: null;
  createdAt: string;
  updatedAt: string;
  decisionAt: null;
  article: StudioArticle | null;
  projectName: string | null;
};

type InboxItem = ReviewItem | AuthorSignOffItem;

function dueMeta(dueAt: string | Date | null) {
  if (!dueAt) return { label: "No due date", overdue: false };
  const due = new Date(dueAt);
  const now = new Date();
  const overdue = due.getTime() < now.getTime();
  return { label: due.toLocaleDateString(), overdue };
}

export default function StudioInbox() {
  const { enabled: newLook } = useNewLook();
  const { data: items, isLoading } = useQuery<InboxItem[]>({
    queryKey: ["/api/admin/studio/inbox"],
  });

  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={InboxIcon}
            eyebrow="Studio"
            title="Reviewer Inbox"
            subtitle="Articles awaiting your review or sign-off, oldest first."
            testId="text-inbox-title"
          />
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <InboxIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-inbox-title">
                Reviewer Inbox
              </h1>
              <p className="text-sm text-muted-foreground">
                Articles awaiting your review or sign-off, oldest first.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !items || items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <InboxIcon className="h-8 w-8 text-muted-foreground" />
              <h3 className="text-lg font-semibold">You're all caught up</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                No articles are currently assigned to you for review or sign-off.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isAuthorSignOff = item.type === "author_signoff";
              const article = item.article;
              if (isAuthorSignOff) {
                return (
                  <Card
                    key={item.id}
                    className="border-indigo-200 dark:border-indigo-800"
                    data-testid={`card-inbox-${item.id}`}
                  >
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                          >
                            <PenLine className="mr-1 h-3 w-3" />
                            Author Sign-Off
                          </Badge>
                          <span className="truncate font-semibold" data-testid={`text-inbox-title-${item.id}`}>
                            {article?.title ?? "Untitled article"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {item.projectName && <span>{item.projectName}</span>}
                          <span>Your article is ready for your approval.</span>
                        </div>
                      </div>
                      {article && (
                        <Link href={`/admin/studio/articles/${article.id}/author-signoff`}>
                          <Button size="sm" data-testid={`button-review-${item.id}`}>
                            Review & Sign Off
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                );
              }

              const { label, overdue } = dueMeta((item as ReviewItem).dueAt);
              return (
                <Card key={item.id} data-testid={`card-inbox-${item.id}`}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold" data-testid={`text-inbox-title-${item.id}`}>
                          {article?.title ?? "Untitled article"}
                        </span>
                        {article && (
                          <Badge
                            variant="secondary"
                            className={STATUS_BADGE_CLASS[article.status] ?? ""}
                          >
                            {STATUS_LABELS[article.status] ?? article.status}
                          </Badge>
                        )}
                        {article?.category && (
                          <Badge variant="outline" data-testid={`badge-category-${item.id}`}>
                            {article.category}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {item.projectName && <span>{item.projectName}</span>}
                        <span
                          className={`inline-flex items-center gap-1 ${overdue ? "font-medium text-red-600 dark:text-red-400" : ""}`}
                          data-testid={`text-due-${item.id}`}
                        >
                          {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                          {overdue ? "Overdue" : "Due"} {label}
                        </span>
                      </div>
                    </div>
                    {article && (
                      <Link href={`/admin/studio/articles/${article.id}/review`}>
                        <Button size="sm" data-testid={`button-review-${item.id}`}>
                          Review
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
