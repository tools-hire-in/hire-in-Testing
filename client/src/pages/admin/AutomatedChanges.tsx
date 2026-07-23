import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShieldCheck, Loader2, CheckCircle2, XCircle, CalendarDays, Info } from "lucide-react";
import { formatLocalDate } from "@/lib/dateUtils";

interface PendingChangeItem {
  id: string;
  sourceJob: string;
  runDate: string;
  targetUserId: string | null;
  targetTable: string;
  changeType: string;
  field: string | null;
  currentValue: string | null;
  proposedValue: string | null;
  reason: string | null;
  status: string;
  employeeName: string;
  employeeEmail: string | null;
}

interface DayGroup {
  runDate: string;
  count: number;
  items: PendingChangeItem[];
}

interface PendingChangesResponse {
  total: number;
  groups: DayGroup[];
}

const SOURCE_LABELS: Record<string, string> = {
  absent_sweep: "End-of-day absent sweep",
};

function formatDate(dateStr: string) {
  const result = formatLocalDate(dateStr, "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return result === "—" ? dateStr : result;
}

export default function AutomatedChanges({ embedded = false }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { enabled: newLook } = useNewLook();
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<PendingChangesResponse>({
    queryKey: ["/api/admin/pending-changes", { status: statusFilter }],
  });

  const groups = data?.groups ?? [];
  const total = data?.total ?? 0;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-changes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-changes/count"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/pending-changes/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Approved", description: "The change has been applied and logged." });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Could not approve", description: err.message, variant: "destructive" });
      invalidate();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/pending-changes/${id}/reject`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rejected", description: "The proposal was discarded." });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Could not reject", description: err.message, variant: "destructive" });
      invalidate();
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/admin/pending-changes/bulk-approve", { ids });
      return res.json();
    },
    onSuccess: (result: { approved: number; failed: number }) => {
      toast({
        title: "Bulk approve complete",
        description: `${result.approved} applied${result.failed ? `, ${result.failed} failed` : ""}.`,
      });
      setSelected(new Set());
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Bulk approve failed", description: err.message, variant: "destructive" });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/admin/pending-changes/bulk-reject", { ids });
      return res.json();
    },
    onSuccess: (result: { rejected: number; failed: number }) => {
      toast({
        title: "Bulk reject complete",
        description: `${result.rejected} discarded${result.failed ? `, ${result.failed} failed` : ""}.`,
      });
      setSelected(new Set());
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Bulk reject failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectGroup = (group: DayGroup, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of group.items) {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  };

  const anyMutating =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    bulkApproveMutation.isPending ||
    bulkRejectMutation.isPending;

  const isReadOnly = statusFilter !== "pending";

  const content = (
      <div className="space-y-5 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={ShieldCheck}
            eyebrow="Admin"
            title="Automated Changes"
            subtitle="Super Admin only. Automated jobs propose changes here for your review before applying them."
            testId="text-automated-changes-title"
          />
        ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-automated-changes-title">
                Automated Changes
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Super Admin only. Automated jobs never overwrite employee-entered data — they
                propose changes here for your review. Approving applies the change and records an
                audit entry; rejecting discards it.
              </p>
            </div>
          </div>
        </div>
        )}

        <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setSelected(new Set()); }}>
          <TabsList data-testid="tabs-status-filter">
            <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
            <TabsTrigger value="approved" data-testid="tab-approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        {!isReadOnly && selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
            <span className="text-sm font-medium" data-testid="text-selected-count">
              {selected.size} selected
            </span>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                onClick={() => bulkApproveMutation.mutate(Array.from(selected))}
                disabled={anyMutating}
                data-testid="button-bulk-approve"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Approve selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkRejectMutation.mutate(Array.from(selected))}
                disabled={anyMutating}
                data-testid="button-bulk-reject"
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Reject selected
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : total === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Info className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground" data-testid="text-empty-state">
                No {statusFilter} automated changes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => {
              const groupIds = group.items.map((i) => i.id);
              const allSelected = !isReadOnly && groupIds.every((id) => selected.has(id));
              return (
                <Card key={group.runDate} data-testid={`group-${group.runDate}`}>
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
                    {!isReadOnly && (
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(c) => toggleSelectGroup(group, !!c)}
                        data-testid={`checkbox-group-${group.runDate}`}
                      />
                    )}
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {formatDate(group.runDate)}
                    </CardTitle>
                    <Badge variant="secondary" data-testid={`badge-group-count-${group.runDate}`}>
                      {group.count} change{group.count === 1 ? "" : "s"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2.5"
                        data-testid={`row-change-${item.id}`}
                      >
                        {!isReadOnly && (
                          <Checkbox
                            checked={selected.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                            data-testid={`checkbox-change-${item.id}`}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium truncate" data-testid={`text-employee-${item.id}`}>
                              {item.employeeName}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {SOURCE_LABELS[item.sourceJob] ?? item.sourceJob}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            <span className="capitalize">{item.targetTable}</span>
                            {item.field ? <> · {item.field}</> : null} ·{" "}
                            <span className="text-foreground/70">{item.currentValue ?? "—"}</span>
                            {" → "}
                            <span className="font-medium text-foreground">{item.proposedValue ?? "—"}</span>
                            {item.reason ? <> · {item.reason}</> : null}
                          </div>
                        </div>
                        {isReadOnly ? (
                          <Badge
                            variant={item.status === "approved" ? "default" : "destructive"}
                            data-testid={`badge-status-${item.id}`}
                          >
                            {item.status}
                          </Badge>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approveMutation.mutate(item.id)}
                              disabled={anyMutating}
                              data-testid={`button-approve-${item.id}`}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => rejectMutation.mutate(item.id)}
                              disabled={anyMutating}
                              data-testid={`button-reject-${item.id}`}
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
  );
  return embedded ? content : <AdminLayout>{content}</AdminLayout>;
}
