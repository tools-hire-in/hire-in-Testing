import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Clock, UserPlus, Pencil, KeyRound, Mail, Trash2, Network } from "lucide-react";

interface AuditLogEntry {
  id: string;
  actorId: string;
  targetId: string | null;
  action: string;
  changes: any;
  createdAt: string;
  actorName: string;
  actorEmail: string;
  targetName: string;
  targetEmail: string | null;
}

const ACTION_LABELS: Record<string, { label: string; icon: typeof UserPlus; color: string }> = {
  create_user: { label: "Created User", icon: UserPlus, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  update_user: { label: "Updated User", icon: Pencil, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  reset_password: { label: "Reset Password", icon: KeyRound, color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  resend_invite: { label: "Resent Invitation", icon: Mail, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  delete_user: { label: "Deleted User", icon: Trash2, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  update_hierarchy: { label: "Updated Hierarchy", icon: Network, color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function ChangeSummary({ action, changes }: { action: string; changes: any }) {
  if (!changes) return null;

  if (action === "create_user") {
    return (
      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
        {changes.email && <div>Email: {changes.email}</div>}
        {changes.role && <div>Role: {changes.role}</div>}
        {changes.designation && <div>Designation: {changes.designation}</div>}
      </div>
    );
  }

  if (action === "update_user" && changes.before && changes.after) {
    const changedKeys = Object.keys(changes.after).filter(k => k !== "password");
    if (changedKeys.length === 0 && changes.after.password) {
      return <div className="text-xs text-muted-foreground mt-1">Password changed</div>;
    }
    return (
      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
        {changedKeys.map(key => (
          <div key={key}>
            <span className="font-medium">{key}</span>: {String(changes.before[key] ?? "-")} → {String(changes.after[key] ?? "-")}
          </div>
        ))}
      </div>
    );
  }

  if (action === "update_hierarchy" && changes.before && changes.after) {
    const keys = Object.keys(changes.after);
    return (
      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
        {keys.map(key => {
          if (changes.before[key] === changes.after[key]) return null;
          return (
            <div key={key}>
              <span className="font-medium">{key}</span>: {String(changes.before[key] ?? "-")} → {String(changes.after[key] ?? "-")}
            </div>
          );
        })}
      </div>
    );
  }

  if (action === "delete_user" && changes.email) {
    return (
      <div className="text-xs text-muted-foreground mt-1">
        {changes.name} ({changes.email}) — Role: {changes.role}
      </div>
    );
  }

  if (action === "reset_password" && changes.targetEmail) {
    return <div className="text-xs text-muted-foreground mt-1">For: {changes.targetEmail}</div>;
  }

  if (action === "resend_invite" && changes.email) {
    return <div className="text-xs text-muted-foreground mt-1">To: {changes.email}</div>;
  }

  return null;
}

export function AuditLogsContent() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("all");
  const pageSize = 25;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  const queryParams = new URLSearchParams({
    limit: String(pageSize),
    offset: String(page * pageSize),
  });
  if (actionFilter !== "all") queryParams.set("action", actionFilter);

  const { data, isLoading } = useQuery<{ logs: AuditLogEntry[]; total: number }>({
    queryKey: ["/api/admin/audit-logs", { page, action: actionFilter }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-logs?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isAuthenticated && (user?.role === "super_admin" || user?.role === "admin"),
  });

  if (authLoading || !isAuthenticated) return null;

  if (user?.role !== "super_admin" && user?.role !== "admin") {
    return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">You do not have permission to view audit logs.</p>
        </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-audit-logs-title">Audit Logs</h1>
            <p className="text-muted-foreground">Track all user management changes</p>
          </div>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-48" data-testid="select-audit-filter">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create_user">User Created</SelectItem>
              <SelectItem value="update_user">User Updated</SelectItem>
              <SelectItem value="reset_password">Password Reset</SelectItem>
              <SelectItem value="resend_invite">Invitation Resent</SelectItem>
              <SelectItem value="update_hierarchy">Hierarchy Updated</SelectItem>
              <SelectItem value="delete_user">User Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : data?.logs && data.logs.length > 0 ? (
              <div className="space-y-3">
                {data.logs.map((log) => {
                  const actionInfo = ACTION_LABELS[log.action] || { label: log.action, icon: Clock, color: "bg-muted text-muted-foreground" };
                  const IconComponent = actionInfo.icon;
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-md border" data-testid={`audit-log-${log.id}`}>
                      <div className="mt-0.5">
                        <IconComponent className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={actionInfo.color}>{actionInfo.label}</Badge>
                          <span className="text-sm font-medium">{log.actorName}</span>
                          {log.targetName && log.targetName !== "Unknown" && (
                            <span className="text-sm text-muted-foreground">→ {log.targetName}</span>
                          )}
                        </div>
                        <ChangeSummary action={log.action} changes={log.changes} />
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(log.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No audit logs found</p>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages} ({data?.total} total entries)
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="button-audit-prev">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-audit-next">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}

export default function AuditLogs() {
  return (
    <AdminLayout>
      <AuditLogsContent />
    </AdminLayout>
  );
}
