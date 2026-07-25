import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Inbox,
  CheckCircle2,
  ChevronRight,
  Clock,
  AlertTriangle,
  Calendar,
  ArrowUpRight,
  History,
  Loader2,
  ShieldAlert,
  FileText,
  Users,
  ClipboardCheck,
  CalendarClock,
  GraduationCap,
  UserCog,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";

// ── Types ──────────────────────────────────────────────────────────────────

interface InboxItem {
  id: string | null;
  itemType: string;
  itemId: string;
  employeeName: string;
  employeeId: string | null;
  description: string;
  status: "new" | "deferred" | "escalated" | "resolved";
  assigneeTier: "manager" | "hr_admin" | "super_admin";
  deferUntil: string | null;
  escalatedAt: string | null;
  escalationReason: string | null;
  originalAssignedAt: string;
  createdAt: string;
  waitingHours: number;
  isApproachingCap: boolean;
  isOverCap: boolean;
  typeLabel: string;
  deepLink: string;
}

interface InboxResponse {
  items: InboxItem[];
  total: number;
}

interface AuditEntry {
  id: string;
  action: string;
  note: string | null;
  created_at: string;
  actor_name: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ITEM_TYPE_ICONS: Record<string, any> = {
  leave_approval: Calendar,
  offer_letter: FileText,
  probation_checkin: Users,
  attendance_correction: ClipboardCheck,
  pip_checkin: AlertTriangle,
  training_compliance: GraduationCap,
};

const ITEM_TYPE_ORDER = [
  "leave_approval",
  "offer_letter",
  "attendance_correction",
  "probation_checkin",
  "pip_checkin",
  "training_compliance",
];

const STATUS_META: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  deferred: { label: "Deferred", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  escalated: { label: "Escalated", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

function formatWaiting(hours: number): string {
  if (hours < 1) return "Just now";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${Math.round(hours % 24)}h`;
}

// ── Defer Popover ──────────────────────────────────────────────────────────

function DeferPopover({ item, onDeferred }: { item: InboxItem; onDeferred: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Default defer to 4 hours from now; max cap is today + 2 days
  const defaultDeferStr = () => {
    const d = new Date(Date.now() + 4 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
  };
  const maxDeferStr = () => {
    const d = new Date(Date.now() + 48 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  };

  const [deferDateStr, setDeferDateStr] = useState<string>(defaultDeferStr);

  const deferMut = useMutation({
    mutationFn: ({ itemType, itemId, deferUntil }: { itemType: string; itemId: string; deferUntil: string }) =>
      apiRequest("POST", `/api/inbox/${itemType}/${itemId}/defer`, { deferUntil }),
    onSuccess: () => {
      toast({ title: "Item deferred", description: "Removed from your active inbox until the selected time." });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      onDeferred();
    },
    onError: (err: any) => {
      toast({ title: "Could not defer", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  function handleDefer() {
    const deferUntil = new Date(deferDateStr).toISOString();
    deferMut.mutate({ itemType: item.itemType, itemId: item.itemId, deferUntil });
  }

  return (
    <Popover open={open} onOpenChange={(v) => { if (v) setDeferDateStr(defaultDeferStr()); setOpen(v); }}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          data-testid={`button-defer-${item.itemType}-${item.itemId}`}
          disabled={item.isOverCap}
        >
          <CalendarClock className="h-3 w-3" />
          Defer
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-3 space-y-3" align="end">
        <p className="text-xs font-medium">Defer until (max 48 h from now)</p>
        <input
          type="datetime-local"
          className="w-full text-xs border rounded px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          value={deferDateStr}
          min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
          max={maxDeferStr()}
          onChange={(e) => setDeferDateStr(e.target.value)}
          data-testid={`defer-datetime-${item.itemType}-${item.itemId}`}
        />
        <Button
          size="sm"
          className="w-full h-7 text-xs"
          onClick={handleDefer}
          disabled={deferMut.isPending || !deferDateStr}
          data-testid={`button-confirm-defer-${item.itemType}-${item.itemId}`}
        >
          {deferMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm Defer"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ── Escalate Dialog ────────────────────────────────────────────────────────

function EscalateDialog({ item, open, onClose }: { item: InboxItem; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  const escalateMut = useMutation({
    mutationFn: ({ itemType, itemId, reason }: { itemType: string; itemId: string; reason: string }) =>
      apiRequest("POST", `/api/inbox/${itemType}/${itemId}/escalate`, { reason }),
    onSuccess: () => {
      toast({ title: "Item escalated", description: "The next tier has been notified." });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      setReason("");
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Escalation failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm" data-testid="escalate-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-orange-500" />
            Escalate Item
          </DialogTitle>
          <DialogDescription>
            This will escalate <strong>{item.employeeName}</strong>'s {item.typeLabel} to the next tier and notify them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="escalate-reason" className="text-sm">
            Reason <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="escalate-reason"
            placeholder="Briefly describe why you're escalating (required)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            data-testid="input-escalate-reason"
          />
          {reason.trim().length > 0 && reason.trim().length < 5 && (
            <p className="text-xs text-red-500">Reason must be at least 5 characters.</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="button-cancel-escalate">
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => escalateMut.mutate({ itemType: item.itemType, itemId: item.itemId, reason })}
            disabled={escalateMut.isPending || reason.trim().length < 5}
            data-testid="button-confirm-escalate"
          >
            {escalateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Escalate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── History Popover ────────────────────────────────────────────────────────

function HistoryPopover({ item }: { item: InboxItem }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<{ history: AuditEntry[] }>({
    queryKey: ["/api/inbox/audit", item.itemType, item.itemId],
    queryFn: async () => {
      const res = await fetch(`/api/inbox/audit/${item.itemType}/${item.itemId}`, { credentials: "include" });
      if (!res.ok) return { history: [] };
      return res.json();
    },
    enabled: open,
    staleTime: 30000,
  });

  const ACTION_LABELS: Record<string, string> = {
    deferred: "Deferred",
    escalated: "Escalated",
    auto_escalated: "Auto-escalated",
    act_clicked: "Acted",
    resolved: "Resolved",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1 text-muted-foreground"
          data-testid={`button-history-${item.itemType}-${item.itemId}`}
        >
          <History className="h-3 w-3" />
          History
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-xs font-semibold mb-2">Triage history</p>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.history?.length ? (
          <p className="text-xs text-muted-foreground">No actions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {data.history.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.created_at).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">by {entry.actor_name}</p>
                {entry.note && <p className="text-[11px] text-muted-foreground italic">{entry.note}</p>}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Reassign Dialog (HR/Admin/Super Admin) ─────────────────────────────────

function ReassignDialog({ item, open, onClose }: { item: InboxItem; open: boolean; onClose: () => void }) {
  const [targetUserId, setTargetUserId] = useState("");
  const [note, setNote] = useState("");
  const { toast } = useToast();

  const { data: eligibleUsers } = useQuery<{ id: string; name: string; role: string }[]>({
    queryKey: ["/api/inbox/eligible-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?roles=manager,hr,admin,super_admin&isActive=true", { credentials: "include" });
      if (!res.ok) return [];
      const users = await res.json();
      return (users as any[]).map((u: any) => ({
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
        role: u.role,
      }));
    },
    enabled: open,
    staleTime: 60000,
  });

  const reassignMut = useMutation({
    mutationFn: ({ targetUserId, note }: { targetUserId: string; note: string }) =>
      apiRequest("POST", `/api/inbox/${item.itemType}/${item.itemId}/reassign`, { targetUserId, note }),
    onSuccess: () => {
      toast({ title: "Item reassigned", description: "The inbox item has been reassigned." });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      onClose();
      setTargetUserId("");
      setNote("");
    },
    onError: (err: any) => {
      toast({ title: "Reassignment failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm" data-testid="reassign-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-blue-500" />
            Reassign Item
          </DialogTitle>
          <DialogDescription>
            Reassign this item to another team member's inbox.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Assign to <span className="text-red-500">*</span></Label>
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger data-testid="select-reassign-target">
                <SelectValue placeholder="Select a person..." />
              </SelectTrigger>
              <SelectContent>
                {(eligibleUsers ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} <span className="text-muted-foreground text-xs">({u.role})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Note (optional)</Label>
            <Textarea
              placeholder="Reason for reassignment..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              data-testid="input-reassign-note"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="button-cancel-reassign">Cancel</Button>
          <Button
            size="sm"
            onClick={() => reassignMut.mutate({ targetUserId, note })}
            disabled={reassignMut.isPending || !targetUserId}
            data-testid="button-confirm-reassign"
          >
            {reassignMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reassign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Resolve Dialog (HR/Admin/Super Admin) ──────────────────────────────────

function ResolveDialog({ item, open, onClose }: { item: InboxItem; open: boolean; onClose: () => void }) {
  const [note, setNote] = useState("");
  const { toast } = useToast();

  const resolveMut = useMutation({
    mutationFn: ({ note }: { note: string }) =>
      apiRequest("POST", `/api/inbox/${item.itemType}/${item.itemId}/resolve`, { note }),
    onSuccess: () => {
      toast({ title: "Item resolved", description: "The item has been marked as resolved across all tiers." });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      onClose();
      setNote("");
    },
    onError: (err: any) => {
      toast({ title: "Resolve failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm" data-testid="resolve-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Resolve Item
          </DialogTitle>
          <DialogDescription>
            Mark <strong>{item.employeeName}</strong>'s {item.typeLabel} as resolved. This clears the item across all tiers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-sm">Note (optional)</Label>
          <Textarea
            placeholder="Resolution note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            data-testid="input-resolve-note"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="button-cancel-resolve">Cancel</Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => resolveMut.mutate({ note })}
            disabled={resolveMut.isPending}
            data-testid="button-confirm-resolve"
          >
            {resolveMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark Resolved"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Inbox Row ──────────────────────────────────────────────────────────────

function InboxRow({ item, role }: { item: InboxItem; role: string }) {
  const [, setLocation] = useLocation();
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const { toast } = useToast();

  const canReassign = ["super_admin", "hr", "admin"].includes(role);
  const canResolve = ["super_admin", "hr", "admin"].includes(role);

  const actMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/inbox/${item.itemType}/${item.itemId}/act`, {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      // Navigate to the deep-link returned by backend (logs act_clicked, does not resolve row)
      setLocation(data?.deepLink ?? item.deepLink);
    },
    onError: () => setLocation(item.deepLink),
  });

  const Icon = ITEM_TYPE_ICONS[item.itemType] ?? FileText;
  const statusMeta = STATUS_META[item.status] ?? STATUS_META.new;
  const isUrgent = item.isOverCap || item.isApproachingCap;

  return (
    <>
      <div
        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
          isUrgent
            ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/10"
            : "border-border bg-card hover:bg-muted/30"
        }`}
        data-testid={`inbox-row-${item.itemType}-${item.itemId}`}
      >
        {/* Icon */}
        <div className={`mt-0.5 rounded-md p-1.5 shrink-0 ${isUrgent ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-medium truncate" data-testid={`text-inbox-employee-${item.itemType}-${item.itemId}`}>
              {item.employeeName}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusMeta.className}`}
              data-testid={`badge-inbox-status-${item.itemType}-${item.itemId}`}
            >
              {statusMeta.label}
            </span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              data-testid={`badge-inbox-tier-${item.itemType}-${item.itemId}`}
            >
              {item.assigneeTier === "hr_admin" ? "HR/Admin" : item.assigneeTier === "super_admin" ? "Super Admin" : "Manager"}
            </span>
            {isUrgent && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />
                {item.isOverCap ? "Cap reached" : "Approaching cap"}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5 shrink-0" />
            <span data-testid={`text-inbox-waiting-${item.itemType}-${item.itemId}`}>
              {formatWaiting(item.waitingHours)}
              {item.deferUntil && item.status === "deferred" && (
                <> · deferred until {new Date(item.deferUntil).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</>
              )}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs gap-1"
            onClick={() => actMut.mutate()}
            disabled={actMut.isPending}
            data-testid={`button-act-${item.itemType}-${item.itemId}`}
          >
            {actMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3 w-3" />}
            Act
          </Button>

          <DeferPopover item={item} onDeferred={() => {}} />

          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-orange-600 border-orange-300 hover:bg-orange-50 dark:border-orange-700 dark:hover:bg-orange-950/30"
            onClick={() => setEscalateOpen(true)}
            data-testid={`button-escalate-${item.itemType}-${item.itemId}`}
          >
            <ArrowUpRight className="h-3 w-3" />
            Escalate
          </Button>

          {canReassign && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              onClick={() => setReassignOpen(true)}
              data-testid={`button-reassign-${item.itemType}-${item.itemId}`}
            >
              <UserCog className="h-3 w-3" />
              Reassign
            </Button>
          )}

          {canResolve && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
              onClick={() => setResolveOpen(true)}
              data-testid={`button-resolve-${item.itemType}-${item.itemId}`}
            >
              <CheckCircle2 className="h-3 w-3" />
              Resolve
            </Button>
          )}

          <HistoryPopover item={item} />
        </div>
      </div>

      <EscalateDialog item={item} open={escalateOpen} onClose={() => setEscalateOpen(false)} />
      {canReassign && <ReassignDialog item={item} open={reassignOpen} onClose={() => setReassignOpen(false)} />}
      {canResolve && <ResolveDialog item={item} open={resolveOpen} onClose={() => setResolveOpen(false)} />}
    </>
  );
}

// ── Type Group ─────────────────────────────────────────────────────────────

function TypeGroup({ typeKey, items, role }: { typeKey: string; items: InboxItem[]; role: string }) {
  const Icon = ITEM_TYPE_ICONS[typeKey] ?? FileText;
  const label = items[0]?.typeLabel ?? typeKey;
  const urgentCount = items.filter((i) => i.isOverCap || i.isApproachingCap).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold" data-testid={`text-inbox-group-${typeKey}`}>{label}</h3>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {items.length}
        </Badge>
        {urgentCount > 0 && (
          <Badge className="text-[10px] h-4 px-1.5 bg-red-500 text-white hover:bg-red-500">
            {urgentCount} urgent
          </Badge>
        )}
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <InboxRow key={`${item.itemType}:${item.itemId}`} item={item} role={role} />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function InboxPage() {
  const { user } = useAuth();
  const role = (user as any)?.role ?? "";

  const INBOX_ROLES = ["manager", "hr", "admin", "super_admin"];
  const hasAccess = INBOX_ROLES.includes(role);

  const { data, isLoading, error } = useQuery<InboxResponse>({
    queryKey: ["/api/inbox"],
    queryFn: async () => {
      const res = await fetch("/api/inbox", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load inbox");
      return res.json();
    },
    enabled: hasAccess,
    staleTime: 30000,
    refetchInterval: 120000,
  });

  const items = data?.items ?? [];

  // Group by item type, in display order
  const grouped: Record<string, InboxItem[]> = {};
  for (const type of ITEM_TYPE_ORDER) {
    const group = items.filter((i) => i.itemType === type);
    if (group.length > 0) grouped[type] = group;
  }

  const totalUrgent = items.filter((i) => i.isOverCap || i.isApproachingCap).length;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6 py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary shrink-0">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-inbox-title">
                Manager Inbox
              </h1>
              <p className="text-sm text-muted-foreground">
                Action items requiring your attention — escalates automatically after 48 hours.
              </p>
            </div>
          </div>

          {totalUrgent > 0 && (
            <Badge className="bg-red-500 text-white hover:bg-red-500 gap-1" data-testid="badge-inbox-urgent">
              <AlertTriangle className="h-3 w-3" />
              {totalUrgent} urgent
            </Badge>
          )}
        </div>

        {/* No access */}
        {!hasAccess && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Inbox className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">You don't have access to the Manager Inbox.</p>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {hasAccess && isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error */}
        {hasAccess && !isLoading && error && (
          <Card className="border-red-200">
            <CardContent className="flex items-center gap-3 py-6">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">
                Failed to load inbox. Please refresh the page.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {hasAccess && !isLoading && !error && items.length === 0 && (
          <Card data-testid="inbox-empty-state">
            <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="rounded-full bg-green-100 p-4 dark:bg-green-950/30">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold">All clear!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No pending action items right now. Check back later.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grouped items */}
        {hasAccess && !isLoading && !error && items.length > 0 && (
          <div className="space-y-6">
            {Object.entries(grouped).map(([typeKey, groupItems]) => (
              <TypeGroup key={typeKey} typeKey={typeKey} items={groupItems} role={role} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
