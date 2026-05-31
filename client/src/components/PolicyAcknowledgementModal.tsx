import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface PolicyStatus {
  accepted: boolean;
  policyVersion: string;
}

interface PolicyConfig {
  employeeWindowDays: number;
  managerCutoffDay: number;
  policyVersion: string;
}

export function PolicyAcknowledgementModal() {
  const { isAuthenticated, user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const { data: policyStatus, isLoading: statusLoading } = useQuery<PolicyStatus>({
    queryKey: ["/api/hr/policy-acknowledgements/status"],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  const { data: policyConfig } = useQuery<PolicyConfig>({
    queryKey: ["/api/hr/attendance/regularization/policy"],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/policy-acknowledgements"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/policy-acknowledgements/status"] });
      setDismissed(true);
    },
  });

  if (!isAuthenticated || !user || statusLoading || dismissed) return null;
  if (policyStatus?.accepted) return null;

  const windowDays = policyConfig?.employeeWindowDays ?? 7;
  const cutoffDay = policyConfig?.managerCutoffDay ?? 20;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
      data-testid="modal-policy-acknowledgement"
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        <div className="bg-primary/10 border-b border-border px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 id="policy-modal-title" className="text-base font-bold text-foreground">
              Attendance Regularization Policy
            </h2>
            <p className="text-xs text-muted-foreground">Please read and accept before continuing</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-foreground font-medium">
            Hire'in Solutions has introduced a dedicated Attendance Regularization system to help you report and correct attendance issues quickly and transparently.
          </p>

          <div className="space-y-3">
            <PolicyPoint
              title="What is an Attendance Regularization Request?"
              body="If your attendance was incorrectly recorded — a missed punch-in or punch-out, a wrong absence mark, or any other discrepancy — you can raise a Regularization Request directly from your Attendance tab instead of using a generic Ticket."
            />

            <PolicyPoint
              title={`${windowDays}-Working-Day Window`}
              body={`You may only raise a regularization request within ${windowDays} working days (weekends and public holidays excluded) of the attendance date. Requests outside this window will not be accepted, so please act promptly when you notice an issue.`}
            />

            <PolicyPoint
              title="Manager Review & Cutoff"
              body={`Your manager can approve or reject your request for dates within the current month on or before the ${cutoffDay}${getOrdinalSuffix(cutoffDay)} of the month. Requests beyond this cutoff are automatically escalated to HR for review.`}
            />

            <PolicyPoint
              title="HR Authority"
              body="HR and administrators can approve, reject, or directly correct any attendance record at any time with no date restriction."
            />

            <PolicyPoint
              title="On Approval"
              body="When your request is approved, your attendance record will be automatically updated. You will receive an in-app notification with the decision and any comments from the reviewer."
            />

            <PolicyPoint
              title="What happens if you miss the window?"
              body={`After ${windowDays} working days, the system will not accept a regularization request for that date. You will need to contact HR directly for any corrections beyond the window.`}
            />
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
            By clicking "I Understand & Accept" you confirm that you have read, understood, and agree to follow this policy. All regularization requests are subject to review and are logged for audit purposes.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Policy v{policyConfig?.policyVersion ?? "1"}</span>
          <Button
            className="gap-2"
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            data-testid="button-accept-policy"
          >
            <CheckCircle className="h-4 w-4" />
            {acceptMutation.isPending ? "Recording..." : "I Understand & Accept"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PolicyPoint({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
