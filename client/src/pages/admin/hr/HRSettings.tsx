import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Plus, Pencil, Trash2, CalendarDays, Building2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  monthlyAccrual: string;
  description: string | null;
  isActive: boolean;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  isOptional: boolean;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  headId: string | null;
  isActive: boolean;
}

export default function HRSettings() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();

  const [showLeaveType, setShowLeaveType] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [ltForm, setLtForm] = useState({ name: "", defaultDays: "0", monthlyAccrual: "0", minHoursForAccrual: "128", description: "", isActive: true });

  const [showHoliday, setShowHoliday] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [hForm, setHForm] = useState({ name: "", date: "", type: "public", isOptional: false });

  const [showDepartment, setShowDepartment] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [dForm, setDForm] = useState({ name: "", description: "", isActive: true });

  const { data: leaveTypes, isLoading: ltLoading } = useQuery<LeaveType[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated,
  });

  const { data: holidays, isLoading: hLoading } = useQuery<Holiday[]>({
    queryKey: ["/api/hr/holidays"],
    enabled: isAuthenticated,
  });

  const leaveTypeMutation = useMutation({
    mutationFn: (data: { id?: string; body: any }) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/hr/leave-types/${data.id}`, data.body);
      }
      return apiRequest("POST", "/api/hr/leave-types", data.body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-types"] });
      setShowLeaveType(false);
      setEditingLeaveType(null);
      toast({ title: "Saved", description: "Leave type saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    },
  });

  const deleteLeaveTypeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hr/leave-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-types"] });
      toast({ title: "Deleted", description: "Leave type deleted." });
    },
  });

  const accrualMutation = useMutation({
    mutationFn: (data: { year?: number; month?: number }) => apiRequest("POST", "/api/hr/leave-accruals/run", data),
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      let desc = `${result.message}. ${result.usersProcessed} users earned leave, ${result.accrualsMade} accruals made.`;
      if (result.skippedUsers && result.skippedUsers.length > 0) {
        desc += ` ${result.skippedUsers.length} user(s) did not meet hours threshold.`;
      }
      toast({ title: "Accrual Complete", description: desc });
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not run leave accrual", variant: "destructive" });
    },
  });

  const holidayMutation = useMutation({
    mutationFn: (data: { id?: string; body: any }) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/hr/holidays/${data.id}`, data.body);
      }
      return apiRequest("POST", "/api/hr/holidays", data.body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/holidays"] });
      setShowHoliday(false);
      setEditingHoliday(null);
      toast({ title: "Saved", description: "Holiday saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hr/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/holidays"] });
      toast({ title: "Deleted", description: "Holiday deleted." });
    },
  });

  const { data: deptList, isLoading: deptLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: isAuthenticated,
  });

  const deptMutation = useMutation({
    mutationFn: (data: { id?: string; body: any }) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/departments/${data.id}`, data.body);
      }
      return apiRequest("POST", "/api/departments", data.body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowDepartment(false);
      setEditingDepartment(null);
      toast({ title: "Saved", description: "Department saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Deleted", description: "Department deleted." });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const openLeaveTypeForm = (lt?: LeaveType) => {
    if (lt) {
      setEditingLeaveType(lt);
      setLtForm({ name: lt.name, defaultDays: String(lt.defaultDays), monthlyAccrual: lt.monthlyAccrual || "0", minHoursForAccrual: lt.minHoursForAccrual || "128", description: lt.description || "", isActive: lt.isActive });
    } else {
      setEditingLeaveType(null);
      setLtForm({ name: "", defaultDays: "0", monthlyAccrual: "0", minHoursForAccrual: "128", description: "", isActive: true });
    }
    setShowLeaveType(true);
  };

  const openHolidayForm = (h?: Holiday) => {
    if (h) {
      setEditingHoliday(h);
      setHForm({ name: h.name, date: h.date, type: h.type, isOptional: h.isOptional });
    } else {
      setEditingHoliday(null);
      setHForm({ name: "", date: "", type: "public", isOptional: false });
    }
    setShowHoliday(true);
  };

  const openDeptForm = (d?: Department) => {
    if (d) {
      setEditingDepartment(d);
      setDForm({ name: d.name, description: d.description || "", isActive: d.isActive });
    } else {
      setEditingDepartment(null);
      setDForm({ name: "", description: "", isActive: true });
    }
    setShowDepartment(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-hr-settings-title">HR Settings</h1>
          <p className="text-muted-foreground">Manage leave types, holidays, and company policies</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Leave Types</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => accrualMutation.mutate({})}
                disabled={accrualMutation.isPending}
                data-testid="button-run-accrual"
              >
                {accrualMutation.isPending ? "Running..." : "Run Monthly Accrual"}
              </Button>
              <Button size="sm" onClick={() => openLeaveTypeForm()} data-testid="button-add-leave-type">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {ltLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : leaveTypes && leaveTypes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Annual Days</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Monthly Accrual</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Min Hours</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveTypes.map((lt) => (
                      <tr key={lt.id} className="border-b last:border-0" data-testid={`leave-type-row-${lt.id}`}>
                        <td className="py-2 px-2 font-medium">{lt.name}</td>
                        <td className="py-2 px-2">{lt.defaultDays}</td>
                        <td className="py-2 px-2">{parseFloat(lt.monthlyAccrual || "0")}/month</td>
                        <td className="py-2 px-2">{parseFloat(lt.minHoursForAccrual || "128")}h</td>
                        <td className="py-2 px-2">
                          <Badge variant={lt.isActive ? "default" : "secondary"}>
                            {lt.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openLeaveTypeForm(lt)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteLeaveTypeMutation.mutate(lt.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No leave types configured</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Holidays ({new Date().getFullYear()})</CardTitle>
            <Button size="sm" onClick={() => openHolidayForm()} data-testid="button-add-holiday">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            {hLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : holidays && holidays.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Optional</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.map((h) => (
                      <tr key={h.id} className="border-b last:border-0" data-testid={`holiday-row-${h.id}`}>
                        <td className="py-2 px-2 font-medium">{h.name}</td>
                        <td className="py-2 px-2">{h.date}</td>
                        <td className="py-2 px-2 capitalize">{h.type}</td>
                        <td className="py-2 px-2">{h.isOptional ? "Yes" : "No"}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openHolidayForm(h)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteHolidayMutation.mutate(h.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4">
                <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No holidays configured</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showLeaveType} onOpenChange={setShowLeaveType}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLeaveType ? "Edit" : "Add"} Leave Type</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={ltForm.name}
                  onChange={(e) => setLtForm(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-lt-name"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Annual Days (Max)</Label>
                  <Input
                    type="number"
                    value={ltForm.defaultDays}
                    onChange={(e) => setLtForm(prev => ({ ...prev, defaultDays: e.target.value }))}
                    data-testid="input-lt-days"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Accrual</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={ltForm.monthlyAccrual}
                    onChange={(e) => setLtForm(prev => ({ ...prev, monthlyAccrual: e.target.value }))}
                    data-testid="input-lt-monthly-accrual"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Hours/Month</Label>
                  <Input
                    type="number"
                    value={ltForm.minHoursForAccrual}
                    onChange={(e) => setLtForm(prev => ({ ...prev, minHoursForAccrual: e.target.value }))}
                    data-testid="input-lt-min-hours"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={ltForm.description}
                  onChange={(e) => setLtForm(prev => ({ ...prev, description: e.target.value }))}
                  data-testid="input-lt-description"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={ltForm.isActive}
                  onCheckedChange={(v) => setLtForm(prev => ({ ...prev, isActive: v }))}
                  data-testid="switch-lt-active"
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLeaveType(false)}>Cancel</Button>
              <Button
                onClick={() => leaveTypeMutation.mutate({
                  id: editingLeaveType?.id,
                  body: { ...ltForm, defaultDays: parseInt(ltForm.defaultDays), monthlyAccrual: ltForm.monthlyAccrual, minHoursForAccrual: ltForm.minHoursForAccrual },
                })}
                disabled={!ltForm.name || leaveTypeMutation.isPending}
                data-testid="button-save-leave-type"
              >
                {leaveTypeMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Departments</CardTitle>
            <Button size="sm" onClick={() => openDeptForm()} data-testid="button-add-department">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            {deptLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : deptList && deptList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Description</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptList.map((d) => (
                      <tr key={d.id} className="border-b last:border-0" data-testid={`dept-row-${d.id}`}>
                        <td className="py-2 px-2 font-medium">{d.name}</td>
                        <td className="py-2 px-2 text-muted-foreground max-w-[200px] truncate">{d.description || "-"}</td>
                        <td className="py-2 px-2">
                          <Badge variant={d.isActive ? "default" : "secondary"}>
                            {d.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openDeptForm(d)} data-testid={`button-edit-dept-${d.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {user?.role === "super_admin" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteDeptMutation.mutate(d.id)}
                                data-testid={`button-delete-dept-${d.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4">
                <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No departments configured</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showDepartment} onOpenChange={setShowDepartment}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDepartment ? "Edit" : "Add"} Department</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Department Name</Label>
                <Input
                  value={dForm.name}
                  onChange={(e) => setDForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Engineering, Healthcare, HR"
                  data-testid="input-dept-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={dForm.description}
                  onChange={(e) => setDForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the department"
                  data-testid="input-dept-description"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={dForm.isActive}
                  onCheckedChange={(v) => setDForm(prev => ({ ...prev, isActive: v }))}
                  data-testid="switch-dept-active"
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDepartment(false)}>Cancel</Button>
              <Button
                onClick={() => deptMutation.mutate({
                  id: editingDepartment?.id,
                  body: dForm,
                })}
                disabled={!dForm.name || deptMutation.isPending}
                data-testid="button-save-department"
              >
                {deptMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showHoliday} onOpenChange={setShowHoliday}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingHoliday ? "Edit" : "Add"} Holiday</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={hForm.name}
                  onChange={(e) => setHForm(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-holiday-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={hForm.date}
                  onChange={(e) => setHForm(prev => ({ ...prev, date: e.target.value }))}
                  data-testid="input-holiday-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={hForm.type} onValueChange={(v) => setHForm(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger data-testid="select-holiday-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="national">National</SelectItem>
                    <SelectItem value="religious">Religious</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={hForm.isOptional}
                  onCheckedChange={(v) => setHForm(prev => ({ ...prev, isOptional: v }))}
                  data-testid="switch-holiday-optional"
                />
                <Label>Optional Holiday</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHoliday(false)}>Cancel</Button>
              <Button
                onClick={() => holidayMutation.mutate({
                  id: editingHoliday?.id,
                  body: hForm,
                })}
                disabled={!hForm.name || !hForm.date || holidayMutation.isPending}
                data-testid="button-save-holiday"
              >
                {holidayMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
