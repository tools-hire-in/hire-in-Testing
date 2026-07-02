import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, MessageSquare,
  AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Inbox,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useSopAccess } from "@/hooks/use-sop-access";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type SlaStatus = "on_track" | "at_risk" | "overdue";

type ReviewRow = {
  id: string;
  sopMasterId: string;
  sopVersion: number;
  round: number;
  reviewerId: string;
  status: string;
  dueAt: string | null;
  decisionAt: string | null;
  comment: string | null;
  assignedBy: string | null;
  createdAt: string;
  sopTitle: string;
  sopCode: string;
  sopCategory: string;
  sopLifecycleStatus: string;
  sopDocumentId: string | null;
  sopOwner: string;
  sopApprover: string | null;
  sopSummary: string | null;
  sopAiAssistAllowed: boolean;
  sopHumanSignoffRequired: boolean;
  assignedByName: string;
  slaStatus: SlaStatus;
};

const DECISION_LABELS: Record<string, string> = {
  approved: "Approved",
  approved_with_comments: "Approved with Comments",
  changes_requested: "Changes Requested",
  rejected: "Rejected",
  reviewed: "Reviewed",
};

const DECISION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  approved: "default",
  approved_with_comments: "default",
  reviewed: "secondary",
  changes_requested: "destructive",
  rejected: "destructive",
};

function SlaChip({ status, dueAt }: { status: SlaStatus; dueAt: string | null }) {
  if (!dueAt) return null;

  const due = new Date(dueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const colorClass =
    status === "overdue"
      ? "bg-red-100 text-red-700 border-red-200"
      : status === "at_risk"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-green-100 text-green-700 border-green-200";

  const label =
    status === "overdue"
      ? `OVERDUE (${Math.abs(diffDays)}d ago)`
      : diffHours < 24
      ? `Due in ${diffHours}h`
      : `Due in ${diffDays}d`;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${colorClass}`}
      data-testid="chip-sla-status"
    >
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}

function ReviewActionPanel({
  row,
  onDone,
}: {
  row: ReviewRow;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [action, setAction] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const requiresComment = action === "request_changes" || action === "reject";
  const supportsComment = action === "approve_with_comments";

  const actionMut = useMutation({
    mutationFn: async () => {
      if (!row.sopDocumentId) throw new Error("SOP document not found");
      return (
        await apiRequest("POST", `/api/sops/${row.sopDocumentId}/review-action`, {
          action,
          comment: comment.trim() || undefined,
        })
      ).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops/my-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sops/my-reviews/count"] });
      toast({ title: "Review recorded", description: `Your decision has been saved.` });
      onDone();
    },
    onError: (e: any) =>
      toast({ title: "Action failed", description: e?.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!action) return;
    if (requiresComment && !comment.trim()) {
      toast({ title: "Comment required", description: "Please explain your decision.", variant: "destructive" });
      return;
    }
    actionMut.mutate();
  };

  const actions = [
    { key: "approve", label: "Approve", icon: CheckCircle2, variant: "default" as const },
    { key: "approve_with_comments", label: "Approve with Comments", icon: MessageSquare, variant: "secondary" as const },
    { key: "request_changes", label: "Request Changes", icon: AlertTriangle, variant: "outline" as const },
    { key: "reject", label: "Reject", icon: XCircle, variant: "destructive" as const },
  ];

  return (
    <div className="space-y-3 pt-3 border-t mt-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Decision</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.key}
            size="sm"
            variant={action === a.key ? a.variant : "outline"}
            className={action === a.key ? "ring-2 ring-offset-1 ring-primary/40" : ""}
            onClick={() => setAction(a.key)}
            data-testid={`button-review-action-${a.key}`}
          >
            <a.icon className="h-3.5 w-3.5 mr-1" />
            {a.label}
          </Button>
        ))}
      </div>

      {(requiresComment || supportsComment) && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            {requiresComment ? "Comment (required)" : "Comment (optional)"}
          </label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add your review comment…"
            className="text-sm min-h-[72px]"
            data-testid="textarea-review-comment"
          />
        </div>
      )}

      {action && (
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={actionMut.isPending}
          data-testid="button-submit-review-decision"
        >
          {actionMut.isPending ? "Submitting…" : "Submit Decision"}
        </Button>
      )}
    </div>
  );
}

function PendingCard({ row }: { row: ReviewRow }) {
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [actioning, setActioning] = useState(false);

  return (
    <Card
      className={`transition-shadow ${expanded ? "shadow-md" : "hover:shadow-sm"}`}
      data-testid={`card-review-${row.id}`}
    >
      <CardContent className="pt-4 pb-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="text-[11px]" data-testid={`text-review-code-${row.id}`}>
                {row.sopCode}
              </Badge>
              <Badge variant="secondary" className="text-[11px]">
                {row.sopCategory}
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                v{row.sopVersion} · Round {row.round}
              </Badge>
            </div>
            <p className="font-semibold text-sm leading-snug">{row.sopTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Assigned by <span className="font-medium">{row.assignedByName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SlaChip status={row.slaStatus} dueAt={row.dueAt} />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => { setExpanded((v) => !v); setActioning(false); }}
              data-testid={`button-expand-review-${row.id}`}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Inline detail panel */}
        {expanded && (
          <div className="mt-3 space-y-3 text-sm" data-testid={`panel-review-detail-${row.id}`}>
            {row.sopSummary && (
              <p className="text-muted-foreground text-xs leading-relaxed">{row.sopSummary}</p>
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div><span className="text-muted-foreground">Owner:</span> <span className="font-medium">{row.sopOwner}</span></div>
              {row.sopApprover && (
                <div><span className="text-muted-foreground">Approver:</span> <span className="font-medium">{row.sopApprover}</span></div>
              )}
              <div>
                <span className="text-muted-foreground">AI Assist:</span>{" "}
                <span className="font-medium">{row.sopAiAssistAllowed ? "Allowed" : "Not allowed"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Human Sign-off:</span>{" "}
                <span className="font-medium">{row.sopHumanSignoffRequired ? "Required" : "Not required"}</span>
              </div>
            </div>

            {row.sopDocumentId && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setLocation(`/admin/sops?detail=${row.sopDocumentId}`)}
                data-testid={`button-view-full-sop-${row.id}`}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                View Full SOP
              </Button>
            )}

            {!actioning ? (
              <Button
                size="sm"
                onClick={() => setActioning(true)}
                data-testid={`button-start-review-action-${row.id}`}
              >
                Take Action
              </Button>
            ) : (
              <ReviewActionPanel row={row} onDone={() => { setActioning(false); setExpanded(false); }} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompletedRow({ row }: { row: ReviewRow }) {
  const decisionAt = row.decisionAt ? new Date(row.decisionAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const variant = DECISION_VARIANTS[row.status] ?? "outline";
  return (
    <div
      className="flex items-start gap-3 py-3 border-b last:border-0"
      data-testid={`row-completed-review-${row.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <Badge variant="outline" className="text-[11px]">{row.sopCode}</Badge>
          <span className="text-sm font-medium truncate">{row.sopTitle}</span>
          <Badge variant="outline" className="text-[10px]">v{row.sopVersion}</Badge>
        </div>
        {row.comment && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 italic">"{row.comment}"</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">{decisionAt}</p>
      </div>
      <Badge variant={variant} className="shrink-0 text-[11px] mt-0.5">
        {DECISION_LABELS[row.status] ?? row.status}
      </Badge>
    </div>
  );
}

export default function MySopReviews() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { enabled, isLoading: accessLoading } = useSopAccess();
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  const [completedPage, setCompletedPage] = useState(1);
  const PAGE_SIZE = 10;

  const REVIEWER_ROLES = ["super_admin", "admin", "hr", "operations", "manager"];
  const canReview = REVIEWER_ROLES.includes(user?.role ?? "");

  const { data: pending, isLoading: pendingLoading } = useQuery<ReviewRow[]>({
    queryKey: ["/api/sops/my-reviews", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/sops/my-reviews?status=pending", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!user && canReview,
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const { data: completed, isLoading: completedLoading } = useQuery<ReviewRow[]>({
    queryKey: ["/api/sops/my-reviews", "completed"],
    queryFn: async () => {
      const res = await fetch("/api/sops/my-reviews?status=completed", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!user && canReview && tab === "completed",
    staleTime: 60000,
  });

  if (authLoading || accessLoading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AdminLayout>
    );
  }

  const pendingList = pending ?? [];
  const completedList = completed ?? [];
  const paginatedCompleted = completedList.slice((completedPage - 1) * PAGE_SIZE, completedPage * PAGE_SIZE);
  const totalCompletedPages = Math.ceil(completedList.length / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-my-reviews-title">
            <ShieldCheck className="h-6 w-6 text-primary" />
            My SOP Reviews
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            SOPs assigned to you for review. Complete pending reviews before their deadlines.
          </p>
        </div>

        {!canReview ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Review assignments are not available for your role.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "completed")}>
            <TabsList data-testid="tabs-my-reviews">
              <TabsTrigger value="pending" data-testid="tab-pending-reviews">
                Pending
                {pendingList.length > 0 && (
                  <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 inline-flex items-center justify-center">
                    {pendingList.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed-reviews">
                Completed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              {pendingLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : pendingList.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground" data-testid="empty-pending-reviews">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="font-medium">All caught up!</p>
                    <p className="text-sm mt-1">You have no pending SOP reviews.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3" data-testid="list-pending-reviews">
                  {pendingList.map((row) => (
                    <PendingCard key={row.id} row={row} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-4">
              {completedLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : completedList.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground" data-testid="empty-completed-reviews">
                    <Inbox className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">No completed reviews yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card data-testid="list-completed-reviews">
                  <CardContent className="pt-4 pb-2">
                    {paginatedCompleted.map((row) => (
                      <CompletedRow key={row.id} row={row} />
                    ))}
                  </CardContent>
                  {totalCompletedPages > 1 && (
                    <div className="flex items-center justify-center gap-2 py-3 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCompletedPage((p) => Math.max(1, p - 1))}
                        disabled={completedPage === 1}
                        data-testid="button-completed-prev-page"
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {completedPage} of {totalCompletedPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCompletedPage((p) => Math.min(totalCompletedPages, p + 1))}
                        disabled={completedPage === totalCompletedPages}
                        data-testid="button-completed-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
}
