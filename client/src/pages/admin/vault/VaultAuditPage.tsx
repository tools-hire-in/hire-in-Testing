import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Eye, Copy, Lock, AlertTriangle, Users, Edit2, Trash2, UserMinus, KeyRound } from "lucide-react";

const ACTION_META: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  reveal_password: { label: "Revealed Password", icon: Eye, color: "text-orange-600" },
  copy_password: { label: "Copied Password", icon: Copy, color: "text-blue-600" },
  copy_username: { label: "Copied Username", icon: Copy, color: "text-blue-400" },
  create_secret: { label: "Created Secret", icon: KeyRound, color: "text-green-600" },
  edit_secret: { label: "Edited Secret", icon: Edit2, color: "text-indigo-600" },
  archive_secret: { label: "Archived Secret", icon: Trash2, color: "text-gray-600" },
  create_vault: { label: "Created Vault", icon: KeyRound, color: "text-green-700" },
  edit_vault: { label: "Edited Vault", icon: Edit2, color: "text-indigo-700" },
  grant_access: { label: "Granted Access", icon: Users, color: "text-green-600" },
  revoke_access: { label: "Revoked Access", icon: Users, color: "text-red-600" },
  failed_access: { label: "Failed Access Attempt", icon: AlertTriangle, color: "text-red-700" },
  totp_failed: { label: "TOTP Verification Failed", icon: Lock, color: "text-red-800" },
  exit_revoke: { label: "Exit Revocation", icon: UserMinus, color: "text-red-600" },
};

const ALL_ACTIONS = Object.keys(ACTION_META);

type AuditLog = {
  id: string; actorId: string; secretId?: string; vaultId?: string;
  action: string; ipHash?: string; reason?: string; meta?: string; createdAt: string;
};

export default function VaultAuditPage() {
  const { enabled: newLook } = useNewLook();
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [filters, setFilters] = useState({
    actorId: "", action: "", secretId: "", from: "", to: "",
  });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const params = new URLSearchParams();
  if (applied.actorId) params.set("actorId", applied.actorId);
  if (applied.action && applied.action !== "all") params.set("action", applied.action);
  if (applied.secretId) params.set("secretId", applied.secretId);
  if (applied.from) params.set("from", applied.from);
  if (applied.to) params.set("to", applied.to);
  params.set("limit", PAGE_SIZE.toString());
  params.set("offset", (page * PAGE_SIZE).toString());

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: [`/api/vault-audit-logs?${params.toString()}`],
    enabled: isAdmin,
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="p-6 text-center py-20 text-muted-foreground">Access restricted to Admins only.</div>
      </AdminLayout>
    );
  }

  const getUserName = (id: string) => {
    const u = users.find((u: any) => u.id === id);
    return u ? `${u.firstName} ${u.lastName}` : id.slice(0, 8) + "…";
  };

  return (
    <AdminLayout>
      <div className="v2-surface p-6 max-w-6xl mx-auto space-y-6">
        {newLook ? (
          <V2PageHeader
            icon={Shield}
            eyebrow="Vault"
            title="Vault Audit Log"
            subtitle="All credential access events. Retention: Low = 3 months, Medium = 6 months, High = 12 months, Critical = indefinite."
          />
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Vault Audit Log</h1>
              <p className="text-sm text-muted-foreground">
                All credential access events. Retention: Low = 3 months, Medium = 6 months, High = 12 months, Critical = indefinite.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-end border rounded-lg p-4 bg-muted/30">
          <div className="space-y-1">
            <Label className="text-xs">Action</Label>
            <Select value={filters.action} onValueChange={v => setFilters(f => ({ ...f, action: v }))}>
              <SelectTrigger className="w-52 h-8 text-xs" data-testid="select-filter-action">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ALL_ACTIONS.map(a => (
                  <SelectItem key={a} value={a}>{ACTION_META[a]?.label ?? a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">From Date</Label>
            <Input
              type="date"
              value={filters.from}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
              className="h-8 text-xs w-40"
              data-testid="input-filter-from"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To Date</Label>
            <Input
              type="date"
              value={filters.to}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
              className="h-8 text-xs w-40"
              data-testid="input-filter-to"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Actor ID</Label>
            <Input
              value={filters.actorId}
              onChange={e => setFilters(f => ({ ...f, actorId: e.target.value }))}
              placeholder="User ID"
              className="h-8 text-xs w-48"
              data-testid="input-filter-actor"
            />
          </div>
          <Button
            size="sm"
            onClick={() => { setApplied(filters); setPage(0); }}
            data-testid="button-apply-filters"
          >
            Apply Filters
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { const reset = { actorId: "", action: "", secretId: "", from: "", to: "" }; setFilters(reset); setApplied(reset); setPage(0); }}
            data-testid="button-reset-filters"
          >
            Reset
          </Button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading audit logs…</div>
        ) : !logs.length ? (
          <div className="py-16 text-center text-muted-foreground text-sm">No audit log entries found.</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Secret / Vault</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>IP Hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => {
                  const meta = ACTION_META[log.action];
                  const Icon = meta?.icon ?? Shield;
                  return (
                    <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{getUserName(log.actorId)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta?.color ?? "text-foreground"}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {meta?.label ?? log.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {log.secretId ? log.secretId.slice(0, 12) + "…" : log.vaultId ? `vault:${log.vaultId.slice(0, 8)}…` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {log.reason || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {log.ipHash ? log.ipHash.slice(0, 12) + "…" : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + logs.length} of {logs.length < PAGE_SIZE ? "all" : "many"} entries
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">← Prev</Button>
            <Button size="sm" variant="outline" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">Next →</Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
