import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Inbox, CheckCircle2, XCircle, Loader2, Clock, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

interface HirdRequest {
  id: string;
  requestNumber: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  neededByDate?: string;
  templateData?: Record<string, string>;
  requester?: { id: string; firstName: string; lastName: string; role: string };
  manager?: { id: string; firstName: string; lastName: string; role: string };
}

const TYPE_LABELS: Record<string, string> = { access: "Access & IT", hr: "HR", ops: "Operations", general: "General" };
const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  p1: { label: "Critical", color: "bg-red-100 text-red-700 border-red-200" },
  p2: { label: "High", color: "bg-orange-100 text-orange-700 border-orange-200" },
  p3: { label: "Medium", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  p4: { label: "Low", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

function ApprovalDialog({
  request,
  action,
  onClose,
}: {
  request: HirdRequest | null;
  action: "approve" | "reject" | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: (data: { id: string; action: string; reason?: string }) =>
      apiRequest("POST", `/api/help-desk/requests/${data.id}/${data.action}`, { reason: data.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests/stats"] });
      toast({
        title: action === "approve" ? "Request approved" : "Request rejected",
        description: action === "approve" ? "The request has been sent to the resolution queue." : "The requester has been notified.",
      });
      onClose();
      setReason("");
    },
    onError: () => toast({ title: "Action failed", description: "Please try again.", variant: "destructive" }),
  });

  if (!request || !action) return null;

  return (
    <Dialog open={!!request && !!action} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === "approve" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
            {action === "approve" ? "Approve Request" : "Reject Request"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            <p className="font-medium">{request.requestNumber}</p>
            <p className="text-muted-foreground mt-0.5">{request.title}</p>
            {request.requester && (
              <p className="text-xs text-muted-foreground mt-1">from {request.requester.firstName} {request.requester.lastName}</p>
            )}
          </div>
          <div>
            <Label htmlFor="approval-reason">{action === "reject" ? "Reason (required)" : "Note (optional)"}</Label>
            <Textarea
              id="approval-reason"
              data-testid="input-approval-reason"
              className="mt-1 resize-none"
              placeholder={action === "reject" ? "Please provide a reason for rejection..." : "Optional note for the requester..."}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button
            variant={action === "approve" ? "default" : "destructive"}
            onClick={() => {
              if (action === "reject" && !reason.trim()) {
                toast({ title: "Reason required", description: "Please provide a reason for rejection.", variant: "destructive" });
                return;
              }
              mutate({ id: request.id, action, reason: reason.trim() || undefined });
            }}
            disabled={isPending}
            data-testid={`button-confirm-${action}`}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {action === "approve" ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TicketApprovalsTab() {
  const { user } = useAuth();
  const [actionRequest, setActionRequest] = useState<HirdRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  const { data: requests = [], isLoading } = useQuery<HirdRequest[]>({
    queryKey: ["/api/help-desk/requests"],
  });

  // Only show pending tickets where this user IS the designated manager (not their own requests)
  const pending = requests.filter((r) => r.status === "pending_approval" && r.manager?.id === user?.id);
  // Recent decisions: tickets where this user was the approver and are no longer pending
  const other = requests.filter((r) =>
    r.status !== "pending_approval" && r.manager?.id === user?.id && r.requester?.id !== user?.id
  );

  const openAction = (req: HirdRequest, type: "approve" | "reject") => {
    setActionRequest(req);
    setActionType(type);
  };

  const closeAction = () => {
    setActionRequest(null);
    setActionType(null);
  };

  const RequestRow = ({ r, showActions }: { r: HirdRequest; showActions: boolean }) => {
    const prio = PRIORITY_LABELS[r.priority] || PRIORITY_LABELS.p3;
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg border bg-card" data-testid={`approval-row-${r.id}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{r.requestNumber}</span>
            <Badge variant="outline" className="text-xs">{TYPE_LABELS[r.type] || r.type}</Badge>
            <Badge variant="outline" className={`text-xs ${prio.color}`}>{prio.label}</Badge>
            {!showActions && (
              <Badge variant="outline" className={`text-xs ${r.status === "rejected" ? "bg-red-100 text-red-700 border-red-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                {r.status === "rejected" ? "Rejected" : "Approved"}
              </Badge>
            )}
          </div>
          <p className="font-medium text-sm mt-1">{r.title}</p>
          {r.requester && (
            <p className="text-xs text-muted-foreground mt-0.5">
              from {r.requester.firstName} {r.requester.lastName} · {r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy") : ""}
            </p>
          )}
          {r.neededByDate && (
            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />Needed by {format(new Date(r.neededByDate), "dd MMM yyyy")}
            </p>
          )}
          {r.templateData && Object.keys(r.templateData).length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground space-y-0.5 bg-muted/40 rounded p-2">
              {Object.entries(r.templateData).map(([k, v]) => v ? (
                <div key={k}><span className="capitalize font-medium">{k.replace(/([A-Z])/g, " $1").trim()}:</span> {v}</div>
              ) : null)}
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{r.description}</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {showActions ? (
            <>
              <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => openAction(r, "approve")} data-testid={`button-approve-${r.id}`}>
                <CheckCircle2 className="h-3 w-3 mr-1" />Approve
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={() => openAction(r, "reject")} data-testid={`button-reject-${r.id}`}>
                <XCircle className="h-3 w-3 mr-1" />Reject
              </Button>
            </>
          ) : (
            <Link href={`/admin/help-desk/${r.id}`}>
              <Button size="sm" variant="ghost" className="h-8 text-xs">
                <ChevronRight className="h-3 w-3" />View
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5" data-testid="ticket-approvals-tab">
      <div>
        <h2 className="text-lg font-semibold">Request Approvals</h2>
        <p className="text-sm text-muted-foreground">Review and approve your team's internal requests</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />Loading…
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Approval
              {pending.length > 0 && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{pending.length}</Badge>}
            </h3>
            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border rounded-lg text-muted-foreground bg-muted/10">
                <Inbox className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No pending approvals</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map(r => <RequestRow key={r.id} r={r} showActions={true} />)}
              </div>
            )}
          </div>

          {other.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Recent Decisions</h3>
              <div className="space-y-2">
                {other.slice(0, 10).map(r => <RequestRow key={r.id} r={r} showActions={false} />)}
              </div>
            </div>
          )}
        </>
      )}

      <ApprovalDialog request={actionRequest} action={actionType} onClose={closeAction} />
    </div>
  );
}
