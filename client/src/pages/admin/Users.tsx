import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Shield, UserPlus, Trash2 } from "lucide-react";
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
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr: "HR",
  operations: "Operations",
  employee: "Employee",
};

const roleColors: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800",
  hr: "bg-green-100 text-green-800",
  operations: "bg-orange-100 text-orange-800",
  employee: "bg-gray-100 text-gray-800",
};

export default function AdminUsers() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("employee");

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      return apiRequest("POST", "/api/admin/users", { email, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User invited successfully" });
      setInviteOpen(false);
      setNewEmail("");
      setNewRole("employee");
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User removed" });
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
    (u) => u.email.toLowerCase().includes(search.toLowerCase())
  );

  const isSuperAdmin = user?.email === "simranjeet@hire-in.com";

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Team Management</h1>
            <p className="text-muted-foreground">
              Manage admin users and their roles
            </p>
          </div>
          {isSuperAdmin && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          )}
        </div>

        {/* Role Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Role Permissions</CardTitle>
            <CardDescription>
              Only @hire-in.com domain emails can access the admin portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1">
                <Badge className={roleColors.super_admin}>Super Admin</Badge>
                <p className="text-xs text-muted-foreground">Full access, can manage users</p>
              </div>
              <div className="space-y-1">
                <Badge className={roleColors.admin}>Admin</Badge>
                <p className="text-xs text-muted-foreground">Full access, cannot manage users</p>
              </div>
              <div className="space-y-1">
                <Badge className={roleColors.hr}>HR</Badge>
                <p className="text-xs text-muted-foreground">Applications & contacts only</p>
              </div>
              <div className="space-y-1">
                <Badge className={roleColors.operations}>Operations</Badge>
                <p className="text-xs text-muted-foreground">Jobs management only</p>
              </div>
              <div className="space-y-1">
                <Badge className={roleColors.employee}>Employee</Badge>
                <p className="text-xs text-muted-foreground">Read-only dashboard access</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
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

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers && filteredUsers.length > 0 ? (
                  filteredUsers.map((adminUser) => (
                    <TableRow key={adminUser.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {adminUser.email}
                          {adminUser.email === "simranjeet@hire-in.com" && (
                            <Shield className="h-4 w-4 text-purple-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={roleColors[adminUser.role] || roleColors.employee}>
                          {roleLabels[adminUser.role] || adminUser.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={adminUser.isActive ? "default" : "secondary"}>
                          {adminUser.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isSuperAdmin && adminUser.email !== "simranjeet@hire-in.com" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  updateRoleMutation.mutate({
                                    id: adminUser.id,
                                    role: "admin",
                                  })
                                }
                              >
                                Set as Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateRoleMutation.mutate({
                                    id: adminUser.id,
                                    role: "hr",
                                  })
                                }
                              >
                                Set as HR
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateRoleMutation.mutate({
                                    id: adminUser.id,
                                    role: "operations",
                                  })
                                }
                              >
                                Set as Operations
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateRoleMutation.mutate({
                                    id: adminUser.id,
                                    role: "employee",
                                  })
                                }
                              >
                                Set as Employee
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(adminUser.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Invite User Dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Add a new team member to the admin portal. They must have an @hire-in.com email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger data-testid="select-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => inviteMutation.mutate({ email: newEmail, role: newRole })}
                disabled={!newEmail.endsWith("@hire-in.com") || inviteMutation.isPending}
                data-testid="button-send-invite"
              >
                Send Invite
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
