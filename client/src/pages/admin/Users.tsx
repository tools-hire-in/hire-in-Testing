import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Shield, UserPlus, Trash2, Building2, Network, Mail, KeyRound } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AdminUser } from "@shared/schema";

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
  operations: "Operations",
  manager: "Manager",
  employee: "Employee",
};

const roleColors: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800",
  hr: "bg-green-100 text-green-800",
  operations: "bg-orange-100 text-orange-800",
  manager: "bg-violet-100 text-violet-800",
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

  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [hierarchyOpen, setHierarchyOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [hForm, setHForm] = useState({
    managerId: "" as string,
    departmentId: "" as string,
    designation: "",
    hierarchyLevel: "team_member",
  });

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated,
  });

  const { data: deptList } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: isAuthenticated,
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; firstName: string; lastName: string; role: string; joiningDate?: string; designation?: string; departmentId?: string; hierarchyLevel?: string }) => {
      return apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User invited successfully", description: "An invitation email with login credentials has been sent." });
      setInviteOpen(false);
      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      setNewRole("employee");
      setNewJoiningDate("");
      setNewDesignation("");
      setNewDepartmentId("");
      setNewHierarchyLevel("team_member");
    },
    onError: () => {
      toast({
        title: "Failed to invite user",
        description: "Please ensure the email ends with @hire-in.com",
        variant: "destructive",
      });
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User removed" });
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
      toast({
        title: "Failed to reset password",
        description: error?.message || "You may not have permission to reset this user's password.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const filteredUsers = users?.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.firstName.toLowerCase().includes(search.toLowerCase()) ||
      u.lastName.toLowerCase().includes(search.toLowerCase())
  );

  const isSuperAdmin = user?.role === "super_admin";
  const canManageUsers = user?.role === "super_admin" || user?.role === "admin" || user?.role === "manager";
  const canEditHierarchy = user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr" || user?.role === "manager";

  const roleRank: Record<string, number> = {
    super_admin: 6, admin: 5, hr: 4, operations: 3, manager: 2, employee: 1,
  };
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
            <h1 className="text-3xl font-bold">Team Management</h1>
            <p className="text-muted-foreground">
              Manage admin users, roles, departments, and hierarchy
            </p>
          </div>
          {canManageUsers && (
            <Button onClick={() => setInviteOpen(true)} data-testid="button-invite-user">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Role Permissions</CardTitle>
            <CardDescription>
              Only @hire-in.com domain emails can access the admin portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="space-y-1">
                <Badge className={roleColors.super_admin}>Super Admin</Badge>
                <p className="text-xs text-muted-foreground">Full access, can manage users</p>
              </div>
              <div className="space-y-1">
                <Badge className={roleColors.admin}>Admin</Badge>
                <p className="text-xs text-muted-foreground">Full access, can manage users</p>
              </div>
              <div className="space-y-1">
                <Badge className={roleColors.hr}>HR</Badge>
                <p className="text-xs text-muted-foreground">HR, leaves, attendance, apps</p>
              </div>
              <div className="space-y-1">
                <Badge className={roleColors.operations}>Operations</Badge>
                <p className="text-xs text-muted-foreground">Jobs, apps, contacts</p>
              </div>
              <div className="space-y-1">
                <Badge className={roleColors.manager}>Manager</Badge>
                <p className="text-xs text-muted-foreground">Team attendance & leave approvals</p>
              </div>
              <div className="space-y-1">
                <Badge className={roleColors.employee}>Employee</Badge>
                <p className="text-xs text-muted-foreground">Dashboard access only</p>
              </div>
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

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredUsers && filteredUsers.length > 0 ? (
                    filteredUsers.map((adminUser) => (
                      <TableRow key={adminUser.id} data-testid={`user-row-${adminUser.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {adminUser.firstName} {adminUser.lastName}
                            {adminUser.email === "simranjeet@hire-in.com" && (
                              <Shield className="h-4 w-4 text-purple-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{adminUser.email}</TableCell>
                        <TableCell>
                          <Badge className={roleColors[adminUser.role] || roleColors.employee}>
                            {roleLabels[adminUser.role] || adminUser.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {getDeptName(adminUser.departmentId)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {adminUser.designation || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {adminUser.hierarchyLevel ? (levelLabels[adminUser.hierarchyLevel] || adminUser.hierarchyLevel) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getManagerName(adminUser.managerId)}
                        </TableCell>
                        <TableCell className="text-sm" data-testid={`text-joining-date-${adminUser.id}`}>
                          {adminUser.joiningDate ? format(new Date(adminUser.joiningDate + "T00:00:00"), "dd MMM yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={adminUser.isActive ? "default" : "secondary"}>
                            {adminUser.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {(canEditUser(adminUser) || canEditHierarchy || canResetPassword(adminUser)) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-actions-${adminUser.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canEditHierarchy && (
                                  <DropdownMenuItem onClick={() => openHierarchyDialog(adminUser)} data-testid={`menu-edit-hierarchy-${adminUser.id}`}>
                                    <Network className="h-4 w-4 mr-2" />
                                    Edit Hierarchy
                                  </DropdownMenuItem>
                                )}
                                {canResetPassword(adminUser) && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setResetPasswordUser(adminUser);
                                      setNewPassword("");
                                      setResetPasswordOpen(true);
                                    }}
                                    data-testid={`menu-reset-password-${adminUser.id}`}
                                  >
                                    <KeyRound className="h-4 w-4 mr-2" />
                                    Reset Password
                                  </DropdownMenuItem>
                                )}
                                {canEditUser(adminUser) && adminUser.email !== "simranjeet@hire-in.com" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => resendInviteMutation.mutate(adminUser.id)}
                                      data-testid={`menu-resend-invite-${adminUser.id}`}
                                    >
                                      <Mail className="h-4 w-4 mr-2" />
                                      Resend Invitation
                                    </DropdownMenuItem>
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
                                    <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ id: adminUser.id, role: "employee" })}>
                                      Set as Employee
                                    </DropdownMenuItem>
                                    {isSuperAdmin && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => deleteMutation.mutate(adminUser.id)}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Remove
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
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Add a new team member. They'll receive an email with login credentials.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    data-testid="input-invite-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    data-testid="input-invite-last-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@hire-in.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  data-testid="input-invite-email"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger data-testid="select-invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentUserRank > roleRank.admin && <SelectItem value="admin">Admin</SelectItem>}
                      {currentUserRank > roleRank.hr && <SelectItem value="hr">HR</SelectItem>}
                      {currentUserRank > roleRank.operations && <SelectItem value="operations">Operations</SelectItem>}
                      {currentUserRank > roleRank.manager && <SelectItem value="manager">Manager</SelectItem>}
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hierarchyLevel">Level</Label>
                  <Select value={newHierarchyLevel} onValueChange={setNewHierarchyLevel}>
                    <SelectTrigger data-testid="select-invite-level">
                      <SelectValue />
                    </SelectTrigger>
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
                  <Input
                    id="joiningDate"
                    type="date"
                    value={newJoiningDate}
                    onChange={(e) => setNewJoiningDate(e.target.value)}
                    data-testid="input-invite-joining-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="designation">Designation</Label>
                  <Input
                    id="designation"
                    placeholder="e.g. Software Engineer"
                    value={newDesignation}
                    onChange={(e) => setNewDesignation(e.target.value)}
                    data-testid="input-invite-designation"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select value={newDepartmentId} onValueChange={setNewDepartmentId}>
                  <SelectTrigger data-testid="select-invite-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Department</SelectItem>
                    {deptList?.filter(d => d.isActive).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => inviteMutation.mutate({
                  email: newEmail,
                  firstName: newFirstName,
                  lastName: newLastName,
                  role: newRole,
                  joiningDate: newJoiningDate || undefined,
                  designation: newDesignation || undefined,
                  departmentId: newDepartmentId && newDepartmentId !== "none" ? newDepartmentId : undefined,
                  hierarchyLevel: newHierarchyLevel || undefined,
                })}
                disabled={!newEmail.endsWith("@hire-in.com") || !newFirstName.trim() || !newLastName.trim() || inviteMutation.isPending}
                data-testid="button-send-invite"
              >
                {inviteMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
                  <SelectTrigger data-testid="select-hierarchy-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
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
                <Input
                  value={hForm.designation}
                  onChange={(e) => setHForm(prev => ({ ...prev, designation: e.target.value }))}
                  placeholder="e.g. Senior Software Engineer, HR Manager"
                  data-testid="input-hierarchy-designation"
                />
              </div>
              <div className="space-y-2">
                <Label>Hierarchy Level</Label>
                <Select value={hForm.hierarchyLevel} onValueChange={(v) => {
                  const updates: any = { hierarchyLevel: v };
                  if (TOP_LEVELS.includes(v)) {
                    updates.departmentId = "none";
                    updates.managerId = "none";
                  }
                  setHForm(prev => ({ ...prev, ...updates }));
                }}>
                  <SelectTrigger data-testid="select-hierarchy-level">
                    <SelectValue />
                  </SelectTrigger>
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
                  <SelectTrigger data-testid="select-hierarchy-manager">
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
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

        <Dialog open={resetPasswordOpen} onOpenChange={(open) => {
          setResetPasswordOpen(open);
          if (!open) {
            setResetPasswordUser(null);
            setNewPassword("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Set a new password for {resetPasswordUser?.firstName} {resetPasswordUser?.lastName} ({resetPasswordUser?.email}). This will also disable their two-factor authentication.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-reset-password"
                />
                {newPassword.length > 0 && newPassword.length < 8 && (
                  <p className="text-xs text-destructive">Password must be at least 8 characters</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetPasswordOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!resetPasswordUser) return;
                  resetPasswordMutation.mutate({ id: resetPasswordUser.id, newPassword });
                }}
                disabled={newPassword.length < 8 || resetPasswordMutation.isPending}
                data-testid="button-confirm-reset-password"
              >
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
