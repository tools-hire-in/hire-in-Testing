import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Shield, UserPlus, Trash2, Building2, Network, Mail, KeyRound, Pencil, UserX, UserCheck, AlertTriangle, Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, Download, RotateCcw, LogOut, Briefcase, Clock, History, FolderOpen } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { EmployeeDossierSheet } from "@/components/admin/EmployeeDossierSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AdminUser, AdminUsersResponse } from "@shared/schema";

interface Department {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr: "HR",
  finance: "Finance",
  operations: "Operations",
  manager: "Manager",
  recruiter: "Recruiter",
  employee: "Employee",
};

const roleColors: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800",
  hr: "bg-green-100 text-green-800",
  finance: "bg-amber-100 text-amber-800",
  operations: "bg-orange-100 text-orange-800",
  manager: "bg-violet-100 text-violet-800",
  recruiter: "bg-cyan-100 text-cyan-800",
  employee: "bg-gray-100 text-gray-800",
};

const levelLabels: Record<string, string> = {
  ceo: "CEO",
  vp: "Vice President",
  director: "Director",
  manager: "Manager",
  team_lead: "Team Lead",
  delivery_manager: "Delivery Manager",
  team_member: "Team Member",
};

const TOP_LEVELS = ["ceo", "vp"];

const roleRank: Record<string, number> = {
  super_admin: 6, admin: 5, hr: 4, finance: 2.5, operations: 3, manager: 2, recruiter: 1.5, employee: 1,
};

const DESIGNATIONS = [
  "Recruiter",
  "Senior Recruiter",
  "Lead Recruiter",
  "Talent Acquisition Manager",
  "HR Executive",
  "HR Manager",
  "HR Business Partner",
  "Business Development Executive",
  "Business Development Manager",
  "Account Manager",
  "Client Partner",
  "Operations Executive",
  "Operations Manager",
  "Software Engineer",
  "Senior Software Engineer",
  "Tech Lead",
  "Architect",
  "Business Analyst (BA)",
  "Project Manager",
  "Product Manager",
  "Finance Executive",
  "Finance Manager",
  "Director",
  "Vice President",
];

export default function AdminUsers() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRole, setNewRole] = useState("employee");
  const [newJoiningDate, setNewJoiningDate] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [newHierarchyLevel, setNewHierarchyLevel] = useState("team_member");
  const [newSalary, setNewSalary] = useState("");
  const [newManagerId, setNewManagerId] = useState("");
  const [newGender, setNewGender] = useState("");

  const [newEmployeeCategory, setNewEmployeeCategory] = useState("experienced");

  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", designation: "", departmentId: "", joiningDate: "", salary: "", attendanceExempt: false, trainingExempt: false, employeeCategory: "experienced", employmentType: "Full-time / Regular" });

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkResults, setBulkResults] = useState<{ summary: { total: number; created: number; skipped: number; failed: number }; results: { row: number; email: string; status: string; error?: string }[] } | null>(null);

  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftUser, setShiftUser] = useState<AdminUser | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [shiftReason, setShiftReason] = useState("");

  const [hierarchyOpen, setHierarchyOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [hForm, setHForm] = useState({
    managerId: "" as string,
    departmentId: "" as string,
    designation: "",
    hierarchyLevel: "team_member",
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "disable" | "enable" | "relieve" | "left_company_exit"; user: AdminUser } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "disabled" | "relieved" | "left_company" | "deleted">("active");
  const [dossierUserId, setDossierUserId] = useState<string | null>(null);

  interface ShiftDef {
    id: string;
    name: string;
    displayLabel: string;
    usCoverage: string;
    istStart: string;
    istEnd: string;
    isDst: boolean;
  }

  interface ShiftHistoryEntry {
    id: string;
    changed_at: string;
    reason: string;
    old_shift_id: string | null;
    new_shift_id: string | null;
    changed_by_name: string;
    changed_by_email: string;
    old_shift_label: string | null;
    new_shift_label: string | null;
  }

  const { data: usersResponse, isLoading } = useQuery<AdminUsersResponse>({
    queryKey: ["/api/admin/users", statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users?status=${statusFilter}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const users = usersResponse?.users;
  const counts = usersResponse?.counts;

  const { data: deptList } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: isAuthenticated,
  });

  const { data: shiftDefs } = useQuery<ShiftDef[]>({
    queryKey: ["/api/hr/shifts"],
    enabled: isAuthenticated,
  });

  const { data: shiftHistory } = useQuery<ShiftHistoryEntry[]>({
    queryKey: ["/api/hr/users", shiftUser?.id, "shift-history"],
    queryFn: async () => {
      if (!shiftUser?.id) return [];
      const res = await fetch(`/api/hr/users/${shiftUser.id}/shift-history`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!shiftUser?.id && shiftOpen,
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; firstName: string; lastName: string; role: string; joiningDate?: string; designation?: string; departmentId?: string; hierarchyLevel?: string }) => {
      return apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      let rayoMsg = "";
      try {
        const data = await res.json();
        if (data.rayoProvisioning?.success) {
          rayoMsg = data.rayoProvisioning.tempPassword
            ? ` Rayo Academy account provisioned. Temporary password: ${data.rayoProvisioning.tempPassword} (also emailed to user).`
            : " Rayo Academy account has been provisioned.";
        } else if (data.rayoProvisioning && !data.rayoProvisioning.success) {
          rayoMsg = ` Rayo Academy provisioning failed: ${data.rayoProvisioning.error || "unknown error"}.`;
        }
      } catch {}
      toast({ title: "User invited successfully", description: `An invitation email with login credentials has been sent.${rayoMsg}`, duration: rayoMsg.includes("Temporary password") ? 15000 : 5000 });
      setInviteOpen(false);
      setNewEmail(""); setNewFirstName(""); setNewLastName(""); setNewRole("employee");
      setNewJoiningDate(""); setNewDesignation(""); setNewDepartmentId(""); setNewHierarchyLevel("team_member"); setNewSalary(""); setNewManagerId(""); setNewEmployeeCategory("experienced");
    },
    onError: () => {
      toast({ title: "Failed to invite user", description: "Please ensure the email ends with @hire-in.com", variant: "destructive" });
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/users/bulk-upload", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setBulkResults(data);
      setBulkFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Bulk upload failed", description: error?.message || "Something went wrong", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-tree"] });
      toast({ title: "User updated" });
      setEditOpen(false);
      setEditUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update user", description: error?.message || "Something went wrong", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated" });
    },
  });

  const hierarchyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}/hierarchy`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-tree"] });
      toast({ title: "Hierarchy updated" });
      setHierarchyOpen(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast({ title: "Failed to update hierarchy", variant: "destructive" });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/users/${id}/resend-invite`);
    },
    onSuccess: () => {
      toast({ title: "Invitation resent", description: "A new invitation email with fresh login credentials has been sent." });
    },
    onError: () => {
      toast({ title: "Failed to resend invitation", variant: "destructive" });
    },
  });

  const reset2FAMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/auth/totp/admin-reset/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "2FA Reset", description: "Two-factor authentication has been reset. The user will need to set it up again on next login." });
    },
    onError: () => {
      toast({ title: "Failed to reset 2FA", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted", description: "The user has been soft-deleted and can be restored later." });
      setConfirmOpen(false);
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete user", description: error?.message || "Something went wrong", variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/users/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User restored", description: "The user has been restored successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to restore user", description: error?.message || "Something went wrong", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}`, { isActive });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: variables.isActive ? "User enabled" : "User disabled", description: variables.isActive ? "The user can now log in." : "The user has been disabled and can no longer log in." });
      setConfirmOpen(false);
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update status", description: error?.message || "Something went wrong", variant: "destructive" });
    },
  });

  const employmentStatusMutation = useMutation({
    mutationFn: async ({ id, employmentStatus }: { id: string; employmentStatus: "relieved" | "left_company" | "active" }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}/employment-status`, { employmentStatus });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      const label = variables.employmentStatus === "relieved" ? "relieved" : "marked as left company";
      toast({ title: `User ${label}`, description: "The user has been updated and can no longer log in." });
      setConfirmOpen(false);
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update employment status", description: error?.message || "Something went wrong", variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) => {
      return apiRequest("POST", `/api/admin/users/${id}/reset-password`, { newPassword });
    },
    onSuccess: () => {
      toast({ title: "Password reset successfully", description: "The user's password has been updated and their 2FA has been disabled." });
      setResetPasswordOpen(false);
      setResetPasswordUser(null);
      setNewPassword("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to reset password", description: error?.message || "You may not have permission.", variant: "destructive" });
    },
  });

  const assignShiftMutation = useMutation({
    mutationFn: async ({ id, shiftId, reason }: { id: string; shiftId: string; reason: string }) => {
      return apiRequest("PATCH", `/api/hr/users/${id}/shift`, { shiftId, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/users", shiftUser?.id, "shift-history"] });
      toast({ title: "Shift assigned", description: "The employee's shift has been updated." });
      setSelectedShiftId("");
      setShiftReason("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign shift", description: error?.message || "Something went wrong", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const filteredUsers = users?.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.firstName.toLowerCase().includes(search.toLowerCase()) ||
      u.lastName.toLowerCase().includes(search.toLowerCase())
  );

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin";
  const canManageUsers = isSuperAdmin || isAdmin || user?.role === "manager" || user?.role === "hr";
  const canEditHierarchy = isSuperAdmin || isAdmin || user?.role === "hr" || user?.role === "manager";
  const currentUserRank = roleRank[user?.role || ""] ?? 0;

  const canEditUser = (targetUser: AdminUser) => {
    if (!canManageUsers) return false;
    if (isSuperAdmin) return true;
    return currentUserRank > (roleRank[targetUser.role] ?? 0);
  };

  const canResetPassword = (targetUser: AdminUser) => {
    if (targetUser.id === user?.id) return false;
    return currentUserRank >= roleRank.manager && currentUserRank > (roleRank[targetUser.role] ?? 0);
  };

  const canDeleteUser = (targetUser: AdminUser) => {
    if (targetUser.id === user?.id) return false;
    return isSuperAdmin;
  };

  const openEditDialog = (adminUser: AdminUser) => {
    setEditUser(adminUser);
    setEditForm({
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      designation: adminUser.designation || "",
      departmentId: adminUser.departmentId || "",
      joiningDate: adminUser.joiningDate || "",
      salary: adminUser.salary || "",
      attendanceExempt: adminUser.attendanceExempt ?? false,
      trainingExempt: (adminUser as any).trainingExempt ?? false,
      employeeCategory: adminUser.employeeCategory || "experienced",
      employmentType: (adminUser as any).employmentType || "Full-time / Regular",
    });
    setEditOpen(true);
  };

  const openHierarchyDialog = (adminUser: AdminUser) => {
    setSelectedUser(adminUser);
    setHForm({
      managerId: adminUser.managerId || "",
      departmentId: adminUser.departmentId || "",
      designation: adminUser.designation || "",
      hierarchyLevel: adminUser.hierarchyLevel || "team_member",
    });
    setHierarchyOpen(true);
  };

  const getDeptName = (deptId: string | null) => {
    if (!deptId || !deptList) return "-";
    const d = deptList.find(dep => dep.id === deptId);
    return d?.name || "-";
  };

  const getManagerName = (managerId: string | null) => {
    if (!managerId || !users) return "-";
    const m = users.find(u => u.id === managerId);
    return m ? `${m.firstName} ${m.lastName}` : "-";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Team Management</h1>
            <p className="text-muted-foreground">
              Manage team members, roles, departments, and hierarchy
            </p>
          </div>
          {canManageUsers && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setBulkOpen(true); setBulkResults(null); setBulkFile(null); }} data-testid="button-bulk-upload">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
              <Button onClick={() => setInviteOpen(true)} data-testid="button-invite-user">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Role Permissions</CardTitle>
            <CardDescription>Only @hire-in.com domain emails can access the portal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(roleLabels).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Badge className={roleColors[key]}>{label}</Badge>
                  <p className="text-xs text-muted-foreground">
                    {key === "super_admin" && "Full access, manage users"}
                    {key === "admin" && "Full access, manage users"}
                    {key === "hr" && "HR, leaves, attendance, apps"}
                    {key === "operations" && "Jobs, apps, contacts"}
                    {key === "manager" && "Team attendance & leave approvals"}
                    {key === "employee" && "Dashboard access only"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>

        <div className="flex flex-wrap gap-2" data-testid="status-filter-tabs">
          {([
            { key: "active", label: "Active" },
            { key: "disabled", label: "Disabled" },
            { key: "relieved", label: "Relieved" },
            { key: "left_company", label: "Left Company" },
            { key: "deleted", label: "Deleted" },
          ] as const).map(({ key, label }) => (
            <Button
              key={key}
              variant={statusFilter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(key)}
              data-testid={`tab-${key}`}
            >
              {label} ({counts?.[key] ?? 0})
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Status</TableHead>
                    {(isSuperAdmin || isAdmin) && <TableHead>2FA</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: (isSuperAdmin || isAdmin) ? 12 : 11 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredUsers && filteredUsers.length > 0 ? (
                    filteredUsers.map((adminUser) => (
                      <TableRow
                        key={adminUser.id}
                        data-testid={`user-row-${adminUser.id}`}
                        className={`${statusFilter === "deleted" ? "opacity-60" : ""} ${(isSuperAdmin || isAdmin) ? "cursor-pointer hover:bg-muted/50" : ""}`}
                        onClick={(isSuperAdmin || isAdmin) ? (e) => {
                          if ((e.target as HTMLElement).closest("[data-dropdown-ignore]")) return;
                          setDossierUserId(adminUser.id);
                        } : undefined}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {adminUser.firstName} {adminUser.lastName}
                            {adminUser.role === "super_admin" && (
                              <Shield className="h-4 w-4 text-purple-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">{adminUser.employeeId || "-"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{adminUser.email}</TableCell>
                        <TableCell>
                          <Badge className={roleColors[adminUser.role] || roleColors.employee}>
                            {roleLabels[adminUser.role] || adminUser.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{getDeptName(adminUser.departmentId)}</TableCell>
                        <TableCell className="text-sm">{adminUser.designation || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {adminUser.hierarchyLevel ? (levelLabels[adminUser.hierarchyLevel] || adminUser.hierarchyLevel) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">{getManagerName(adminUser.managerId)}</TableCell>
                        <TableCell className="text-sm" data-testid={`text-joining-date-${adminUser.id}`}>
                          {adminUser.joiningDate ? format(new Date(adminUser.joiningDate + "T00:00:00"), "dd MMM yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          {adminUser.deletedAt ? (
                            <Badge variant="destructive" data-testid={`badge-status-${adminUser.id}`}>Deleted</Badge>
                          ) : adminUser.employmentStatus === "relieved" ? (
                            <Badge className="bg-orange-100 text-orange-800" data-testid={`badge-status-${adminUser.id}`}>Relieved</Badge>
                          ) : adminUser.employmentStatus === "left_company" ? (
                            <Badge className="bg-rose-100 text-rose-800" data-testid={`badge-status-${adminUser.id}`}>Left Company</Badge>
                          ) : (
                            <Badge variant={adminUser.isActive ? "default" : "secondary"} data-testid={`badge-status-${adminUser.id}`}>
                              {adminUser.isActive ? "Active" : "Disabled"}
                            </Badge>
                          )}
                        </TableCell>
                        {(isSuperAdmin || isAdmin) && (
                          <TableCell>
                            <Badge
                              variant={(adminUser as any).totpEnabled ? "default" : "outline"}
                              className={(adminUser as any).totpEnabled ? "bg-green-600" : "text-amber-600 border-amber-600"}
                              data-testid={`badge-2fa-${adminUser.id}`}
                            >
                              {(adminUser as any).totpEnabled ? "Enabled" : "Off"}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-right" data-dropdown-ignore="true">
                          {statusFilter === "deleted" ? (
                            canEditUser(adminUser) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); restoreMutation.mutate(adminUser.id); }}
                                disabled={restoreMutation.isPending}
                                data-testid={`button-restore-${adminUser.id}`}
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Restore
                              </Button>
                            )
                          ) : (canEditUser(adminUser) || canEditHierarchy || canResetPassword(adminUser)) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-actions-${adminUser.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canEditUser(adminUser) && (
                                  <DropdownMenuItem onClick={() => openEditDialog(adminUser)} data-testid={`menu-edit-profile-${adminUser.id}`}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit Profile
                                  </DropdownMenuItem>
                                )}
                                {canEditHierarchy && (
                                  <DropdownMenuItem onClick={() => openHierarchyDialog(adminUser)} data-testid={`menu-edit-hierarchy-${adminUser.id}`}>
                                    <Network className="h-4 w-4 mr-2" />
                                    Edit Hierarchy
                                  </DropdownMenuItem>
                                )}
                                {(isSuperAdmin || isAdmin || user?.role === "hr") && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setShiftUser(adminUser);
                                      setSelectedShiftId(adminUser.shiftId || "");
                                      setShiftReason("");
                                      setShiftOpen(true);
                                    }}
                                    data-testid={`menu-assign-shift-${adminUser.id}`}
                                  >
                                    <Clock className="h-4 w-4 mr-2" />
                                    Assign Shift
                                  </DropdownMenuItem>
                                )}
                                {canResetPassword(adminUser) && (
                                  <DropdownMenuItem
                                    onClick={() => { setResetPasswordUser(adminUser); setNewPassword(""); setResetPasswordOpen(true); }}
                                    data-testid={`menu-reset-password-${adminUser.id}`}
                                  >
                                    <KeyRound className="h-4 w-4 mr-2" />
                                    Reset Password
                                  </DropdownMenuItem>
                                )}
                                {canEditUser(adminUser) && adminUser.id !== user?.id && (
                                  <DropdownMenuItem
                                    onClick={() => resendInviteMutation.mutate(adminUser.id)}
                                    data-testid={`menu-resend-invite-${adminUser.id}`}
                                  >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Resend Invitation
                                  </DropdownMenuItem>
                                )}
                                {(isSuperAdmin || isAdmin) && adminUser.id !== user?.id && (adminUser as any).totpEnabled && (isSuperAdmin || (adminUser.role !== "super_admin" && adminUser.role !== "admin")) && (
                                  <DropdownMenuItem
                                    onClick={() => reset2FAMutation.mutate(adminUser.id)}
                                    data-testid={`menu-reset-2fa-${adminUser.id}`}
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Reset 2FA
                                  </DropdownMenuItem>
                                )}

                                {canEditUser(adminUser) && adminUser.id !== user?.id && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {currentUserRank > roleRank.admin && (
                                      <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ id: adminUser.id, role: "admin" })}>
                                        Set as Admin
                                      </DropdownMenuItem>
                                    )}
                                    {currentUserRank > roleRank.hr && (
                                      <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ id: adminUser.id, role: "hr" })}>
                                        Set as HR
                                      </DropdownMenuItem>
                                    )}
                                    {currentUserRank > roleRank.finance && (
                                      <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ id: adminUser.id, role: "finance" })}>
                                        Set as Finance
                                      </DropdownMenuItem>
                                    )}
                                    {currentUserRank > roleRank.operations && (
                                      <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ id: adminUser.id, role: "operations" })}>
                                        Set as Operations
                                      </DropdownMenuItem>
                                    )}
                                    {currentUserRank > roleRank.manager && (
                                      <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ id: adminUser.id, role: "manager" })}>
                                        Set as Manager
                                      </DropdownMenuItem>
                                    )}
                                    {currentUserRank > roleRank.recruiter && (
                                      <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ id: adminUser.id, role: "recruiter" })}>
                                        Set as Recruiter
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ id: adminUser.id, role: "employee" })}>
                                      Set as Employee
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {canEditUser(adminUser) && adminUser.id !== user?.id && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {(!adminUser.employmentStatus || adminUser.employmentStatus === "active") && (
                                      <DropdownMenuItem
                                        onClick={() => { setConfirmAction({ type: adminUser.isActive ? "disable" : "enable", user: adminUser }); setConfirmOpen(true); }}
                                        data-testid={`menu-toggle-active-${adminUser.id}`}
                                      >
                                        {adminUser.isActive ? (
                                          <><UserX className="h-4 w-4 mr-2 text-amber-600" /><span className="text-amber-600">Disable</span></>
                                        ) : (
                                          <><UserCheck className="h-4 w-4 mr-2 text-green-600" /><span className="text-green-600">Enable</span></>
                                        )}
                                      </DropdownMenuItem>
                                    )}
                                    {adminUser.employmentStatus !== "relieved" && adminUser.employmentStatus !== "left_company" && (
                                      <DropdownMenuItem
                                        onClick={() => { setConfirmAction({ type: "relieve", user: adminUser }); setConfirmOpen(true); }}
                                        data-testid={`menu-relieve-${adminUser.id}`}
                                      >
                                        <Briefcase className="h-4 w-4 mr-2 text-orange-600" />
                                        <span className="text-orange-600">Mark as Relieved</span>
                                      </DropdownMenuItem>
                                    )}
                                    {adminUser.employmentStatus !== "left_company" && adminUser.employmentStatus !== "relieved" && (
                                      <DropdownMenuItem
                                        onClick={() => { setConfirmAction({ type: "left_company_exit", user: adminUser }); setConfirmOpen(true); }}
                                        data-testid={`menu-left-company-${adminUser.id}`}
                                      >
                                        <LogOut className="h-4 w-4 mr-2 text-rose-600" />
                                        <span className="text-rose-600">Mark as Left Company</span>
                                      </DropdownMenuItem>
                                    )}
                                    {canDeleteUser(adminUser) && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => { setConfirmAction({ type: "delete", user: adminUser }); setConfirmOpen(true); }}
                                          data-testid={`menu-delete-${adminUser.id}`}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                                          <span className="text-destructive">Delete</span>
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Invite Dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>Add a new team member. They'll receive an email with login credentials.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" placeholder="John" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} data-testid="input-invite-first-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" placeholder="Doe" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} data-testid="input-invite-last-name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="user@hire-in.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} data-testid="input-invite-email" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currentUserRank > roleRank.admin && <SelectItem value="admin">Admin</SelectItem>}
                      {currentUserRank > roleRank.hr && <SelectItem value="hr">HR</SelectItem>}
                      {currentUserRank > roleRank.finance && <SelectItem value="finance">Finance</SelectItem>}
                      {currentUserRank > roleRank.operations && <SelectItem value="operations">Operations</SelectItem>}
                      {currentUserRank > roleRank.manager && <SelectItem value="manager">Manager</SelectItem>}
                      {currentUserRank > roleRank.recruiter && <SelectItem value="recruiter">Recruiter</SelectItem>}
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hierarchyLevel">Level</Label>
                  <Select value={newHierarchyLevel} onValueChange={setNewHierarchyLevel}>
                    <SelectTrigger data-testid="select-invite-level"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ceo">CEO</SelectItem>
                      <SelectItem value="vp">Vice President</SelectItem>
                      <SelectItem value="director">Director</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="team_lead">Team Lead</SelectItem>
                      <SelectItem value="delivery_manager">Delivery Manager</SelectItem>
                      <SelectItem value="team_member">Team Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="joiningDate">Joining Date</Label>
                  <Input id="joiningDate" type="date" value={newJoiningDate} onChange={(e) => setNewJoiningDate(e.target.value)} data-testid="input-invite-joining-date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="designation">Designation</Label>
                  <Select value={newDesignation} onValueChange={setNewDesignation}>
                    <SelectTrigger data-testid="select-invite-designation"><SelectValue placeholder="Select designation" /></SelectTrigger>
                    <SelectContent>
                      {DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeCategory">Employee Category</Label>
                <Select value={newEmployeeCategory} onValueChange={setNewEmployeeCategory}>
                  <SelectTrigger data-testid="select-invite-employee-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="experienced">Experienced</SelectItem>
                    <SelectItem value="fresher">Fresher</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salary">Salary</Label>
                  <Input id="salary" type="number" placeholder="e.g. 85000" value={newSalary} onChange={(e) => setNewSalary(e.target.value)} data-testid="input-invite-salary" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reportingTo">Reporting To</Label>
                  <Select value={newManagerId} onValueChange={setNewManagerId}>
                    <SelectTrigger data-testid="select-invite-manager"><SelectValue placeholder="Select manager" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No manager</SelectItem>
                      {users?.filter(u => u.isActive).map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department <span className="text-destructive">*</span></Label>
                <Select value={newDepartmentId} onValueChange={setNewDepartmentId}>
                  <SelectTrigger data-testid="select-invite-department"><SelectValue placeholder="Select department (required)" /></SelectTrigger>
                  <SelectContent>
                    {deptList?.filter(d => d.isActive).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!newDepartmentId && <p className="text-xs text-destructive">Department is required to auto-assign training tracks.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={newGender} onValueChange={setNewGender}>
                  <SelectTrigger data-testid="select-invite-gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => inviteMutation.mutate({
                  email: newEmail, firstName: newFirstName, lastName: newLastName, role: newRole,
                  joiningDate: newJoiningDate || undefined, designation: newDesignation || undefined,
                  departmentId: newDepartmentId && newDepartmentId !== "none" ? newDepartmentId : undefined,
                  hierarchyLevel: newHierarchyLevel || undefined,
                  salary: newSalary || undefined,
                  managerId: newManagerId && newManagerId !== "none" ? newManagerId : undefined,
                  gender: newGender || undefined,
                  employeeCategory: newEmployeeCategory,
                } as any)}
                disabled={!newEmail.endsWith("@hire-in.com") || !newFirstName.trim() || !newLastName.trim() || !newDepartmentId || newDepartmentId === "none" || inviteMutation.isPending}
                data-testid="button-send-invite"
              >
                {inviteMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Profile Dialog */}
        <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditUser(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Update details for {editUser?.firstName} {editUser?.lastName} ({editUser?.email})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={editForm.firstName} onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))} data-testid="input-edit-first-name" />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={editForm.lastName} onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))} data-testid="input-edit-last-name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Select value={editForm.designation || ""} onValueChange={(v) => setEditForm(prev => ({ ...prev, designation: v }))}>
                  <SelectTrigger data-testid="select-edit-designation"><SelectValue placeholder="Select designation" /></SelectTrigger>
                  <SelectContent>
                    {DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Salary</Label>
                <Input type="number" value={editForm.salary} onChange={(e) => setEditForm(prev => ({ ...prev, salary: e.target.value }))} placeholder="e.g. 85000" data-testid="input-edit-salary" />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={editForm.departmentId || "none"} onValueChange={(v) => setEditForm(prev => ({ ...prev, departmentId: v }))}>
                  <SelectTrigger data-testid="select-edit-department"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Department</SelectItem>
                    {deptList?.filter(d => d.isActive).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Joining Date</Label>
                <Input type="date" value={editForm.joiningDate} onChange={(e) => setEditForm(prev => ({ ...prev, joiningDate: e.target.value }))} data-testid="input-edit-joining-date" />
              </div>
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select value={editForm.employmentType} onValueChange={(v) => setEditForm(prev => ({ ...prev, employmentType: v }))}>
                  <SelectTrigger data-testid="select-edit-employment-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time / Regular">Full-time / Regular</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Employee Category</Label>
                <Select value={editForm.employeeCategory} onValueChange={(v) => setEditForm(prev => ({ ...prev, employeeCategory: v }))}>
                  <SelectTrigger data-testid="select-edit-employee-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="experienced">Experienced</SelectItem>
                    <SelectItem value="fresher">Fresher</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(isSuperAdmin || isAdmin || user?.role === "hr") && (
                <div className="rounded-lg border p-3 space-y-3">
                  <Label className="text-sm font-medium">Exemption Flags</Label>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Attendance Exempt</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Exempt from punch in/out requirements.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editForm.attendanceExempt}
                      onClick={() => setEditForm(prev => ({ ...prev, attendanceExempt: !prev.attendanceExempt }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${editForm.attendanceExempt ? "bg-primary" : "bg-input"}`}
                      data-testid="toggle-attendance-exempt"
                    >
                      <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${editForm.attendanceExempt ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Training Exempt</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Exempt from training compliance lock.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editForm.trainingExempt}
                      onClick={() => setEditForm(prev => ({ ...prev, trainingExempt: !prev.trainingExempt }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${editForm.trainingExempt ? "bg-primary" : "bg-input"}`}
                      data-testid="toggle-training-exempt"
                    >
                      <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${editForm.trainingExempt ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!editUser) return;
                  updateUserMutation.mutate({
                    id: editUser.id,
                    data: {
                      firstName: editForm.firstName,
                      lastName: editForm.lastName,
                      designation: editForm.designation || null,
                      departmentId: editForm.departmentId === "none" ? null : editForm.departmentId || null,
                      joiningDate: editForm.joiningDate || null,
                      salary: editForm.salary || null,
                      attendanceExempt: editForm.attendanceExempt,
                      trainingExempt: editForm.trainingExempt,
                      employeeCategory: editForm.employeeCategory,
                      employmentType: editForm.employmentType,
                    },
                  });
                }}
                disabled={!editForm.firstName.trim() || !editForm.lastName.trim() || updateUserMutation.isPending}
                data-testid="button-save-edit"
              >
                {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hierarchy Dialog */}
        <Dialog open={hierarchyOpen} onOpenChange={setHierarchyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Hierarchy</DialogTitle>
              <DialogDescription>
                Update {selectedUser?.firstName} {selectedUser?.lastName}'s position in the organization.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={hForm.departmentId} onValueChange={(v) => setHForm(prev => ({ ...prev, departmentId: v }))}>
                  <SelectTrigger data-testid="select-hierarchy-department"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Department</SelectItem>
                    {deptList?.filter(d => d.isActive).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Designation / Title</Label>
                <Select value={hForm.designation || ""} onValueChange={(v) => setHForm(prev => ({ ...prev, designation: v }))}>
                  <SelectTrigger data-testid="select-hierarchy-designation"><SelectValue placeholder="Select designation" /></SelectTrigger>
                  <SelectContent>
                    {DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hierarchy Level</Label>
                <Select value={hForm.hierarchyLevel} onValueChange={(v) => {
                  const updates: any = { hierarchyLevel: v };
                  if (TOP_LEVELS.includes(v)) { updates.departmentId = "none"; updates.managerId = "none"; }
                  setHForm(prev => ({ ...prev, ...updates }));
                }}>
                  <SelectTrigger data-testid="select-hierarchy-level"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ceo">CEO</SelectItem>
                    <SelectItem value="vp">Vice President</SelectItem>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="team_lead">Team Lead</SelectItem>
                    <SelectItem value="delivery_manager">Delivery Manager</SelectItem>
                    <SelectItem value="team_member">Team Member</SelectItem>
                  </SelectContent>
                </Select>
                {TOP_LEVELS.includes(hForm.hierarchyLevel) && (
                  <p className="text-xs text-muted-foreground">Top leadership is above all departments with no reporting manager.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Reports To (Manager)</Label>
                <Select value={hForm.managerId} onValueChange={(v) => setHForm(prev => ({ ...prev, managerId: v }))}>
                  <SelectTrigger data-testid="select-hierarchy-manager"><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Manager (Top Level)</SelectItem>
                    {users?.filter(u => u.id !== selectedUser?.id && u.isActive).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setHierarchyOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!selectedUser) return;
                  hierarchyMutation.mutate({
                    id: selectedUser.id,
                    data: {
                      managerId: hForm.managerId === "none" ? null : hForm.managerId || null,
                      departmentId: hForm.departmentId === "none" ? null : hForm.departmentId || null,
                      designation: hForm.designation || null,
                      hierarchyLevel: hForm.hierarchyLevel,
                    },
                  });
                }}
                disabled={hierarchyMutation.isPending}
                data-testid="button-save-hierarchy"
              >
                {hierarchyMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Shift Dialog */}
        <Dialog open={shiftOpen} onOpenChange={(open) => { setShiftOpen(open); if (!open) { setShiftUser(null); setSelectedShiftId(""); setShiftReason(""); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Assign Shift
              </DialogTitle>
              <DialogDescription>
                {shiftUser ? `Updating shift for ${shiftUser.firstName} ${shiftUser.lastName}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {shiftUser && shiftUser.shiftId && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm flex-wrap">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Current shift:</span>
                  <Badge variant="secondary" data-testid="badge-current-shift-admin">
                    {shiftDefs?.find(s => s.id === shiftUser.shiftId!)?.displayLabel || shiftUser.shiftId}
                  </Badge>
                  {(() => {
                    const s = shiftDefs?.find(s => s.id === shiftUser.shiftId!);
                    if (!s) return null;
                    return <span className="text-xs text-muted-foreground ml-1">IST {s.istStart}–{s.istEnd} ({s.isDst ? "DST" : "STD"})</span>;
                  })()}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="shift-select">New Shift *</Label>
                <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                  <SelectTrigger data-testid="select-shift" id="shift-select">
                    <SelectValue placeholder="Select a shift..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(shiftDefs || []).map(s => (
                      <SelectItem key={s.id} value={s.id} data-testid={`shift-option-${s.id}`}>
                        {s.displayLabel} — IST {s.istStart}–{s.istEnd} ({s.isDst ? "DST" : "STD"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-reason">Reason for change *</Label>
                <Textarea
                  id="shift-reason"
                  data-testid="input-shift-reason"
                  value={shiftReason}
                  onChange={e => setShiftReason(e.target.value)}
                  placeholder="Why is the shift being changed?"
                  rows={3}
                />
              </div>
              {shiftHistory && shiftHistory.length > 0 && (
                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <History className="h-3 w-3" /> Recent shift changes
                  </p>
                  {shiftHistory.slice(0, 5).map(entry => (
                    <div key={entry.id} className="text-xs border-b last:border-0 pb-2 last:pb-0" data-testid={`shift-history-entry-${entry.id}`}>
                      <div className="flex gap-1 items-center flex-wrap">
                        <span className="text-muted-foreground">{entry.old_shift_label || "None"}</span>
                        <span>→</span>
                        <span className="font-medium">{entry.new_shift_label || "None"}</span>
                      </div>
                      <p className="text-muted-foreground">{new Date(entry.changed_at).toLocaleDateString()} · {entry.changed_by_name}</p>
                      <p className="italic truncate">"{entry.reason}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShiftOpen(false)} data-testid="button-cancel-shift">Cancel</Button>
              <Button
                data-testid="button-save-shift"
                disabled={!selectedShiftId || !shiftReason.trim() || assignShiftMutation.isPending}
                onClick={() => {
                  if (shiftUser && selectedShiftId && shiftReason.trim()) {
                    assignShiftMutation.mutate({ id: shiftUser.id, shiftId: selectedShiftId, reason: shiftReason.trim() });
                  }
                }}
              >
                {assignShiftMutation.isPending ? "Saving..." : "Assign Shift"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={resetPasswordOpen} onOpenChange={(open) => { setResetPasswordOpen(open); if (!open) { setResetPasswordUser(null); setNewPassword(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Set a new password for {resetPasswordUser?.firstName} {resetPasswordUser?.lastName} ({resetPasswordUser?.email}). This will also disable their 2FA.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input id="newPassword" type="password" placeholder="Minimum 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} data-testid="input-reset-password" />
                {newPassword.length > 0 && newPassword.length < 8 && (
                  <p className="text-xs text-destructive">Password must be at least 8 characters</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetPasswordOpen(false)}>Cancel</Button>
              <Button
                onClick={() => { if (resetPasswordUser) resetPasswordMutation.mutate({ id: resetPasswordUser.id, newPassword }); }}
                disabled={newPassword.length < 8 || resetPasswordMutation.isPending}
                data-testid="button-confirm-reset-password"
              >
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Action Dialog (Disable/Enable/Delete/Relieve/Left Company) */}
        <Dialog open={confirmOpen} onOpenChange={(open) => { setConfirmOpen(open); if (!open) setConfirmAction(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${confirmAction?.type === "delete" ? "text-destructive" : confirmAction?.type === "relieve" ? "text-orange-500" : confirmAction?.type === "left_company_exit" ? "text-rose-500" : "text-amber-500"}`} />
                {confirmAction?.type === "delete" && "Delete User"}
                {confirmAction?.type === "disable" && "Disable User"}
                {confirmAction?.type === "enable" && "Enable User"}
                {confirmAction?.type === "relieve" && "Mark as Relieved"}
                {confirmAction?.type === "left_company_exit" && "Mark as Left Company"}
              </DialogTitle>
              <DialogDescription>
                {confirmAction?.type === "delete" && (
                  <>Are you sure you want to delete <strong>{confirmAction.user.firstName} {confirmAction.user.lastName}</strong> ({confirmAction.user.email})? The user will be moved to the Deleted tab and can be restored later.</>
                )}
                {confirmAction?.type === "disable" && (
                  <>Are you sure you want to disable <strong>{confirmAction.user.firstName} {confirmAction.user.lastName}</strong>? They will no longer be able to log in.</>
                )}
                {confirmAction?.type === "enable" && (
                  <>Re-enable <strong>{confirmAction.user.firstName} {confirmAction.user.lastName}</strong>? They will be able to log in again.</>
                )}
                {confirmAction?.type === "relieve" && (
                  <>Mark <strong>{confirmAction.user.firstName} {confirmAction.user.lastName}</strong> as Relieved (involuntary exit)? They will be moved to the Relieved tab and can no longer log in.</>
                )}
                {confirmAction?.type === "left_company_exit" && (
                  <>Mark <strong>{confirmAction.user.firstName} {confirmAction.user.lastName}</strong> as Left Company (voluntary resignation)? They will be moved to the Left Company tab and can no longer log in.</>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              {confirmAction?.type === "delete" && (
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(confirmAction.user.id)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete User"}
                </Button>
              )}
              {confirmAction?.type === "disable" && (
                <Button
                  variant="default"
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => toggleActiveMutation.mutate({ id: confirmAction.user.id, isActive: false })}
                  disabled={toggleActiveMutation.isPending}
                  data-testid="button-confirm-disable"
                >
                  {toggleActiveMutation.isPending ? "Disabling..." : "Disable User"}
                </Button>
              )}
              {confirmAction?.type === "enable" && (
                <Button
                  onClick={() => toggleActiveMutation.mutate({ id: confirmAction.user.id, isActive: true })}
                  disabled={toggleActiveMutation.isPending}
                  data-testid="button-confirm-enable"
                >
                  {toggleActiveMutation.isPending ? "Enabling..." : "Enable User"}
                </Button>
              )}
              {confirmAction?.type === "relieve" && (
                <Button
                  variant="default"
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => employmentStatusMutation.mutate({ id: confirmAction.user.id, employmentStatus: "relieved" })}
                  disabled={employmentStatusMutation.isPending}
                  data-testid="button-confirm-relieve"
                >
                  {employmentStatusMutation.isPending ? "Updating..." : "Mark as Relieved"}
                </Button>
              )}
              {confirmAction?.type === "left_company_exit" && (
                <Button
                  variant="default"
                  className="bg-rose-600 hover:bg-rose-700"
                  onClick={() => employmentStatusMutation.mutate({ id: confirmAction.user.id, employmentStatus: "left_company" })}
                  disabled={employmentStatusMutation.isPending}
                  data-testid="button-confirm-left-company"
                >
                  {employmentStatusMutation.isPending ? "Updating..." : "Mark as Left Company"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Upload Dialog */}
        <Dialog open={bulkOpen} onOpenChange={(open) => { setBulkOpen(open); if (!open) { setBulkResults(null); setBulkFile(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Bulk Upload Users
              </DialogTitle>
              <DialogDescription>
                Upload a CSV or XLSX file to create multiple users at once. Each user will receive an invitation email.
              </DialogDescription>
            </DialogHeader>

            {!bulkResults ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">
                    {bulkFile ? bulkFile.name : "Choose a CSV or XLSX file"}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">Maximum file size: 5MB</p>
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    className="max-w-xs mx-auto"
                    data-testid="input-bulk-file"
                  />
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold">Column Format:</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => {
                        const headers = ["First Name","Last Name","Email","Designation","Reporting Manager","Salary","Department","Role","Joining Date"];
                        const sample = ["John","Doe","john.doe@hire-in.com","Software Engineer","Jane Smith","85000","Engineering","employee","2025-03-01"];
                        const csv = [headers.join(","), sample.join(",")].join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "bulk_upload_template.csv";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      data-testid="button-download-template"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Template
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                    <span>First Name *</span>
                    <span>Last Name *</span>
                    <span>Email *</span>
                    <span>Designation</span>
                    <span>Reporting Manager</span>
                    <span>Salary</span>
                    <span>Department</span>
                    <span>Role</span>
                    <span>Joining Date</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    * Required. Reporting Manager should match "First Last" name of an existing user. Role defaults to "employee".
                  </p>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => { if (bulkFile) bulkUploadMutation.mutate(bulkFile); }}
                    disabled={!bulkFile || bulkUploadMutation.isPending}
                    data-testid="button-start-upload"
                  >
                    {bulkUploadMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" /> Upload & Create Users</>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{bulkResults.summary.created}</p>
                      <p className="text-xs text-muted-foreground">Created</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-amber-600">{bulkResults.summary.skipped}</p>
                      <p className="text-xs text-muted-foreground">Skipped</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{bulkResults.summary.failed}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </CardContent>
                  </Card>
                </div>

                {bulkResults.results.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Row</TableHead>
                          <TableHead className="text-xs">Email</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bulkResults.results.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{r.row}</TableCell>
                            <TableCell className="text-xs font-mono">{r.email}</TableCell>
                            <TableCell>
                              {r.status === "created" && <Badge className="bg-green-100 text-green-800 text-[10px]">Created</Badge>}
                              {r.status === "skipped" && <Badge className="bg-amber-100 text-amber-800 text-[10px]">Skipped</Badge>}
                              {r.status === "failed" && <Badge className="bg-red-100 text-red-800 text-[10px]">Failed</Badge>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.error || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <DialogFooter>
                  <Button onClick={() => setBulkOpen(false)} data-testid="button-close-bulk-results">
                    Done
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Employee Dossier Sheet - super_admin and admin only */}
      {(isSuperAdmin || isAdmin) && (
        <EmployeeDossierSheet
          userId={dossierUserId}
          onClose={() => setDossierUserId(null)}
        />
      )}
    </AdminLayout>
  );
}
