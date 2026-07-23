import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, Loader2, Clock, Search, ChevronRight, Users, CheckCircle2, AlertCircle, XCircle, UserCheck, HelpCircle } from "lucide-react";
import { format } from "date-fns";

interface HirdRequest {
  id: string;
  requestNumber: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  neededByDate?: string;
  requester?: { id: string; firstName: string; lastName: string; role: string };
  assignedTo?: { id: string; firstName: string; lastName: string };
}

interface Resolver {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

const TYPE_LABELS: Record<string, string> = { access: "Access & IT", hr: "HR", ops: "Operations", general: "General" };

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  p1: { label: "P1 Critical", color: "bg-red-100 text-red-700 border-red-200" },
  p2: { label: "P2 High", color: "bg-orange-100 text-orange-700 border-orange-200" },
  p3: { label: "P3 Medium", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  p4: { label: "P4 Low", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending_approval: { label: "Pending Approval", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  assigned: { label: "Assigned", color: "bg-blue-100 text-blue-700 border-blue-200", icon: AlertCircle },
  in_progress: { label: "In Progress", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Loader2 },
  needs_info: { label: "Needs Info", color: "bg-rose-100 text-rose-700 border-rose-200", icon: HelpCircle },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-600 border-slate-200", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] || { label: status, color: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock };
  return <Badge variant="outline" className={`text-xs ${s.color}`}>{s.label}</Badge>;
}

const QUEUE_TABS = [
  { value: "unassigned", label: "Unassigned" },
  { value: "mine", label: "Assigned to Me" },
  { value: "open", label: "All Open" },
  { value: "resolved", label: "Resolved" },
] as const;

type QueueTab = typeof QUEUE_TABS[number]["value"];

export default function HelpDesk() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { enabled: newLook } = useNewLook();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<QueueTab>("open");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  const role = user?.role || "employee";
  const resolverRoles = ["super_admin", "admin", "hr", "operations"];
  const shouldRedirect = !authLoading && (!isAuthenticated || !resolverRoles.includes(role));

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
    else if (!authLoading && !resolverRoles.includes(role)) setLocation("/admin/hr");
  }, [authLoading, isAuthenticated, role]);

  const { data: requests = [], isLoading } = useQuery<HirdRequest[]>({
    queryKey: ["/api/help-desk/requests", activeTab, filterType],
    queryFn: async () => {
      const params = new URLSearchParams({ tab: activeTab });
      if (filterType !== "all") params.set("type", filterType);
      const res = await fetch(`/api/help-desk/requests?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !shouldRedirect,
  });

  const { data: stats } = useQuery<{ open: number; pendingApproval: number; resolved: number; total: number }>({
    queryKey: ["/api/help-desk/requests/stats"],
    enabled: !shouldRedirect,
  });

  const { data: resolvers = [] } = useQuery<Resolver[]>({
    queryKey: ["/api/help-desk/resolvers"],
    enabled: !shouldRedirect,
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, assignedToId }: { id: string; assignedToId: string }) =>
      apiRequest("PATCH", `/api/help-desk/requests/${id}`, { assignedToId, status: "in_progress" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/open-count"] });
      toast({ title: "Request assigned" });
    },
    onError: () => toast({ title: "Failed to assign", variant: "destructive" }),
  });

  const assignToMeMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/help-desk/requests/${id}`, { assignedToId: user?.id, status: "in_progress" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/open-count"] });
      toast({ title: "Request assigned to you" });
      setActiveTab("mine");
    },
    onError: () => toast({ title: "Failed to assign", variant: "destructive" }),
  });

  if (shouldRedirect) return null;

  const filtered = requests.filter(r => {
    if (!search) return true;
    return r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.requestNumber.toLowerCase().includes(search.toLowerCase());
  });

  const statCards = [
    { label: "Open", value: stats?.open ?? 0, color: "text-blue-600" },
    { label: "Pending Approval", value: stats?.pendingApproval ?? 0, color: "text-amber-600" },
    { label: "Resolved", value: stats?.resolved ?? 0, color: "text-green-600" },
    { label: "Total", value: stats?.total ?? 0, color: "text-slate-600" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-5 v2-surface" data-testid="help-desk-page">
        {newLook ? (
          <V2PageHeader
            icon={Inbox}
            eyebrow="Admin"
            title="Help Desk Queue"
            subtitle="Manage and resolve internal requests"
            testId="text-helpdesk-title"
          />
        ) : (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-helpdesk-title">Help Desk Queue</h1>
            <p className="text-sm text-muted-foreground">Manage and resolve internal requests</p>
          </div>
          <Badge variant="outline" className="text-sm font-mono">HIRD</Badge>
        </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <Card key={s.label} className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as QueueTab)} className="flex-1">
            <TabsList className="w-full sm:w-auto">
              {QUEUE_TABS.map(t => (
                <TabsTrigger key={t.value} value={t.value} data-testid={`tab-queue-${t.value}`} className="text-xs sm:text-sm">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by title or number…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-requests" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40" data-testid="select-filter-type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="access">Access & IT</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
              <SelectItem value="ops">Operations</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />Loading queue…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-lg bg-muted/10">
            <Inbox className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-medium">Queue is empty</p>
            <p className="text-sm mt-1">No requests match the current filters.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const prio = PRIORITY_LABELS[r.priority] || PRIORITY_LABELS.p3;
              const isUnassigned = r.status === "assigned" && !r.assignedTo;
              return (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card" data-testid={`queue-row-${r.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{r.requestNumber}</span>
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[r.type] || r.type}</Badge>
                      <Badge variant="outline" className={`text-xs ${prio.color}`}>{prio.label}</Badge>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="font-medium text-sm mt-1">{r.title}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {r.requester && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {r.requester.firstName} {r.requester.lastName}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy") : ""}
                      </span>
                      {r.assignedTo && (
                        <span className="text-xs text-purple-600">→ {r.assignedTo.firstName} {r.assignedTo.lastName}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isUnassigned && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => assignToMeMutation.mutate(r.id)}
                          disabled={assignToMeMutation.isPending}
                          data-testid={`button-assign-me-${r.id}`}
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" />Assign to Me
                        </Button>
                        <Select onValueChange={(v) => assignMutation.mutate({ id: r.id, assignedToId: v })}>
                          <SelectTrigger className="h-8 text-xs w-36" data-testid={`select-assign-${r.id}`}>
                            <SelectValue placeholder="Assign to…" />
                          </SelectTrigger>
                          <SelectContent>
                            {resolvers.map(res => (
                              <SelectItem key={res.id} value={res.id}>{res.firstName} {res.lastName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => setLocation(`/admin/help-desk/${r.id}`)}
                      data-testid={`button-open-${r.id}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
