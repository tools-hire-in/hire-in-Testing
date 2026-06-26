import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, CheckCircle, Clock, Lock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface PolicyStatus {
  accepted: boolean;
  policyVersion: string;
}

interface PolicyConfig {
  policyVersion: string;
  monthEndBlackoutDays: number;
}

export function PolicyAcknowledgementModal() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
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
    onError: (error: Error) => {
      toast({
        title: "Could not record your acceptance",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated || !user || statusLoading || dismissed) return null;
  if (policyStatus?.accepted) return null;

  const blackoutDays = policyConfig?.monthEndBlackoutDays ?? 3;

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
            Hire'in Solutions uses a strict Attendance Regularization system to ensure payroll accuracy. Read the key rules below before raising any correction request.
          </p>

          <div className="space-y-3">
            <PolicyPoint
              icon={<Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
              title="24-Hour Filing Window"
              body="You must raise a regularization request within 24 hours of the attendance date. After 24 hours, or once you have punched in on a subsequent working day, the filing window closes automatically. Act promptly — late requests are not accepted via self-service."
            />

            <PolicyPoint
              icon={<Lock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />}
              title={`Month-End Blackout (Last ${blackoutDays} Days)`}
              body={`No new regularization requests can be raised during the last ${blackoutDays} days of the month. This protects the payroll cut-off cycle. If you notice an issue during this period, contact HR directly before the blackout begins.`}
            />

            <PolicyPoint
              icon={<Shield className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />}
              title="Manager & HR Review"
              body="Your manager reviews and approves or rejects your request. HR and administrators can override or correct any attendance record at any time. You will receive a notification with the decision and any comments."
            />

            <PolicyPoint
              icon={<CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />}
              title="On Approval"
              body="When approved, your attendance record is automatically corrected. The correction feeds directly into payroll calculations for the month."
            />

            <PolicyPoint
              icon={<AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />}
              title="Monthly Resolution Deadline"
              body="All pending correction requests must be resolved (approved or rejected) by the 25th of each month so that payroll can be processed on time. Requests still open after the 25th may be bypassed during salary run generation."
            />

            <PolicyPoint
              icon={<AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />}
              title="Payroll Lock"
              body="Once the attendance report for a month is approved by HR, the month is locked and no further self-service requests can be raised for that period. Contact HR directly for any post-lock corrections."
            />

            <PolicyPoint
              icon={<CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />}
              title="Mandatory Reason (minimum 20 characters)"
              body="Every correction request requires a clear, specific reason of at least 20 characters. Vague reasons such as 'forgot to punch' are not accepted. Describe what happened and why the attendance was incorrect."
            />
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
            By clicking "I Understand & Accept" you confirm that you have read, understood, and agree to follow this policy. All regularization requests are subject to review and are permanently logged for audit purposes.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Policy v{policyConfig?.policyVersion ?? "2"}</span>
            <a
              href="/admin/settings/leave-attendance?tab=attendance-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
              data-testid="link-view-full-policy"
            >
              View full policy
            </a>
          </div>
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

function PolicyPoint({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-2.5">
      {icon}
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
