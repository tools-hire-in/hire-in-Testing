import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CalendarCheck, Loader2, Plus, User, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface LeaveRequest {
  id: string;
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewComment: string | null;
  createdAt: string;
}

interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  isActive: boolean;
}

interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  totalDays: string;
  usedDays: string;
}

export default function LeaveManagement() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showApply, setShowApply] = useState(false);
  const [formData, setFormData] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const { data: myLeaves, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/hr/leave-requests/my"],
    enabled: isAuthenticated,
  });

  const { data: leaveTypes } = useQuery<LeaveType[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated,
  });

  const { data: balances } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/hr/leave-balances/my"],
    enabled: isAuthenticated,
  });

  const { data: approverData, isLoading: approverLoading } = useQuery<{
    approver: { id: string | null; firstName: string; lastName: string; role: string };
    escalationPath: string[];
  }>({
    queryKey: ["/api/hr/leave-requests/approver", user?.id],
    enabled: showApply && !!user?.id,
  });

  const applyMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return apiRequest("POST", "/api/hr/leave-requests", {
        ...data,
        totalDays: String(diffDays),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-requests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balances/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard-stats"] });
      setShowApply(false);
      setFormData({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
      toast({ title: "Leave Applied", description: "Your leave request has been submitted." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to apply", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/hr/leave-requests/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-requests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard-stats"] });
      toast({ title: "Cancelled", description: "Leave request cancelled." });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const getLeaveTypeName = (id: string) => leaveTypes?.find(lt => lt.id === id)?.name || "Unknown";

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-leaves-title">Leave Management</h1>
            <p className="text-muted-foreground">Manage your leave requests</p>
          </div>
          <Button onClick={() => setShowApply(true)} data-testid="button-apply-leave">
            <Plus className="h-4 w-4 mr-2" />
            Apply for Leave
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {balances?.map((bal) => {
            const total = parseFloat(bal.totalDays);
            const used = parseFloat(bal.usedDays);
            return (
              <Card key={bal.id}>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{getLeaveTypeName(bal.leaveTypeId)}</p>
                  <div className="text-2xl font-bold">{total - used}</div>
                  <p className="text-xs text-muted-foreground">of {total} remaining</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : myLeaves && myLeaves.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">From</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">To</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Days</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLeaves.map((lr) => (
                      <tr key={lr.id} className="border-b last:border-0" data-testid={`leave-row-${lr.id}`}>
                        <td className="py-2 px-2">{getLeaveTypeName(lr.leaveTypeId)}</td>
                        <td className="py-2 px-2">{lr.startDate}</td>
                        <td className="py-2 px-2">{lr.endDate}</td>
                        <td className="py-2 px-2">{lr.totalDays}</td>
                        <td className="py-2 px-2">
                          <Badge variant="secondary" className={statusColors[lr.status] || ""}>
                            {lr.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          {lr.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelMutation.mutate(lr.id)}
                              disabled={cancelMutation.isPending}
                              data-testid={`button-cancel-leave-${lr.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          {lr.reviewComment && (
                            <span className="text-xs text-muted-foreground ml-2">{lr.reviewComment}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No leave requests yet</p>
            )}
          </CardContent>
        </Card>

        <Dialog open={showApply} onOpenChange={setShowApply}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select
                  value={formData.leaveTypeId}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, leaveTypeId: v }))}
                >
                  <SelectTrigger data-testid="select-leave-type">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes?.filter(lt => lt.isActive).map(lt => (
                      <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    data-testid="input-leave-start"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    data-testid="input-leave-end"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Reason for leave..."
                  data-testid="input-leave-reason"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2" data-testid="text-leave-approver">
                {approverLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    <span>Finding approver...</span>
                  </>
                ) : (
                  <>
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Your request will be sent to:{" "}
                      <strong className="text-foreground">
                        {approverData
                          ? `${approverData.approver.firstName} ${approverData.approver.lastName}`
                          : "HR Department"}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApply(false)}>Cancel</Button>
              <Button
                onClick={() => applyMutation.mutate(formData)}
                disabled={!formData.leaveTypeId || !formData.startDate || !formData.endDate || applyMutation.isPending}
                data-testid="button-submit-leave"
              >
                {applyMutation.isPending ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
