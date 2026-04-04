import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshCw, Plus, ChevronDown, ChevronUp, Calendar, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ReviewCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: "annual" | "semi_annual" | "quarterly";
  status: "draft" | "active" | "in_review" | "closed";
  completionPercentage: number;
  totalParticipants: number;
  completedReviews: number;
  participants?: ReviewParticipant[];
}

interface ReviewParticipant {
  id: string;
  employeeName: string;
  selfReviewStatus: "pending" | "submitted";
  managerReviewStatus: "pending" | "submitted";
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_review: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  closed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const typeLabels: Record<string, string> = {
  annual: "Annual",
  semi_annual: "Semi-Annual",
  quarterly: "Quarterly",
};

export default function ReviewCycles() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", type: "annual" });

  const isHrOrAdmin = ["super_admin", "admin", "hr"].includes(user?.role || "");

  const { data: cycles, isLoading } = useQuery<ReviewCycle[]>({
    queryKey: ["/api/performance/review-cycles"],
    enabled: isAuthenticated && isHrOrAdmin,
  });

  const { data: participants, isLoading: loadingParticipants } = useQuery<ReviewParticipant[]>({
    queryKey: ["/api/performance/review-cycles", expandedCycleId, "participants"],
    enabled: !!expandedCycleId,
  });

  const createCycleMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/performance/review-cycles", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/review-cycles"] });
      setShowCreate(false);
      setForm({ name: "", startDate: "", endDate: "", type: "annual" });
      toast({ title: "Review cycle created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to create cycle", variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/performance/review-cycles/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/review-cycles"] });
      toast({ title: "Cycle status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to update status", variant: "destructive" }),
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  if (!isHrOrAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground" data-testid="text-no-access">You don't have access to this page.</p>
        </div>
      </AdminLayout>
    );
  }

  const getNextStatus = (status: string): { label: string; newStatus: string } | null => {
    if (status === "draft") return { label: "Activate", newStatus: "active" };
    if (status === "active") return { label: "Move to Review", newStatus: "in_review" };
    if (status === "in_review") return { label: "Close", newStatus: "closed" };
    return null;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-review-cycles-title">Review Cycles</h1>
            <p className="text-muted-foreground">Create and manage performance review cycles</p>
          </div>
          <Button onClick={() => setShowCreate(true)} data-testid="button-create-cycle">
            <Plus className="h-4 w-4 mr-2" />
            New Cycle
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              All Review Cycles ({cycles?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : cycles && cycles.length > 0 ? (
              <div className="space-y-3">
                {cycles.map((cycle) => {
                  const isExpanded = expandedCycleId === cycle.id;
                  const nextAction = getNextStatus(cycle.status);
                  return (
                    <div key={cycle.id} className="border rounded-lg" data-testid={`cycle-row-${cycle.id}`}>
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm" data-testid={`text-cycle-name-${cycle.id}`}>{cycle.name}</h3>
                              <Badge variant="secondary" className={statusColors[cycle.status]} data-testid={`badge-cycle-status-${cycle.id}`}>
                                {cycle.status.replace("_", " ")}
                              </Badge>
                              <Badge variant="outline" data-testid={`badge-cycle-type-${cycle.id}`}>
                                {typeLabels[cycle.type] || cycle.type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {cycle.startDate} — {cycle.endDate}
                              </span>
                              <span>{cycle.completedReviews}/{cycle.totalParticipants} completed</span>
                            </div>
                            <div className="mt-2 max-w-xs">
                              <Progress value={cycle.completionPercentage} className="h-2" />
                              <span className="text-xs text-muted-foreground">{cycle.completionPercentage}% complete</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {nextAction && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ id: cycle.id, status: nextAction.newStatus })}
                                disabled={updateStatusMutation.isPending}
                                data-testid={`button-status-${cycle.id}`}
                              >
                                {nextAction.label}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedCycleId(isExpanded ? null : cycle.id)}
                              data-testid={`button-expand-${cycle.id}`}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t px-4 py-3 bg-muted/30">
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Participant Breakdown</h4>
                          {loadingParticipants ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                              <Loader2 className="h-4 w-4 animate-spin" /> Loading participants...
                            </div>
                          ) : participants && participants.length > 0 ? (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Employee</th>
                                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Self-Review</th>
                                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Manager Review</th>
                                </tr>
                              </thead>
                              <tbody>
                                {participants.map((p) => (
                                  <tr key={p.id} className="border-b last:border-0" data-testid={`participant-row-${p.id}`}>
                                    <td className="py-2 px-2">{p.employeeName}</td>
                                    <td className="py-2 px-2">
                                      <Badge variant="secondary" className={p.selfReviewStatus === "submitted" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                                        {p.selfReviewStatus}
                                      </Badge>
                                    </td>
                                    <td className="py-2 px-2">
                                      <Badge variant="secondary" className={p.managerReviewStatus === "submitted" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                                        {p.managerReviewStatus}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-sm text-muted-foreground py-2">No participants found for this cycle.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No review cycles created yet</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first review cycle to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Review Cycle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Cycle Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Q1 2026 Performance Review"
                  data-testid="input-cycle-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
                    data-testid="input-cycle-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
                    data-testid="input-cycle-end-date"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Review Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="select-cycle-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={() => createCycleMutation.mutate()}
                disabled={!form.name || !form.startDate || !form.endDate || createCycleMutation.isPending}
                data-testid="button-submit-cycle"
              >
                {createCycleMutation.isPending ? "Creating..." : "Create Cycle"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}