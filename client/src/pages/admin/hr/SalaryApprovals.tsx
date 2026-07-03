import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatLocalDate } from "@/lib/dateUtils";
import { CheckCircle2, XCircle } from "lucide-react";

interface PendingSalaryChange {
  id: string;
  employeeId: string;
  oldSalary: string | null;
  newSalary: string | null;
  effectiveDate: string | null;
  reason: string | null;
  createdAt: string;
  employee?: { firstName: string; lastName: string; email: string } | null;
  initiator?: { firstName: string; lastName: string } | null;
}

function formatCurrency(v: string | null): string {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function SalaryApprovalsContent() {
  const { toast } = useToast();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useQuery<PendingSalaryChange[]>({
    queryKey: ["/api/hr/salary-changes/pending"],
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/hr/salary-changes/pending"] });
    queryClient.invalidateQueries({ queryKey: ["/api/hr/salary-changes/pending-count"] });
  };

  const approve = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/hr/salary-changes/${id}/approve`, {}),
    onSuccess: () => {
      invalidate();
      toast({ title: "Approved", description: "The salary change has been applied." });
    },
    onError: (err: any) => toast({ title: "Could not approve", description: err?.message || "Please try again.", variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => apiRequest("POST", `/api/hr/salary-changes/${id}/reject`, { reason }),
    onSuccess: () => {
      invalidate();
      setRejectId(null);
      setRejectReason("");
      toast({ title: "Rejected", description: "The request has been rejected." });
    },
    onError: (err: any) => toast({ title: "Could not reject", description: err?.message || "Please try again.", variant: "destructive" }),
  });

  const rows = data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Salary Changes Awaiting Approval</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-pending-salary-changes">
            No salary changes are awaiting approval.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Employee</th>
                  <th className="text-right py-2 font-medium">Current</th>
                  <th className="text-right py-2 font-medium">Proposed</th>
                  <th className="text-left py-2 font-medium">Effective</th>
                  <th className="text-left py-2 font-medium">Requested By</th>
                  <th className="text-left py-2 font-medium">Reason</th>
                  <th className="text-right py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b last:border-0" data-testid={`row-pending-salary-${r.id}`}>
                    <td className="py-2">
                      {r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : r.employeeId}
                    </td>
                    <td className="text-right py-2">{formatCurrency(r.oldSalary)}</td>
                    <td className="text-right py-2 font-medium">{formatCurrency(r.newSalary)}</td>
                    <td className="py-2">{formatLocalDate(r.effectiveDate)}</td>
                    <td className="py-2">{r.initiator ? `${r.initiator.firstName} ${r.initiator.lastName}` : "—"}</td>
                    <td className="py-2 max-w-[220px] truncate" title={r.reason || ""}>{r.reason || "—"}</td>
                    <td className="text-right py-2">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => approve.mutate(r.id)}
                          disabled={approve.isPending}
                          data-testid={`button-approve-salary-${r.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setRejectId(r.id); setRejectReason(""); }}
                          data-testid={`button-reject-salary-${r.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!rejectId} onOpenChange={(o) => { if (!o) { setRejectId(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Salary Change</DialogTitle>
            <DialogDescription>Provide a reason. The requester will be notified.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason for rejection"
            rows={3}
            data-testid="input-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectId && reject.mutate({ id: rejectId, reason: rejectReason })}
              disabled={reject.isPending || rejectReason.trim().length === 0}
              data-testid="button-confirm-reject-salary"
            >
              {reject.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
