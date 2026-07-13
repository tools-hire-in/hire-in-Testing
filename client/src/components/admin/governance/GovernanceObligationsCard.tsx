import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ControlStatus = "pending" | "in_progress" | "completed" | "overdue" | "escalated" | "closed" | "disputed";
type ControlType = "goal" | "check_in" | "training" | "sop" | "probation" | "pip";

interface GovernanceControl {
  id: string;
  controlType: ControlType;
  requiredAction: string;
  dueDate: string;
  status: ControlStatus;
  evidenceRequired: boolean;
  evidenceRecord: string | null;
  resolution: string | null;
  disputeNote: string | null;
  escalationLevel: number;
  flaggedForHrReview: boolean;
}

interface EmployeeGovernanceResponse {
  controls: GovernanceControl[];
  summary: { total: number; pending: number; overdue: number; escalated: number; completed: number };
}

const STATUS_ICON: Record<ControlStatus, JSX.Element> = {
  pending: <Clock className="h-3 w-3" />,
  in_progress: <Clock className="h-3 w-3 text-blue-500" />,
  completed: <CheckCircle2 className="h-3 w-3 text-green-500" />,
  overdue: <AlertTriangle className="h-3 w-3 text-amber-500" />,
  escalated: <AlertTriangle className="h-3 w-3 text-red-500" />,
  closed: <XCircle className="h-3 w-3 text-slate-400" />,
  disputed: <MessageSquare className="h-3 w-3 text-purple-500" />,
};

const TYPE_LABEL: Record<ControlType, string> = {
  goal: "Goal", check_in: "Check-In", training: "Training",
  sop: "SOP", probation: "Probation", pip: "PIP",
};

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

interface EvidenceDialogProps {
  control: GovernanceControl;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function EvidenceDialog({ control, open, onOpenChange }: EvidenceDialogProps) {
  const { toast } = useToast();
  const [text, setText] = useState(control.evidenceRecord ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/governance/${control.id}/evidence`, { evidenceRecord: text }),
    onSuccess: () => {
      toast({ title: "Evidence submitted" });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/my"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to submit evidence", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Evidence</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">{control.requiredAction}</p>
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Describe what you completed or attach reference details..."
            rows={5}
            data-testid="input-governance-evidence"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !text.trim()}
            data-testid="button-submit-evidence"
          >
            {mutation.isPending ? "Submitting..." : "Submit Evidence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DisputeDialogProps {
  control: GovernanceControl;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function DisputeDialog({ control, open, onOpenChange }: DisputeDialogProps) {
  const { toast } = useToast();
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/governance/${control.id}/dispute`, { disputeNote: note }),
    onSuccess: () => {
      toast({ title: "Dispute raised", description: "HR will review your dispute." });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/my"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to raise dispute", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise a Dispute</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">{control.requiredAction}</p>
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Explain why you disagree with this obligation or status..."
            rows={4}
            data-testid="input-governance-dispute"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !note.trim()}
            data-testid="button-confirm-dispute"
          >
            {mutation.isPending ? "Raising..." : "Raise Dispute"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GovernanceObligationsCard() {
  const [evidenceControl, setEvidenceControl] = useState<GovernanceControl | null>(null);
  const [disputeControl, setDisputeControl] = useState<GovernanceControl | null>(null);

  const { data, isLoading } = useQuery<EmployeeGovernanceResponse>({
    queryKey: ["/api/governance/my"],
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const controls = data?.controls ?? [];
  const summary = data?.summary;
  const active = controls.filter(c => !["closed", "completed"].includes(c.status));

  if (active.length === 0) return null;

  const hasUrgent = active.some(c => ["overdue", "escalated"].includes(c.status));

  return (
    <>
      <Card
        className={hasUrgent ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" : "border-border"}
        data-testid="card-governance-obligations"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${hasUrgent ? "text-amber-600" : "text-primary"}`} />
            My Governance Obligations
            {hasUrgent && (
              <Badge variant="destructive" className="ml-auto text-xs h-5">
                Action required
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {active.slice(0, 5).map(control => {
            const isOverdue = ["overdue", "escalated"].includes(control.status);
            return (
              <div
                key={control.id}
                className={`flex items-start gap-2 p-2 rounded-lg border text-sm ${isOverdue ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-background border-border"}`}
                data-testid={`governance-obligation-${control.id}`}
              >
                <span className="mt-0.5 shrink-0">{STATUS_ICON[control.status]}</span>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {TYPE_LABEL[control.controlType]}
                    </span>
                    <span className={`text-xs ${isOverdue ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                      Due {formatDate(control.dueDate)}
                    </span>
                  </div>
                  <p className="text-sm leading-snug font-medium line-clamp-2">{control.requiredAction}</p>
                  {control.evidenceRequired && !control.evidenceRecord && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <FileText className="h-3 w-3" />
                      Evidence required
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col gap-1 items-end">
                  {control.evidenceRequired && !control.evidenceRecord && !["closed", "completed", "disputed"].includes(control.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2"
                      onClick={() => setEvidenceControl(control)}
                      data-testid={`button-submit-evidence-${control.id}`}
                    >
                      Submit
                    </Button>
                  )}
                  {!["closed", "completed", "disputed"].includes(control.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs px-2 text-muted-foreground"
                      onClick={() => setDisputeControl(control)}
                      data-testid={`button-dispute-${control.id}`}
                    >
                      Dispute
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {active.length > 5 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{active.length - 5} more obligations
            </p>
          )}
        </CardContent>
      </Card>

      {evidenceControl && (
        <EvidenceDialog
          control={evidenceControl}
          open={!!evidenceControl}
          onOpenChange={open => !open && setEvidenceControl(null)}
        />
      )}
      {disputeControl && (
        <DisputeDialog
          control={disputeControl}
          open={!!disputeControl}
          onOpenChange={open => !open && setDisputeControl(null)}
        />
      )}
    </>
  );
}
