import { CheckCircle2, Circle, ArrowRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { studioPath } from "@/lib/studioBase";
import type { StudioArticle } from "@shared/schema";

interface WorkflowStep {
  key: string;
  label: string;
  actor: string;
  statuses: string[];
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { key: "draft", label: "Draft", actor: "Content Editor", statuses: ["draft", "needs_revision", "idea"] },
  { key: "in_review", label: "In Review", actor: "Reviewer", statuses: ["in_review"] },
  { key: "cm_review", label: "CM Review", actor: "Content Manager", statuses: ["pending_cm_review"] },
  { key: "author_signoff", label: "Author Sign-Off", actor: "Author", statuses: ["pending_author", "author_approved"] },
  { key: "approved", label: "Approved", actor: "Content Manager", statuses: ["approved"] },
  { key: "scheduled", label: "Scheduled", actor: "", statuses: ["scheduled"] },
  { key: "published", label: "Published", actor: "", statuses: ["published"] },
];

function getStepIndex(status: string): number {
  for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
    if (WORKFLOW_STEPS[i].statuses.includes(status)) return i;
  }
  return 0;
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch { return ""; }
}

const NEXT_STEP_LABELS: Record<string, string> = {
  draft: "Waiting for editor to submit for review",
  needs_revision: "Waiting for editor to revise and resubmit",
  idea: "Waiting for editor to develop into a draft",
  in_review: "Waiting for reviewer",
  pending_cm_review: "Waiting for Content Manager review",
  pending_author: "Waiting for Author Sign-Off",
  author_approved: "Author approved — awaiting CM to advance",
  approved: "Approved — ready to schedule or publish",
  scheduled: "Scheduled for publication",
  published: "Published",
};

export interface StageHistoryEntry {
  actorName: string | null;
  timestamp: string;
}

interface Props {
  article: StudioArticle;
  currentUserId?: string;
  currentUserRole?: string;
  canEdit: boolean;
  canReview: boolean;
  linkedAuthorUserId?: string | null;
  statusHistory?: Record<string, StageHistoryEntry>;
  onTransition?: (to: string) => void;
  transitionPending?: boolean;
}

export function ArticleWorkflowStepper({
  article,
  currentUserId,
  currentUserRole,
  canEdit,
  canReview,
  linkedAuthorUserId,
  statusHistory = {},
  onTransition,
  transitionPending,
}: Props) {
  const [, navigate] = useLocation();
  const status = article.status ?? "draft";
  const currentStepIdx = getStepIndex(status);

  const isSuperAdmin = currentUserRole === "super_admin";
  const isAdmin = currentUserRole === "admin";
  const isHr = currentUserRole === "hr";
  const isCm = currentUserRole === "content_manager";
  const canSchedule = isSuperAdmin || isAdmin || isHr || isCm;
  const isLinkedAuthor =
    !!(linkedAuthorUserId && currentUserId && linkedAuthorUserId === currentUserId);

  const cta = (() => {
    if (status === "draft" && canEdit) {
      return {
        label: "Submit for Review",
        action: () => onTransition?.("in_review"),
        isTransition: true,
      };
    }
    if (status === "in_review" && canReview) {
      return {
        label: "Submit to CM Review",
        action: () => onTransition?.("pending_cm_review"),
        isTransition: true,
      };
    }
    if (status === "pending_cm_review") {
      return null;
    }
    if (status === "pending_author" && isLinkedAuthor) {
      return {
        label: "Sign Off Now →",
        action: () => navigate(studioPath(`/articles/${article.id}/author-signoff`)),
        isTransition: false,
      };
    }
    if (status === "approved" && canSchedule) {
      return {
        label: "Schedule / Publish →",
        action: () => {},
        isTransition: false,
        hint: "Use the Publish tab →",
      };
    }
    return null;
  })();

  const calloutColorClass =
    status === "published"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300"
      : status === "approved" || status === "scheduled"
      ? "bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-950/20 dark:border-teal-800 dark:text-teal-300"
      : "bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950/20 dark:border-sky-800 dark:text-sky-300";

  return (
    <div className="space-y-2" data-testid="div-workflow-stepper">
      <div className="flex flex-wrap items-center gap-1" data-testid="div-stepper-steps">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isComplete = idx < currentStepIdx;
          const isCurrent = idx === currentStepIdx;
          const isFuture = idx > currentStepIdx;
          const hist = statusHistory[step.key];
          return (
            <span key={step.key} className="flex items-center gap-1">
              <span
                className={`inline-flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 transition-colors ${
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`step-${step.key}`}
              >
                <span className="inline-flex items-center gap-1 text-xs font-medium leading-none">
                  {isComplete ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                  ) : (
                    <Circle className="h-3 w-3 shrink-0" />
                  )}
                  {step.label}
                </span>
                {/* Completed: show who actioned it and when */}
                {isComplete && hist ? (
                  <span className="text-[9px] font-normal leading-none opacity-70 text-center">
                    {hist.actorName ?? step.actor}
                    {" · "}
                    {formatRelative(hist.timestamp)}
                  </span>
                ) : step.actor ? (
                  <span className="text-[9px] font-normal leading-none opacity-70">
                    {step.actor}
                  </span>
                ) : null}
              </span>
              {idx < WORKFLOW_STEPS.length - 1 && (
                <ArrowRight
                  className={`h-3 w-3 shrink-0 ${
                    isFuture ? "text-muted-foreground/30" : "text-muted-foreground/60"
                  }`}
                />
              )}
            </span>
          );
        })}
      </div>

      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${calloutColorClass}`}
        data-testid="div-stepper-callout"
      >
        <span className="font-medium">
          {NEXT_STEP_LABELS[status] ?? `Status: ${status}`}
          {WORKFLOW_STEPS[currentStepIdx]?.actor && status !== "published" && (
            <span className="ml-1 font-normal opacity-75">
              — {WORKFLOW_STEPS[currentStepIdx].actor}
            </span>
          )}
        </span>
        {cta && (cta as any).hint ? (
          <span className="text-xs opacity-75">{(cta as any).hint}</span>
        ) : cta ? (
          <Button
            size="sm"
            variant="outline"
            onClick={cta.action}
            disabled={cta.isTransition && transitionPending}
            className="h-7 border-current/30 bg-white/60 text-xs hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/30"
            data-testid="button-stepper-cta"
          >
            {cta.isTransition && transitionPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            {cta.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
