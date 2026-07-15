import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, SkipForward, ExternalLink, AlertCircle, Loader2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CeipalComplianceModalProps {
  open: boolean;
  onClose: () => void;
}

interface TodayStatus {
  hasAnsweredToday: boolean;
  status: string | null;
  promptEnabled: boolean;
  consecutiveSkips: number;
}

type Step = "question" | "deferred" | "done";

const SKIP_LOCK_THRESHOLD = 3;

export default function CeipalComplianceModal({ open, onClose }: CeipalComplianceModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("question");
  const [deferredReason, setDeferredReason] = useState("");
  const [commitmentTime, setCommitmentTime] = useState("");
  const [doneMessage, setDoneMessage] = useState<{ title: string; body: string; variant: "green" | "blue" | "amber" }>({
    title: "", body: "", variant: "green",
  });

  const { data: todayStatus } = useQuery<TodayStatus>({
    queryKey: ["/api/ceipal/today-status"],
    enabled: open,
  });

  // Skip lock: after 3+ consecutive skips, recruiter must answer (cannot dismiss)
  const skipLocked = (todayStatus?.consecutiveSkips ?? 0) >= SKIP_LOCK_THRESHOLD;

  // Reset step when modal opens
  useEffect(() => {
    if (open) {
      setStep("question");
      setDeferredReason("");
      setCommitmentTime("");
    }
  }, [open]);

  // Record log (non-verifying path: deferred/skipped)
  const logMutation = useMutation({
    mutationFn: (body: { status: string; deferredReason?: string; commitmentTime?: string }) =>
      apiRequest("POST", "/api/ceipal/update-log", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ceipal/today-status"] });
    },
  });

  // Background verification — fire-and-forget; does NOT block modal
  const verifyMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/ceipal/verify-today-update"),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ceipal/today-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ceipal/my-update-log"] });
    },
  });

  function handleYes() {
    // 1. Close the modal immediately — don't block the recruiter
    setDoneMessage({
      title: "Got it — verifying your Ceipal activity in the background",
      body: "We'll check your submissions and job updates. Your confirmation is already saved.",
      variant: "green",
    });
    // 2. Log a provisional "confirmed_unverified" so the day is marked answered
    logMutation.mutate({ status: "confirmed_unverified" });
    // 3. Run verification in background (result overwrites the log via route)
    verifyMutation.mutate();
    // 4. Close modal right away (don't wait for verify)
    onClose();
  }

  async function handleDeferred() {
    if (!deferredReason.trim()) {
      toast({ title: "Please tell us why", description: "Add a brief note about what's holding it up.", variant: "destructive" });
      return;
    }
    const timeStr = commitmentTime
      ? new Date(`${new Date().toISOString().split("T")[0]}T${commitmentTime}:00`).toISOString()
      : undefined;
    await logMutation.mutateAsync({ status: "deferred", deferredReason: deferredReason.trim(), commitmentTime: timeStr });
    onClose();
  }

  async function handleSkip() {
    if (skipLocked) return; // guard — button is already hidden
    await logMutation.mutateAsync({ status: "skipped" });
    onClose();
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      if (skipLocked) {
        // Skip-locked: cannot dismiss without answering
        toast({
          title: "Please answer before closing",
          description: "You've skipped 3 or more days in a row. Please choose 'Yes' or 'Not yet' before closing.",
          variant: "destructive",
        });
        return;
      }
      // Normal dismiss at question step → treated as skipped
      if (step === "question") {
        logMutation.mutate({ status: "skipped" });
      }
      onClose();
    }
  }

  const isWorking = logMutation.isPending;

  // Default "+2 hours from now" commitment time suggestion
  const suggestedTime = (() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  })();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        data-testid="ceipal-compliance-modal"
        // Prevent backdrop close when skip-locked
        onInteractOutside={skipLocked ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={skipLocked ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <img src="/favicon.ico" alt="" className="w-4 h-4 opacity-70" />
            Quick Ceipal Check-in
            {skipLocked && (
              <Badge variant="destructive" className="text-xs ml-auto flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" />
                Response required
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {skipLocked
              ? "You've skipped the last 3+ days. Please answer before closing."
              : "Before you head out — did you update Ceipal today?"}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step: main question ── */}
        {step === "question" && (
          <div className="space-y-4 pt-1">
            {skipLocked && (
              <div className="flex items-start gap-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm">
                <Lock className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-red-800 dark:text-red-300">
                  You've skipped this check-in {todayStatus?.consecutiveSkips ?? 3}+ days in a row.
                  Please answer to continue — this ensures your work is captured in Ceipal.
                </p>
              </div>
            )}
            <p className="text-sm text-foreground leading-relaxed">
              Did you add any submissions, update candidate profiles, or work on job records in Ceipal today?
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="default"
                className="w-full justify-start gap-2 h-11"
                onClick={handleYes}
                disabled={isWorking}
                data-testid="ceipal-btn-yes"
              >
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                Yes, I updated Ceipal today
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-11"
                onClick={() => setStep("deferred")}
                disabled={isWorking}
                data-testid="ceipal-btn-not-yet"
              >
                <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                Not yet — I'll do it soon
              </Button>
              {!skipLocked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground text-xs justify-center"
                  onClick={handleSkip}
                  disabled={isWorking}
                  data-testid="ceipal-btn-skip"
                >
                  <SkipForward className="h-3 w-3 mr-1" />
                  Skip for today
                </Button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <a
                href="https://app.ceipal.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Open Ceipal in a new tab
              </a>
            </div>
          </div>
        )}

        {/* ── Step: deferred (commitment) ── */}
        {step === "deferred" && (
          <div className="space-y-4 pt-1">
            <p className="text-sm text-foreground">
              No problem — what's holding it up? We'll remind you first thing in the morning.
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="defer-reason" className="text-xs font-medium">Reason <span className="text-red-500">*</span></Label>
                <Textarea
                  id="defer-reason"
                  placeholder="e.g. Waiting on candidate feedback, updating after client call…"
                  value={deferredReason}
                  onChange={e => setDeferredReason(e.target.value)}
                  className="mt-1 text-sm h-20 resize-none"
                  data-testid="ceipal-input-reason"
                />
              </div>
              <div>
                <Label htmlFor="defer-time" className="text-xs font-medium">
                  I'll do it by (optional — default: +2 hours)
                </Label>
                <Input
                  id="defer-time"
                  type="time"
                  value={commitmentTime || suggestedTime}
                  onChange={e => setCommitmentTime(e.target.value)}
                  className="mt-1 text-sm"
                  data-testid="ceipal-input-commitment-time"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStep("question")} disabled={isWorking}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleDeferred}
                disabled={isWorking || !deferredReason.trim()}
                data-testid="ceipal-btn-confirm-defer"
              >
                {logMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving…</> : "Save & Close"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Recruiter discipline card (shown on Command Center for recruiters) ─────────

interface CeipalComplianceCardProps {
  className?: string;
}

interface MonthlyLogSummary {
  logs: Array<{ date: string; status: string }>;
  summary: { workingDays: number; confirmedDays: number; missedDays: number; rate: number; month: string };
}

const STATUS_COLOR: Record<string, string> = {
  confirmed: "bg-green-500",
  confirmed_unverified: "bg-blue-400",
  confirmed_no_evidence: "bg-amber-400",
  deferred: "bg-amber-500",
  skipped: "bg-gray-400",
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Updated",
  confirmed_unverified: "Logged",
  confirmed_no_evidence: "Noted",
  deferred: "Pending",
  skipped: "Skipped",
};

export function CeipalComplianceCard({ className }: CeipalComplianceCardProps) {
  const { data, isLoading } = useQuery<MonthlyLogSummary>({
    queryKey: ["/api/ceipal/my-update-log"],
  });

  if (isLoading) return null;
  if (!data || data.summary.workingDays === 0) return null;

  const { summary, logs } = data;
  const rateColor = summary.rate >= 80 ? "text-green-600 dark:text-green-400"
    : summary.rate >= 60 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";

  return (
    <div className={`rounded-lg border bg-card p-3 space-y-2 ${className ?? ""}`} data-testid="ceipal-compliance-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ceipal Update Rate</span>
        <Badge variant="outline" className={`text-xs font-semibold ${rateColor}`}>
          {summary.rate}%
        </Badge>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {logs.slice(0, 14).reverse().map((log) => (
          <div
            key={log.date}
            className={`h-2.5 w-2.5 rounded-full ${STATUS_COLOR[log.status] ?? "bg-gray-300"}`}
            title={`${log.date}: ${STATUS_LABEL[log.status] ?? log.status}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {summary.confirmedDays} of {summary.workingDays} days updated this month
      </p>
    </div>
  );
}
