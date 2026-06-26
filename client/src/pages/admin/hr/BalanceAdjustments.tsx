import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, CheckSquare, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

interface LeaveTypeOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface LeaveAdjustment {
  id: string;
  userId: string;
  leaveTypeId: string;
  adjustmentDays: string;
  reason: string;
  year: number;
  adjustedBy: string;
  createdAt: string;
  userName: string;
  leaveTypeName: string;
  adjustedByName: string;
}

export default function BalanceAdjustments() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  const isHrOrAbove = user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr";

  const [showAdjustment, setShowAdjustment] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [adjForm, setAdjForm] = useState({ userId: "", leaveTypeId: "", adjustmentDays: "", reason: "", year: String(new Date().getFullYear()) });
  const [adjHistoryYear, setAdjHistoryYear] = useState(String(new Date().getFullYear()));

  const { data: leaveTypes } = useQuery<LeaveTypeOption[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated && isHrOrAbove,
    staleTime: 30000,
  });

  const { data: allUsersResponse } = useQuery<{ users: AdminUser[] }>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && isHrOrAbove,
    retry: 2,
    staleTime: 30000,
  });
  const allUsers = allUsersResponse?.users;

  const { data: adjustmentHistory, isLoading: adjHistLoading } = useQuery<LeaveAdjustment[]>({
    queryKey: ["/api/hr/leave-adjustments", adjHistoryYear],
    enabled: isAuthenticated && isHrOrAbove,
    queryFn: async () => {
      const res = await fetch(`/api/hr/leave-adjustments?year=${adjHistoryYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const adjustMutation = useMutation({
    mutationFn: (data: { userId: string; leaveTypeId: string; adjustmentDays: number; reason: string; year: number }) =>
      apiRequest("POST", "/api/hr/leave-balances/adjust", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      setShowAdjustment(false);
      setAdjForm({ userId: "", leaveTypeId: "", adjustmentDays: "", reason: "", year: String(new Date().getFullYear()) });
      toast({ title: "Adjusted", description: "Leave balance adjusted successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to adjust balance", variant: "destructive" });
    },
  });

  const bulkAdjustMutation = useMutation({
    mutationFn: (data: { userIds: string[]; leaveTypeId: string; adjustmentDays: number; reason: string; year: number }) =>
      apiRequest("POST", "/api/hr/leave-balances/bulk-adjust", data),
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      setShowAdjustment(false);
      setSelectedUserIds([]);
      setAdjForm({ userId: "", leaveTypeId: "", adjustmentDays: "", reason: "", year: String(new Date().getFullYear()) });
      toast({ title: "Bulk Adjusted", description: result.message || `Adjusted ${result.successCount} employees.` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to bulk adjust balances", variant: "destructive" });
    },
  });

  if (!isHrOrAbove) {
    return (
      <div className="p-8 text-center text-muted-foreground" data-testid="balance-adjustments-no-access">
        You do not have access to balance adjustments.
      </div>
    );
  }

  const activeUsers = allUsers?.filter((u) => u.isActive) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-section-balance-adjustments">Balance Adjustments</h1>
        <p className="text-muted-foreground text-sm">Manually adjust employee leave balances</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Adjustment History</CardTitle>
          <Button size="sm" onClick={() => { setShowAdjustment(true); setIsBulkMode(false); setSelectedUserIds([]); }} data-testid="button-add-adjustment">
            <Plus className="h-4 w-4 mr-1" />
            Adjust Balance
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Filter Year</Label>
              <Select value={adjHistoryYear} onValueChange={setAdjHistoryYear}>
                <SelectTrigger className="w-[120px]" data-testid="select-adj-history-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2].map((offset) => {
                    const y = new Date().getFullYear() - offset;
                    return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {adjHistLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : adjustmentHistory && adjustmentHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Employee</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Leave Type</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Days</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Reason</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Adjusted By</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustmentHistory.map((adj) => (
                    <tr key={adj.id} className="border-b last:border-0" data-testid={`adj-row-${adj.id}`}>
                      <td className="py-2 px-2 text-muted-foreground">{adj.createdAt ? new Date(adj.createdAt).toLocaleDateString() : "-"}</td>
                      <td className="py-2 px-2 font-medium">{adj.userName}</td>
                      <td className="py-2 px-2">{adj.leaveTypeName}</td>
                      <td className="py-2 px-2">
                        <Badge variant="secondary" className={parseFloat(adj.adjustmentDays) >= 0 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}>
                          {parseFloat(adj.adjustmentDays) >= 0 ? "+" : ""}{adj.adjustmentDays}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground max-w-[200px] truncate">{adj.reason}</td>
                      <td className="py-2 px-2 text-muted-foreground">{adj.adjustedByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4">
              <Scale className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No balance adjustments found for {adjHistoryYear}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdjustment} onOpenChange={setShowAdjustment}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adjust Leave Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-mode"
                checked={isBulkMode}
                onCheckedChange={(v) => {
                  setIsBulkMode(!!v);
                  if (!v) setSelectedUserIds([]);
                  setAdjForm((prev) => ({ ...prev, userId: "" }));
                }}
                data-testid="checkbox-bulk-mode"
              />
              <Label htmlFor="bulk-mode">Bulk adjust (multiple employees)</Label>
            </div>

            {isBulkMode ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label>Select Employees</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedUserIds.length === activeUsers.length) {
                        setSelectedUserIds([]);
                      } else {
                        setSelectedUserIds(activeUsers.map((u) => u.id));
                      }
                    }}
                    data-testid="button-select-all-users"
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    {selectedUserIds.length === activeUsers.length && activeUsers.length > 0 ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                  {!allUsers ? (
                    <p className="text-sm text-muted-foreground py-2 text-center">Loading employees...</p>
                  ) : activeUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 text-center">No active employees found</p>
                  ) : (
                    activeUsers.map((u) => (
                      <div key={u.id} className="flex items-center gap-2 py-1">
                        <Checkbox
                          id={`user-${u.id}`}
                          checked={selectedUserIds.includes(u.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUserIds((prev) => [...prev, u.id]);
                            } else {
                              setSelectedUserIds((prev) => prev.filter((id) => id !== u.id));
                            }
                          }}
                          data-testid={`checkbox-user-${u.id}`}
                        />
                        <Label htmlFor={`user-${u.id}`} className="text-sm cursor-pointer">
                          {u.firstName} {u.lastName} ({u.email})
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{selectedUserIds.length} employee(s) selected</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select
                  value={adjForm.userId}
                  onValueChange={(v) => setAdjForm((prev) => ({ ...prev, userId: v }))}
                >
                  <SelectTrigger data-testid="select-adj-user">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select
                value={adjForm.leaveTypeId}
                onValueChange={(v) => setAdjForm((prev) => ({ ...prev, leaveTypeId: v }))}
              >
                <SelectTrigger data-testid="select-adj-leave-type">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes?.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>{lt.name}{!lt.isActive ? " (inactive)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Adjustment Days (+/-)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={adjForm.adjustmentDays}
                  onChange={(e) => setAdjForm((prev) => ({ ...prev, adjustmentDays: e.target.value }))}
                  placeholder="e.g. 3 or -1"
                  data-testid="input-adj-days"
                />
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={adjForm.year} onValueChange={(v) => setAdjForm((prev) => ({ ...prev, year: v }))}>
                  <SelectTrigger data-testid="select-adj-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2].map((offset) => {
                      const y = new Date().getFullYear() - offset;
                      return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={adjForm.reason}
                onChange={(e) => setAdjForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g. Adding previous Sick Leave balance (0.5/month for Jan-Jun)"
                data-testid="input-adj-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustment(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const days = parseFloat(adjForm.adjustmentDays);
                const year = parseInt(adjForm.year);
                if (isNaN(days) || days === 0) {
                  toast({ title: "Error", description: "Please enter a valid non-zero adjustment amount", variant: "destructive" });
                  return;
                }
                if (isBulkMode) {
                  bulkAdjustMutation.mutate({
                    userIds: selectedUserIds,
                    leaveTypeId: adjForm.leaveTypeId,
                    adjustmentDays: days,
                    reason: adjForm.reason,
                    year,
                  });
                } else {
                  adjustMutation.mutate({
                    userId: adjForm.userId,
                    leaveTypeId: adjForm.leaveTypeId,
                    adjustmentDays: days,
                    reason: adjForm.reason,
                    year,
                  });
                }
              }}
              disabled={
                (!isBulkMode && !adjForm.userId) ||
                (isBulkMode && selectedUserIds.length === 0) ||
                !adjForm.leaveTypeId ||
                !adjForm.adjustmentDays ||
                !adjForm.reason ||
                adjustMutation.isPending ||
                bulkAdjustMutation.isPending
              }
              data-testid="button-submit-adjustment"
            >
              {(adjustMutation.isPending || bulkAdjustMutation.isPending) ? "Adjusting..." : isBulkMode ? `Adjust ${selectedUserIds.length} Employee(s)` : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
