import { useEffect, useMemo, useState, useRef, KeyboardEvent } from "react";
import DOMPurify from "dompurify";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Inbox,
  ScrollText,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Mail,
  AlertTriangle,
  Send,
  Settings,
  Plus,
  Trash2,
  Save,
  Clock,
  Users,
  X,
} from "lucide-react";

type Policy = "auto" | "hold";

interface CommunicationTypeDef {
  key: string;
  label: string;
  description: string;
  category: string;
  scheduleLabel?: string;
  recipientRule?: string;
}

interface CommunicationLog {
  id: string;
  type: string;
  sourceJob: string | null;
  recipients: string[];
  cc: string[];
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  status: string;
  error: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  sentAt: string | null;
  createdAt: string | null;
}

interface TypesResponse {
  types: CommunicationTypeDef[];
  policy: Record<string, Policy>;
}

interface LogsResponse {
  total: number;
  logs: CommunicationLog[];
}

interface CommConfig {
  typeKey: string;
  label: string;
  description: string;
  category: string;
  scheduleLabel: string | null;
  recipientRule: string | null;
  isCustom: boolean;
  enabled: boolean;
  cc: string[];
  extraTo: string[];
  updatedAt: string | null;
  updatedBy: string | null;
}

interface ConfigResponse {
  configs: CommConfig[];
}

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  held: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const CATEGORY_COLORS: Record<string, string> = {
  Payroll: "bg-blue-500",
  Attendance: "bg-violet-500",
  Onboarding: "bg-emerald-500",
  Content: "bg-orange-500",
  Custom: "bg-slate-400",
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

type CenterTab = "pending" | "activity" | "policy" | "configuration";

export function CommunicationsControlCenter() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [tab, setTab] = useState<CenterTab>("pending");

  const { data: typesData } = useQuery<TypesResponse>({
    queryKey: ["/api/admin/communications/types"],
  });
  const typeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    (typesData?.types ?? []).forEach((t) => map.set(t.key, t.label));
    return map;
  }, [typesData]);

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={(v) => setTab(v as CenterTab)}>
        <TabsList data-testid="tabs-comms-center">
          <TabsTrigger value="pending" data-testid="tab-comms-pending">
            <Inbox className="mr-1.5 h-4 w-4" />
            Pending Approvals
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-comms-activity">
            <ScrollText className="mr-1.5 h-4 w-4" />
            Activity Log
          </TabsTrigger>
          <TabsTrigger value="policy" data-testid="tab-comms-policy">
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            Policy
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="configuration" data-testid="tab-comms-configuration">
              <Settings className="mr-1.5 h-4 w-4" />
              Configuration
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {tab === "pending" && <PendingApprovals typeLabelMap={typeLabelMap} toast={toast} />}
      {tab === "activity" && <ActivityLog types={typesData?.types ?? []} typeLabelMap={typeLabelMap} />}
      {tab === "policy" && <PolicySettings typesData={typesData} toast={toast} />}
      {tab === "configuration" && isSuperAdmin && <ConfigurationPanel toast={toast} />}
    </div>
  );
}

function LogRow({
  log,
  typeLabelMap,
  selectable,
  selected,
  onToggle,
  actions,
}: {
  log: CommunicationLog;
  typeLabelMap: Map<string, string>;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border bg-card" data-testid={`row-comm-${log.id}`}>
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
        {selectable && (
          <Checkbox checked={selected} onCheckedChange={onToggle} data-testid={`checkbox-comm-${log.id}`} />
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-muted-foreground hover:text-foreground"
          data-testid={`button-expand-${log.id}`}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium truncate" data-testid={`text-subject-${log.id}`}>
              {log.subject}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {typeLabelMap.get(log.type) ?? log.type}
            </Badge>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[log.status] ?? "bg-muted text-muted-foreground"}`} data-testid={`badge-status-${log.id}`}>
              {log.status}
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            To: {log.recipients?.join(", ") || "—"} · {formatDateTime(log.createdAt)}
          </div>
        </div>
        {actions}
      </div>
      {open && (
        <div className="space-y-3 border-t bg-muted/30 px-4 py-3 text-sm">
          <div className="grid gap-1 text-xs sm:grid-cols-2">
            <div><span className="text-muted-foreground">Type:</span> {typeLabelMap.get(log.type) ?? log.type}</div>
            <div><span className="text-muted-foreground">Source:</span> {log.sourceJob ?? "—"}</div>
            <div><span className="text-muted-foreground">Recipients:</span> {log.recipients?.join(", ") || "—"}</div>
            <div><span className="text-muted-foreground">CC:</span> {log.cc?.length ? log.cc.join(", ") : "—"}</div>
            <div><span className="text-muted-foreground">Created:</span> {formatDateTime(log.createdAt)}</div>
            <div><span className="text-muted-foreground">Sent:</span> {formatDateTime(log.sentAt)}</div>
            {log.reviewedAt && <div><span className="text-muted-foreground">Reviewed:</span> {formatDateTime(log.reviewedAt)}</div>}
            {log.reviewNote && <div><span className="text-muted-foreground">Note:</span> {log.reviewNote}</div>}
          </div>
          {log.error && (
            <div className="flex items-start gap-2 rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-all">{log.error}</span>
            </div>
          )}
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Email preview</div>
            {log.bodyHtml ? (
              <div
                className="max-h-[420px] overflow-auto rounded border bg-white p-3 dark:bg-zinc-900"
                data-testid={`preview-html-${log.id}`}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(log.bodyHtml, { USE_PROFILES: { html: true } }) }}
              />
            ) : (
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded border bg-white p-3 text-xs dark:bg-zinc-900" data-testid={`preview-text-${log.id}`}>
                {log.bodyText ?? "(no content)"}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PendingApprovals({
  typeLabelMap,
  toast,
}: {
  typeLabelMap: Map<string, string>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<LogsResponse>({
    queryKey: ["/api/admin/communications", { status: "held" }],
  });
  const logs = data?.logs ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/communications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/communications/count"] });
  };

  const approve = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/admin/communications/${id}/approve`)).json(),
    onSuccess: () => { toast({ title: "Sent", description: "The email was approved and sent." }); invalidate(); },
    onError: (e: Error) => { toast({ title: "Could not send", description: e.message, variant: "destructive" }); invalidate(); },
  });
  const reject = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/admin/communications/${id}/reject`)).json(),
    onSuccess: () => { toast({ title: "Rejected", description: "The email was discarded." }); invalidate(); },
    onError: (e: Error) => { toast({ title: "Could not reject", description: e.message, variant: "destructive" }); invalidate(); },
  });
  const bulkApprove = useMutation({
    mutationFn: async (ids: string[]) => (await apiRequest("POST", "/api/admin/communications/bulk-approve", { ids })).json(),
    onSuccess: (r: { approved: number; failed: number }) => {
      toast({ title: "Bulk send complete", description: `${r.approved} sent${r.failed ? `, ${r.failed} failed` : ""}.` });
      setSelected(new Set()); invalidate();
    },
    onError: (e: Error) => toast({ title: "Bulk send failed", description: e.message, variant: "destructive" }),
  });
  const bulkReject = useMutation({
    mutationFn: async (ids: string[]) => (await apiRequest("POST", "/api/admin/communications/bulk-reject", { ids })).json(),
    onSuccess: (r: { rejected: number; failed: number }) => {
      toast({ title: "Bulk reject complete", description: `${r.rejected} discarded${r.failed ? `, ${r.failed} failed` : ""}.` });
      setSelected(new Set()); invalidate();
    },
    onError: (e: Error) => toast({ title: "Bulk reject failed", description: e.message, variant: "destructive" }),
  });

  const anyMutating = approve.isPending || reject.isPending || bulkApprove.isPending || bulkReject.isPending;

  const toggle = (id: string) => setSelected((p) => {
    const n = new Set(p);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const allSelected = logs.length > 0 && logs.every((l) => selected.has(l.id));
  const toggleAll = (checked: boolean) => setSelected(checked ? new Set(logs.map((l) => l.id)) : new Set());

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <p className="text-sm text-muted-foreground" data-testid="text-no-pending">No emails are waiting for approval.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2.5">
        <Checkbox checked={allSelected} onCheckedChange={(c) => toggleAll(!!c)} data-testid="checkbox-select-all" />
        <span className="text-sm" data-testid="text-pending-count">
          {selected.size > 0 ? `${selected.size} selected` : `${logs.length} awaiting approval`}
        </span>
        {selected.size > 0 && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={() => bulkApprove.mutate(Array.from(selected))} disabled={anyMutating} data-testid="button-bulk-approve">
              <Send className="mr-1.5 h-4 w-4" /> Approve & send
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkReject.mutate(Array.from(selected))} disabled={anyMutating} data-testid="button-bulk-reject">
              <XCircle className="mr-1.5 h-4 w-4" /> Reject
            </Button>
          </div>
        )}
      </div>

      {logs.map((log) => (
        <LogRow
          key={log.id}
          log={log}
          typeLabelMap={typeLabelMap}
          selectable
          selected={selected.has(log.id)}
          onToggle={() => toggle(log.id)}
          actions={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => approve.mutate(log.id)} disabled={anyMutating} data-testid={`button-approve-${log.id}`}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => reject.mutate(log.id)} disabled={anyMutating} data-testid={`button-reject-${log.id}`}>
                <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          }
        />
      ))}
    </div>
  );
}

function ActivityLog({
  types,
  typeLabelMap,
}: {
  types: CommunicationTypeDef[];
  typeLabelMap: Map<string, string>;
}) {
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [recipient, setRecipient] = useState<string>("");
  const [debouncedRecipient, setDebouncedRecipient] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRecipient(recipient.trim()), 300);
    return () => clearTimeout(t);
  }, [recipient]);

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (status !== "all") f.status = status;
    if (type !== "all") f.type = type;
    if (debouncedRecipient) f.recipient = debouncedRecipient;
    if (startDate) f.startDate = startDate;
    if (endDate) f.endDate = endDate;
    return f;
  }, [status, type, debouncedRecipient, startDate, endDate]);

  const hasFilters = status !== "all" || type !== "all" || !!debouncedRecipient || !!startDate || !!endDate;
  const clearFilters = () => {
    setStatus("all");
    setType("all");
    setRecipient("");
    setStartDate("");
    setEndDate("");
  };

  const { data, isLoading } = useQuery<LogsResponse>({
    queryKey: ["/api/admin/communications", filters],
  });
  const logs = data?.logs ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="held">Held</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[260px]" data-testid="select-type-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Filter by recipient email"
          className="w-[220px]"
          data-testid="input-recipient-filter"
        />
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="comm-start-date">From</label>
          <Input
            id="comm-start-date"
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[150px]"
            data-testid="input-start-date-filter"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="comm-end-date">To</label>
          <Input
            id="comm-end-date"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[150px]"
            data-testid="input-end-date-filter"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
            Clear
          </Button>
        )}
        <span className="text-xs text-muted-foreground" data-testid="text-activity-count">{logs.length} shown</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Mail className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-activity">No communications match these filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <LogRow key={log.id} log={log} typeLabelMap={typeLabelMap} />
          ))}
        </div>
      )}
    </div>
  );
}

function PolicySettings({
  typesData,
  toast,
}: {
  typesData: TypesResponse | undefined;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const types = typesData?.types ?? [];
  const policy = typesData?.policy ?? {};

  const mutation = useMutation({
    mutationFn: async (next: Record<string, Policy>) =>
      (await apiRequest("PUT", "/api/admin/communications/policy", { policy: next })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/communications/types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/communications/count"] });
    },
    onError: (e: Error) => toast({ title: "Could not update policy", description: e.message, variant: "destructive" }),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, CommunicationTypeDef[]>();
    for (const t of types) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return Array.from(map.entries());
  }, [types]);

  const setOne = (key: string, hold: boolean) => {
    mutation.mutate({ [key]: hold ? "hold" : "auto" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Send Policy</CardTitle>
          <CardDescription>
            For each automated email type, choose whether it sends automatically or is held for your approval first.
            Held emails appear under Pending Approvals.
          </CardDescription>
        </CardHeader>
      </Card>

      {grouped.map(([category, items]) => (
        <Card key={category}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {items.map((t) => {
              const hold = (policy[t.key] ?? "auto") === "hold";
              return (
                <div key={t.key} className="flex items-center justify-between gap-4 rounded-md px-2 py-2.5 hover:bg-muted/40" data-testid={`policy-row-${t.key}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`text-xs ${hold ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`} data-testid={`policy-state-${t.key}`}>
                      {hold ? "Hold for approval" : "Auto-send"}
                    </span>
                    <Switch
                      checked={hold}
                      onCheckedChange={(c) => setOne(t.key, c)}
                      disabled={mutation.isPending}
                      data-testid={`switch-policy-${t.key}`}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ==========================================
// EMAIL TAG INPUT
// ==========================================

function EmailTagInput({
  emails,
  onChange,
  placeholder = "Add email and press Enter",
  disabled,
  testIdPrefix,
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  testIdPrefix?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addEmail = (val: string) => {
    const clean = val.trim().toLowerCase();
    if (!clean) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return;
    if (!emails.includes(clean)) {
      onChange([...emails, clean]);
    }
    setInput("");
  };

  const removeEmail = (email: string) => {
    onChange(emails.filter((e) => e !== email));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEmail(input);
    } else if (e.key === "Backspace" && !input && emails.length > 0) {
      removeEmail(emails[emails.length - 1]);
    }
  };

  return (
    <div
      className="flex min-h-9 flex-wrap gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm focus-within:ring-1 focus-within:ring-ring cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {emails.map((email) => (
        <span
          key={email}
          className="inline-flex items-center gap-1 rounded-full bg-[#F47C20]/15 px-2 py-0.5 text-xs font-medium text-[#F47C20] dark:bg-[#F47C20]/20"
          data-testid={`tag-email-${testIdPrefix}-${email}`}
        >
          {email}
          {!disabled && (
            <button
              type="button"
              onClick={(ev) => { ev.stopPropagation(); removeEmail(email); }}
              className="ml-0.5 text-[#F47C20]/60 hover:text-[#F47C20]"
              data-testid={`button-remove-tag-${testIdPrefix}-${email}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addEmail(input)}
          placeholder={emails.length === 0 ? placeholder : ""}
          className="min-w-[180px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          data-testid={`input-email-tag-${testIdPrefix}`}
        />
      )}
    </div>
  );
}

// ==========================================
// CONFIGURATION PANEL
// ==========================================

function ConfigurationPanel({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const { data, isLoading } = useQuery<ConfigResponse>({
    queryKey: ["/api/admin/communication-config"],
  });

  const configs = data?.configs ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, CommConfig[]>();
    for (const c of configs) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const order = ["Payroll", "Attendance", "Onboarding", "Content", "Custom"];
      return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99);
    });
  }, [configs]);

  const [showAddForm, setShowAddForm] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/communication-config"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/communications/types"] });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Communication Configuration</CardTitle>
              <CardDescription>
                Configure the enabled state and CC recipients for every automated email type.
                System type schedules and recipient rules are defined in code and shown for reference only.
                Custom types registered here appear in the Policy tab alongside system types.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddForm((v) => !v)}
              data-testid="button-add-comm-type"
              className="shrink-0"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Type
            </Button>
          </div>
        </CardHeader>
      </Card>

      {showAddForm && (
        <AddCustomTypeForm
          toast={toast}
          onClose={() => setShowAddForm(false)}
          onSaved={() => { invalidate(); setShowAddForm(false); }}
        />
      )}

      {grouped.map(([category, items]) => (
        <CategoryGroup
          key={category}
          category={category}
          items={items}
          toast={toast}
          onDeleted={invalidate}
          onSaved={invalidate}
        />
      ))}
    </div>
  );
}

function CategoryGroup({
  category,
  items,
  toast,
  onDeleted,
  onSaved,
}: {
  category: string;
  items: CommConfig[];
  toast: ReturnType<typeof useToast>["toast"];
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const accentColor = CATEGORY_COLORS[category] ?? "bg-slate-400";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${accentColor}`} />
          <CardTitle className="text-sm font-semibold">{category}</CardTitle>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {items.map((cfg) => (
          <ConfigRow
            key={cfg.typeKey}
            config={cfg}
            toast={toast}
            onDeleted={onDeleted}
            onSaved={onSaved}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ConfigRow({
  config,
  toast,
  onDeleted,
  onSaved,
}: {
  config: CommConfig;
  toast: ReturnType<typeof useToast>["toast"];
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const [cc, setCc] = useState<string[]>(config.cc ?? []);
  const [enabled, setEnabled] = useState(config.enabled);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setCc(config.cc ?? []);
    setEnabled(config.enabled);
    setDirty(false);
  }, [config]);

  const save = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/admin/communication-config/${config.typeKey}`, { enabled, cc })).json(),
    onSuccess: () => {
      toast({ title: "Saved", description: `${config.label} updated.` });
      setDirty(false);
      onSaved();
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async () => (await apiRequest("DELETE", `/api/admin/communication-config/${config.typeKey}`)).json(),
    onSuccess: () => {
      toast({ title: "Deleted", description: `${config.label} removed.` });
      onDeleted();
    },
    onError: (e: Error) => toast({ title: "Could not delete", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="rounded-md border bg-card px-4 py-3 space-y-3" data-testid={`config-row-${config.typeKey}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm" data-testid={`text-config-label-${config.typeKey}`}>
              {config.label}
            </span>
            {config.isCustom && (
              <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600 dark:text-orange-400">
                Custom
              </Badge>
            )}
            {!enabled && (
              <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-600 dark:text-rose-400">
                Disabled
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{config.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {config.scheduleLabel && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span data-testid={`chip-schedule-${config.typeKey}`}>{config.scheduleLabel}</span>
              </div>
            )}
            {config.recipientRule && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span data-testid={`chip-recipient-${config.typeKey}`}>{config.recipientRule}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs ${enabled ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
            {enabled ? "Enabled" : "Disabled"}
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => { setEnabled(v); setDirty(true); }}
            data-testid={`switch-enabled-${config.typeKey}`}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          CC recipients <span className="font-normal">(added to every outgoing email of this type)</span>
        </label>
        <EmailTagInput
          emails={cc}
          onChange={(v) => { setCc(v); setDirty(true); }}
          testIdPrefix={config.typeKey}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {config.updatedAt ? `Last saved ${formatDateTime(config.updatedAt)}` : "Not customised yet"}
        </div>
        <div className="flex items-center gap-2">
          {config.isCustom && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-600">Delete this type?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => del.mutate()}
                  disabled={del.isPending}
                  data-testid={`button-confirm-delete-${config.typeKey}`}
                >
                  {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} data-testid={`button-cancel-delete-${config.typeKey}`}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                data-testid={`button-delete-${config.typeKey}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )
          )}
          {dirty && (
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              data-testid={`button-save-${config.typeKey}`}
            >
              {save.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ADD CUSTOM TYPE FORM
// ==========================================

const BUILTIN_CATEGORIES = ["Payroll", "Attendance", "Onboarding", "Content", "Custom"];

function AddCustomTypeForm({
  toast,
  onClose,
  onSaved,
}: {
  toast: ReturnType<typeof useToast>["toast"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [typeKey, setTypeKey] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("Custom");
  const [description, setDescription] = useState("");
  const [scheduleLabel, setScheduleLabel] = useState("");
  const [recipientRule, setRecipientRule] = useState("");
  const [extraTo, setExtraTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/admin/communication-config", {
        typeKey: typeKey.trim().toLowerCase().replace(/\s+/g, "_"),
        label: label.trim(),
        category,
        description: description.trim() || null,
        scheduleLabel: scheduleLabel.trim() || null,
        recipientRule: recipientRule.trim() || null,
        extraTo,
        cc,
      })).json(),
    onSuccess: () => {
      toast({ title: "Created", description: `${label} added as a custom communication type.` });
      onSaved();
    },
    onError: (e: Error) => toast({ title: "Could not create", description: e.message, variant: "destructive" }),
  });

  const canSubmit = typeKey.trim() && label.trim() && category;

  return (
    <Card className="border-2 border-[#1F3A6E]/20 dark:border-[#1F3A6E]/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Add Communication Type</CardTitle>
          <Button size="sm" variant="ghost" onClick={onClose} data-testid="button-close-add-form">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Register a custom communication type. These appear in the Configuration and Policy lists.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="new-type-key">Type Key <span className="text-rose-500">*</span></label>
            <Input
              id="new-type-key"
              placeholder="e.g. weekly_digest"
              value={typeKey}
              onChange={(e) => setTypeKey(e.target.value)}
              data-testid="input-new-type-key"
            />
            <p className="text-xs text-muted-foreground">Unique identifier (lowercase, underscores).</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="new-type-label">Label <span className="text-rose-500">*</span></label>
            <Input
              id="new-type-label"
              placeholder="e.g. Weekly Digest"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              data-testid="input-new-type-label"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="new-type-category">Category <span className="text-rose-500">*</span></label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="new-type-category" data-testid="select-new-type-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUILTIN_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="new-type-schedule">Schedule Note</label>
            <Input
              id="new-type-schedule"
              placeholder="e.g. Weekly · Monday 9 AM IST"
              value={scheduleLabel}
              onChange={(e) => setScheduleLabel(e.target.value)}
              data-testid="input-new-type-schedule"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="new-type-recipient">Recipient Rule</label>
            <Input
              id="new-type-recipient"
              placeholder="e.g. All HR Managers"
              value={recipientRule}
              onChange={(e) => setRecipientRule(e.target.value)}
              data-testid="input-new-type-recipient"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="new-type-description">Description</label>
          <Textarea
            id="new-type-description"
            placeholder="What does this communication type do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            data-testid="textarea-new-type-description"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">To addresses</label>
            <EmailTagInput
              emails={extraTo}
              onChange={setExtraTo}
              placeholder="Add fixed To address…"
              testIdPrefix="new-extra-to"
            />
            <p className="text-xs text-muted-foreground">Fixed recipients for this type.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">CC addresses</label>
            <EmailTagInput
              emails={cc}
              onChange={setCc}
              placeholder="Add CC address…"
              testIdPrefix="new-cc"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="button-cancel-add-form">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => create.mutate()}
            disabled={!canSubmit || create.isPending}
            data-testid="button-submit-add-form"
          >
            {create.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Create Type
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
