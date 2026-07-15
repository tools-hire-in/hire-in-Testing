import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, ExternalLink, Loader2, PartyPopper } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

type Step = "question" | "success" | "deferred";

export default function CeipalComplianceModal({ open, onClose }: CeipalComplianceModalProps) {
  const [step, setStep] = useState<Step>("question");
  const [deferredReason, setDeferredReason] = useState("");

  const { data: todayStatus } = useQuery<TodayStatus>({
    queryKey: ["/api/ceipal/today-status"],
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setStep("question");
      setDeferredReason("");
    }
  }, [open]);

  const logMutation = useMutation({
    mutationFn: (body: { status: string; deferredReason?: string }) =>
      apiRequest("POST", "/api/ceipal/update-log", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ceipal/today-status"] });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/ceipal/verify-today-update"),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ceipal/today-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ceipal/my-update-log"] });
    },
  });

  function handleYes() {
    logMutation.mutate({ status: "confirmed_unverified" });
    verifyMutation.mutate();
    setStep("success");
    setTimeout(() => onClose(), 1800);
  }

  async function handleDeferred() {
    if (!deferredReason.trim() || !deferredReason.trim().includes(" ") && deferredReason.trim().split(/\s+/).length < 1) return;
    if (!deferredReason.trim()) return;
    await logMutation.mutateAsync({ status: "deferred", deferredReason: deferredReason.trim() });
    onClose();
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      return;
    }
  }

  const isWorking = logMutation.isPending;
  const canSubmitDeferred = deferredReason.trim().split(/\s+/).filter(Boolean).length >= 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        data-testid="ceipal-compliance-modal"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <img src="/favicon.ico" alt="" className="w-4 h-4 opacity-70" />
            Quick Ceipal Check-in
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {step === "question" && "Before you head out — did you update Ceipal today?"}
            {step === "success" && "Your response has been recorded."}
            {step === "deferred" && "No worries — please leave a reason before you go."}
          </DialogDescription>
        </DialogHeader>

        {step === "question" && (
          <div className="space-y-4 pt-1">
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
                No, I haven't updated yet
              </Button>
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

        {step === "success" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center" data-testid="ceipal-success-screen">
            <PartyPopper className="h-10 w-10 text-green-500" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Great work! Your update has been logged.</p>
              <p className="text-sm text-muted-foreground">Keep it up! 🎉 This window will close automatically.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={onClose}
              data-testid="ceipal-btn-done"
            >
              Done
            </Button>
          </div>
        )}

        {step === "deferred" && (
          <div className="space-y-4 pt-1">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
              Please go update Ceipal first, then come back and confirm. If you truly cannot update today, leave a reason below and submit.
            </div>
            <div>
              <Label htmlFor="defer-reason" className="text-xs font-medium">
                Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="defer-reason"
                placeholder="e.g. Waiting on candidate feedback, will update after client call…"
                value={deferredReason}
                onChange={(e) => setDeferredReason(e.target.value)}
                className="mt-1 text-sm h-20 resize-none"
                data-testid="ceipal-input-reason"
              />
              {!canSubmitDeferred && deferredReason.length > 0 && (
                <p className="mt-1 text-xs text-red-500">Please enter a reason before submitting.</p>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStep("question")} disabled={isWorking}>
                Go back &amp; update Ceipal
              </Button>
              <Button
                size="sm"
                onClick={handleDeferred}
                disabled={isWorking || !canSubmitDeferred}
                data-testid="ceipal-btn-confirm-defer"
              >
                {logMutation.isPending ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving…</>
                ) : (
                  "Submit & Close"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Ceipal discipline card (shown on Command Center for eligible roles) ─────────

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
