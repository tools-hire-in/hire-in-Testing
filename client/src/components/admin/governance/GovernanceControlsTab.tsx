import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ControlStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "overdue"
  | "escalated"
  | "closed"
  | "disputed";

type ControlType =
  | "goal"
  | "check_in"
  | "training"
  | "sop"
  | "probation"
  | "pip";

interface GovernanceControl {
  id: string;
  controlType: ControlType;
  requiredAction: string;
  dueDate: string;
  status: ControlStatus;
  evidenceRequired: boolean;
  evidenceRecord: string | null;
  exceptionReason: string | null;
  escalationLevel: number;
  resolution: string | null;
  closureDate: string | null;
  disputeNote: string | null;
  disputedAt: string | null;
  flaggedForHrReview: boolean;
  createdAt: string;
  updatedAt: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRole?: string;
  ownerDepartment?: string;
}

interface ManagerGovernanceResponse {
  controls: GovernanceControl[];
  summary: {
    total: number;
    pending: number;
    overdue: number;
    escalated: number;
    completed: number;
  };
}

const STATUS_CONFIG: Record<ControlStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-slate-100 text-slate-700 border-slate-300", icon: <Clock className="h-3 w-3" /> },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700 border-blue-300", icon: <Clock className="h-3 w-3" /> },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 border-green-300", icon: <CheckCircle2 className="h-3 w-3" /> },
  overdue: { label: "Overdue", color: "bg-amber-100 text-amber-700 border-amber-300", icon: <AlertTriangle className="h-3 w-3" /> },
  escalated: { label: "Escalated", color: "bg-red-100 text-red-700 border-red-300", icon: <AlertTriangle className="h-3 w-3" /> },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-500 border-slate-200", icon: <XCircle className="h-3 w-3" /> },
  disputed: { label: "Disputed", color: "bg-purple-100 text-purple-700 border-purple-300", icon: <MessageSquare className="h-3 w-3" /> },
};

const TYPE_LABEL: Record<ControlType, string> = {
  goal: "Goal",
  check_in: "Check-In",
  training: "Training",
  sop: "SOP",
  probation: "Probation",
  pip: "PIP",
};

function StatusBadge({ status }: { status: ControlStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface CloseDialogProps {
  control: GovernanceControl;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
}

function CloseControlDialog({ control, open, onOpenChange, employeeId }: CloseDialogProps) {
  const { toast } = useToast();
  const [resolution, setResolution] = useState("");
  const [evidenceRecord, setEvidenceRecord] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/governance/${control.id}/close`, {
        resolution,
        ...(control.evidenceRequired ? { evidenceRecord } : {}),
      }),
    onSuccess: () => {
      toast({ title: "Control closed", description: "The governance control has been closed." });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/manager", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/my"] });
      onOpenChange(false);
      setResolution("");
      setEvidenceRecord("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to close control", variant: "destructive" });
    },
  });

  const evidenceMissing = control.evidenceRequired && !evidenceRecord.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Governance Control</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">{control.requiredAction}</div>
          {control.evidenceRequired && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Evidence <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={evidenceRecord}
                onChange={e => setEvidenceRecord(e.target.value)}
                placeholder="Describe the evidence or link to the document that confirms this obligation was met..."
                rows={3}
                data-testid="input-governance-evidence"
              />
              <p className="text-xs text-muted-foreground mt-1">Evidence is required to close this control.</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Resolution note {control.evidenceRequired ? "(optional)" : "(optional)"}</label>
            <Textarea
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              placeholder="Describe how this was resolved or why it's being closed..."
              rows={3}
              data-testid="input-governance-resolution"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || evidenceMissing}
            data-testid="button-confirm-close-control"
            title={evidenceMissing ? "Evidence is required" : undefined}
          >
            {mutation.isPending ? "Closing..." : "Close Control"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EscalateDialogProps {
  control: GovernanceControl;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
}

function EscalateControlDialog({ control, open, onOpenChange, employeeId }: EscalateDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/governance/${control.id}/escalate`, { reason }),
    onSuccess: () => {
      toast({ title: "Escalated", description: "The control has been flagged for HR review." });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/manager", employeeId] });
      onOpenChange(false);
      setReason("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to escalate", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flag for HR Review</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">{control.requiredAction}</div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Reason for escalation</label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why this needs HR review..."
              rows={4}
              data-testid="input-governance-escalate-reason"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !reason.trim()}
            data-testid="button-confirm-escalate"
          >
            {mutation.isPending ? "Escalating..." : "Escalate to HR"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ControlRowProps {
  control: GovernanceControl;
  employeeId: string;
  canClose: boolean;
}

function ControlRow({ control, employeeId, canClose }: ControlRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const isActive = !["closed", "completed"].includes(control.status);
  const isOverdueOrEsc = ["overdue", "escalated"].includes(control.status);

  return (
    <div
      className={`border rounded-lg overflow-hidden ${isOverdueOrEsc ? "border-red-200 dark:border-red-800" : "border-border"}`}
      data-testid={`governance-control-row-${control.id}`}
    >
      <div
        className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors ${isOverdueOrEsc ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {TYPE_LABEL[control.controlType]}
            </span>
            <StatusBadge status={control.status} />
            {control.escalationLevel > 0 && (
              <span className="text-xs text-red-600 font-medium">L{control.escalationLevel}</span>
            )}
          </div>
          <p className="text-sm font-medium leading-snug">{control.requiredAction}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Due: <span className={isOverdueOrEsc ? "font-semibold text-red-600 dark:text-red-400" : "font-medium"}>{formatDate(control.dueDate)}</span></span>
            {control.evidenceRequired && (
              <span className={`flex items-center gap-1 ${control.evidenceRecord ? "text-green-600" : "text-amber-600"}`}>
                <FileText className="h-3 w-3" />
                {control.evidenceRecord ? "Evidence submitted" : "Evidence required"}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground mt-0.5">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/20 p-3 space-y-3">
          {control.exceptionReason && (
            <div className="text-xs">
              <span className="font-medium text-muted-foreground">Exception reason: </span>
              <span>{control.exceptionReason}</span>
            </div>
          )}
          {control.evidenceRecord && (
            <div className="text-xs">
              <span className="font-medium text-muted-foreground">Evidence: </span>
              <span>{control.evidenceRecord}</span>
            </div>
          )}
          {control.disputeNote && (
            <div className="text-xs text-purple-700 dark:text-purple-300">
              <span className="font-medium">Dispute note: </span>
              <span>{control.disputeNote}</span>
            </div>
          )}
          {control.resolution && (
            <div className="text-xs text-green-700 dark:text-green-300">
              <span className="font-medium">Resolution: </span>
              <span>{control.resolution}</span>
            </div>
          )}
          {canClose && isActive && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={e => { e.stopPropagation(); setCloseOpen(true); }}
                data-testid={`button-close-control-${control.id}`}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Closed
              </Button>
              {!control.flaggedForHrReview && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 text-amber-700 border-amber-300 hover:bg-amber-50"
                  onClick={e => { e.stopPropagation(); setEscalateOpen(true); }}
                  data-testid={`button-escalate-control-${control.id}`}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" /> Flag for HR
                </Button>
              )}
              {control.flaggedForHrReview && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Flagged for HR review
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {closeOpen && (
        <CloseControlDialog
          control={control}
          open={closeOpen}
          onOpenChange={setCloseOpen}
          employeeId={employeeId}
        />
      )}
      {escalateOpen && (
        <EscalateControlDialog
          control={control}
          open={escalateOpen}
          onOpenChange={setEscalateOpen}
          employeeId={employeeId}
        />
      )}
    </div>
  );
}

interface Props {
  employeeId: string;
  canClose?: boolean;
}

export default function GovernanceControlsTab({ employeeId, canClose = true }: Props) {
  const [filter, setFilter] = useState<"active" | "all">("active");

  const { data, isLoading, isError } = useQuery<ManagerGovernanceResponse>({
    queryKey: ["/api/governance/manager", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/governance/manager/${employeeId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load governance controls");
      return res.json();
    },
    enabled: !!employeeId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load governance controls.</AlertDescription>
      </Alert>
    );
  }

  const { controls, summary } = data;
  const displayed = filter === "active"
    ? controls.filter(c => !["closed", "completed"].includes(c.status))
    : controls;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Governance Obligations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="text-center p-2 rounded-lg bg-muted/50 border" data-testid="gc-stat-total">
              <p className="text-xl font-mono font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid="gc-stat-overdue">
              <p className="text-xl font-mono font-bold text-amber-700 dark:text-amber-400">{summary.overdue}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" data-testid="gc-stat-escalated">
              <p className="text-xl font-mono font-bold text-red-700 dark:text-red-400">{summary.escalated}</p>
              <p className="text-xs text-muted-foreground">Escalated</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" data-testid="gc-stat-completed">
              <p className="text-xl font-mono font-bold text-green-700 dark:text-green-400">{summary.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Button
              size="sm"
              variant={filter === "active" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setFilter("active")}
              data-testid="button-filter-gc-active"
            >
              Active ({summary.total - summary.completed})
            </Button>
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setFilter("all")}
              data-testid="button-filter-gc-all"
            >
              All ({summary.total})
            </Button>
          </div>

          {displayed.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
              {filter === "active" ? "No active governance controls." : "No governance controls on record."}
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map(c => (
                <ControlRow key={c.id} control={c} employeeId={employeeId} canClose={canClose} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
