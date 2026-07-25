import { useEffect, useState } from "react";
import { PolicyHint } from "@/components/shared/PolicyHint";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CalendarCheck, Check, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
}

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function LeaveApprovals() {
  const { enabled: newLook } = useNewLook();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewData, setReviewData] = useState<{ id: string; action: string; comment: string } | null>(null);

  const isManagerOnly = user?.role === "manager";
  const leaveEndpoint = isManagerOnly ? "/api/hr/leave-requests/my-team" : "/api/hr/leave-requests";

  const { data: requests, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: [leaveEndpoint, { status: statusFilter }],
    enabled: isAuthenticated,
  });

  const { data: leaveTypes } = useQuery<LeaveType[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated,
  });

  const { data: users } = useQuery<AdminUser[]>({
    queryKey: ["/api/hr/users"],
    enabled: isAuthenticated && (user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr"),
  });

  const { data: teamMembers } = useQuery<{ members: AdminUser[] }>({
    queryKey: ["/api/hr/attendance/my-team"],
    enabled: isAuthenticated && isManagerOnly,
  });

  const reviewMutation = useMutation({
    mutationFn: (data: { id: string; status: string; reviewComment: string }) =>
      apiRequest("PATCH", `/api/hr/leave-requests/${data.id}/review`, {
        status: data.status,
        reviewComment: data.reviewComment,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-requests/my-team"] });
      setReviewData(null);
      toast({ title: "Reviewed", description: "Leave request has been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to review", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const getLeaveTypeName = (id: string) => leaveTypes?.find(lt => lt.id === id)?.name || "Unknown";
  const getUserName = (id: string) => {
    const u = users?.find(u => u.id === id);
    if (u) return `${u.firstName} ${u.lastName}`;
    const tm = teamMembers?.members?.find(m => m.id === id);
    if (tm) return `${tm.firstName} ${tm.lastName}`;
    return "Unknown";
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            {newLook ? (
              <V2PageHeader icon={CalendarCheck} eyebrow="HR" title="Leave Approvals" subtitle="Review and manage team leave requests" testId="text-leave-approvals-title" />
            ) : (
              <>
                <h1 className="text-3xl font-bold" data-testid="text-leave-approvals-title">Leave Approvals</h1>
                <p className="text-muted-foreground">Review and manage team leave requests</p>
              </>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Requests ({requests?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : requests && requests.length > 0 ? (
              <TooltipProvider>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Employee</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">From</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">To</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Days</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Reason</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((lr) => (
                      <tr key={lr.id} className="border-b last:border-0" data-testid={`approval-row-${lr.id}`}>
                        <td className="py-2 px-2">{getUserName(lr.userId)}</td>
                        <td className="py-2 px-2">{getLeaveTypeName(lr.leaveTypeId)}</td>
                        <td className="py-2 px-2">{lr.startDate}</td>
                        <td className="py-2 px-2">{lr.endDate}</td>
                        <td className="py-2 px-2">{lr.totalDays}</td>
                        <td className="py-2 px-2 max-w-[150px]">
                          {lr.reason ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block cursor-default" data-testid={`text-reason-${lr.id}`}>{lr.reason}</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs whitespace-pre-wrap">
                                {lr.reason}
                              </TooltipContent>
                            </Tooltip>
                          ) : "-"}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="secondary" className={statusColors[lr.status] || ""}>
                            {lr.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          {lr.status === "pending" && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setReviewData({ id: lr.id, action: "approved", comment: "" })}
                                data-testid={`button-approve-${lr.id}`}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setReviewData({ id: lr.id, action: "rejected", comment: "" })}
                                data-testid={`button-reject-${lr.id}`}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </TooltipProvider>
            ) : (
              <div className="text-center py-8">
                <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No {statusFilter} leave requests</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!reviewData} onOpenChange={() => setReviewData(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">
                {reviewData?.action === "approved" ? "Approve" : "Reject"} Leave Request
                <PolicyHint policyKey="leave_lwp_warning" />
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Comment (optional)</Label>
                <Textarea
                  value={reviewData?.comment || ""}
                  onChange={(e) => setReviewData(prev => prev ? { ...prev, comment: e.target.value } : null)}
                  placeholder="Add a comment..."
                  data-testid="input-review-comment"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewData(null)}>Cancel</Button>
              <Button
                variant={reviewData?.action === "approved" ? "default" : "destructive"}
                onClick={() => {
                  if (reviewData) {
                    reviewMutation.mutate({
                      id: reviewData.id,
                      status: reviewData.action,
                      reviewComment: reviewData.comment,
                    });
                  }
                }}
                disabled={reviewMutation.isPending}
                data-testid="button-confirm-review"
              >
                {reviewMutation.isPending ? "Processing..." : (reviewData?.action === "approved" ? "Approve" : "Reject")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
