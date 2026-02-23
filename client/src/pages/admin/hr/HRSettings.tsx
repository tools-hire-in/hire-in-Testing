import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Plus, Pencil, Trash2, CalendarDays, Building2, Upload, Download, Info, Scale, Users, CheckSquare } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  monthlyAccrual: string;
  minHoursForAccrual: string;
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

  const [showUploadHoliday, setShowUploadHoliday] = useState(false);
  const [uploadYear, setUploadYear] = useState(String(new Date().getFullYear()));
  const [uploadNote, setUploadNote] = useState("Employee's can apply any two regional holidays without any loss of pay for india office. US Holidays are mandatory for US Client Team.");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showDepartment, setShowDepartment] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [dForm, setDForm] = useState({ name: "", description: "", isActive: true });

  const [showAdjustment, setShowAdjustment] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [adjForm, setAdjForm] = useState({ userId: "", leaveTypeId: "", adjustmentDays: "", reason: "", year: String(new Date().getFullYear()) });
  const [adjHistoryYear, setAdjHistoryYear] = useState(String(new Date().getFullYear()));

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

  const uploadHolidayMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("year", uploadYear);
      formData.append("note", uploadNote);
      const res = await fetch("/api/hr/holidays/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/holidays"] });
      setShowUploadHoliday(false);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      let desc = data.message;
      if (data.errors && data.errors.length > 0) {
        desc += `. ${data.errors.length} error(s) encountered.`;
      }
      toast({ title: "Upload Complete", description: desc });
    },
    onError: (err: any) => {
      toast({ title: "Upload Failed", description: err.message || "Failed to upload", variant: "destructive" });
    },
  });

  const downloadTemplate = () => {
    const csv = "Date,Holiday Name,Regional Holiday\nJan 1st,New Year,\nMarch 3rd,,Holi\nMarch 20th,,Eid-ul-Fitr\nMay 27th,,Eid-ul-Adha (Bakrid)\nSep 7th,Labour Day USA,\nNov 12th,,Diwali\nNov 26th,Thanksgiving day,\nDec 25th,Christmas,\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "holiday_calendar_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

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

  interface AdminUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
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

  const isHrOrAbove = user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr";

  const { data: allUsers } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && isHrOrAbove,
  });

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
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveTypes.filter(lt => lt.isActive).map((lt) => (
                      <tr key={lt.id} className="border-b last:border-0" data-testid={`leave-type-row-${lt.id}`}>
                        <td className="py-2 px-2 font-medium">{lt.name}</td>
                        <td className="py-2 px-2">{lt.defaultDays}</td>
                        <td className="py-2 px-2">{parseFloat(lt.monthlyAccrual || "0")}/month</td>
                        <td className="py-2 px-2">{parseFloat(lt.minHoursForAccrual || "128")}h</td>
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
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setShowUploadHoliday(true)} data-testid="button-upload-holidays">
                <Upload className="h-4 w-4 mr-1" />
                Upload CSV
              </Button>
              <Button size="sm" onClick={() => openHolidayForm()} data-testid="button-add-holiday">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {hLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : holidays && holidays.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Holiday Name</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Regional Holiday</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.map((h) => (
                      <tr key={h.id} className="border-b last:border-0" data-testid={`holiday-row-${h.id}`}>
                        <td className="py-2 px-2">{h.date}</td>
                        <td className="py-2 px-2 font-medium">{h.type !== "regional" ? h.name : ""}</td>
                        <td className="py-2 px-2">{h.type === "regional" || h.isOptional ? h.name : ""}</td>
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
            <div className="mt-4 p-3 rounded-md border border-dashed flex items-start gap-2" data-testid="text-holiday-note">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground font-medium">
                Note : Employee's can apply any two regional holidays without any loss of pay for india office. US Holidays are mandatory for US Client Team.
              </p>
            </div>
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

        {isHrOrAbove && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Balance Adjustments</CardTitle>
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
                      {[0, 1, 2].map(offset => {
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
        )}

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
                    setAdjForm(prev => ({ ...prev, userId: "" }));
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
                        const activeUsers = allUsers?.filter(u => u.isActive) || [];
                        if (selectedUserIds.length === activeUsers.length) {
                          setSelectedUserIds([]);
                        } else {
                          setSelectedUserIds(activeUsers.map(u => u.id));
                        }
                      }}
                      data-testid="button-select-all-users"
                    >
                      <CheckSquare className="h-4 w-4 mr-1" />
                      {selectedUserIds.length === (allUsers?.filter(u => u.isActive)?.length || 0) ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                    {allUsers?.filter(u => u.isActive).map(u => (
                      <div key={u.id} className="flex items-center gap-2 py-1">
                        <Checkbox
                          id={`user-${u.id}`}
                          checked={selectedUserIds.includes(u.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUserIds(prev => [...prev, u.id]);
                            } else {
                              setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                            }
                          }}
                          data-testid={`checkbox-user-${u.id}`}
                        />
                        <Label htmlFor={`user-${u.id}`} className="text-sm cursor-pointer">
                          {u.firstName} {u.lastName} ({u.email})
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedUserIds.length} employee(s) selected</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={adjForm.userId}
                    onValueChange={(v) => setAdjForm(prev => ({ ...prev, userId: v }))}
                  >
                    <SelectTrigger data-testid="select-adj-user">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers?.filter(u => u.isActive).map(u => (
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
                  onValueChange={(v) => setAdjForm(prev => ({ ...prev, leaveTypeId: v }))}
                >
                  <SelectTrigger data-testid="select-adj-leave-type">
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
                  <Label>Adjustment Days (+/-)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={adjForm.adjustmentDays}
                    onChange={(e) => setAdjForm(prev => ({ ...prev, adjustmentDays: e.target.value }))}
                    placeholder="e.g. 3 or -1"
                    data-testid="input-adj-days"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select value={adjForm.year} onValueChange={(v) => setAdjForm(prev => ({ ...prev, year: v }))}>
                    <SelectTrigger data-testid="select-adj-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2].map(offset => {
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
                  onChange={(e) => setAdjForm(prev => ({ ...prev, reason: e.target.value }))}
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

        <Dialog open={showUploadHoliday} onOpenChange={setShowUploadHoliday}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Holiday Calendar</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>CSV File</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  data-testid="input-upload-holiday-file"
                />
                <p className="text-xs text-muted-foreground">
                  CSV must have columns: Date, Holiday Name, Regional Holiday
                </p>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={uploadYear}
                  onChange={(e) => setUploadYear(e.target.value)}
                  data-testid="input-upload-holiday-year"
                />
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea
                  value={uploadNote}
                  onChange={(e) => setUploadNote(e.target.value)}
                  rows={3}
                  data-testid="input-upload-holiday-note"
                />
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
                <Download className="h-4 w-4 mr-1" />
                Download Template
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUploadHoliday(false)}>Cancel</Button>
              <Button
                onClick={() => uploadHolidayMutation.mutate()}
                disabled={!uploadFile || uploadHolidayMutation.isPending}
                data-testid="button-submit-upload-holidays"
              >
                {uploadHolidayMutation.isPending ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
