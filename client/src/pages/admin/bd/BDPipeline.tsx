import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Phone, Mail, Calendar, TrendingUp, Users, Activity,
  Building2, ChevronRight, Clock, Target, DollarSign, X, Link2,
  AlertCircle, Briefcase, Pencil, Trash2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ─── Constants ───────────────────────────────────────────────────────────────

const PROSPECT_STATUSES = [
  { value: "new", label: "New", color: "bg-slate-100 text-slate-700" },
  { value: "contacted", label: "Contacted", color: "bg-blue-100 text-blue-700" },
  { value: "meeting_scheduled", label: "Meeting Scheduled", color: "bg-purple-100 text-purple-700" },
  { value: "proposal_sent", label: "Proposal Sent", color: "bg-orange-100 text-orange-700" },
  { value: "negotiating", label: "Negotiating", color: "bg-yellow-100 text-yellow-700" },
  { value: "closed_won", label: "Closed Won", color: "bg-green-100 text-green-700" },
  { value: "closed_lost", label: "Closed Lost", color: "bg-red-100 text-red-700" },
];

const DEAL_STAGES = [
  { value: "discovery", label: "Discovery", color: "bg-slate-100 text-slate-700" },
  { value: "qualified", label: "Qualified", color: "bg-blue-100 text-blue-700" },
  { value: "proposal", label: "Proposal", color: "bg-purple-100 text-purple-700" },
  { value: "negotiation", label: "Negotiation", color: "bg-orange-100 text-orange-700" },
  { value: "closed_won", label: "Closed Won", color: "bg-green-100 text-green-700" },
  { value: "closed_lost", label: "Closed Lost", color: "bg-red-100 text-red-700" },
];

const INDUSTRIES = ["Healthcare", "IT", "Engineering", "Professional Services"];
const SOURCES = ["Referral", "Cold Outreach", "Conference", "LinkedIn", "Inbound"];
const ACTIVITY_TYPES = ["call", "email", "meeting", "linkedin_message", "demo", "proposal_sent", "follow_up", "note"];
const OUTCOMES = ["positive", "neutral", "negative", "no_response"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string, list: typeof PROSPECT_STATUSES) {
  const s = list.find((x) => x.value === status);
  return s ? (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{status}</span>
  );
}

function formatMoney(val: any) {
  const n = Number(val ?? 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function activityTypeIcon(type: string) {
  const map: Record<string, string> = {
    call: "📞", email: "📧", meeting: "🤝", linkedin_message: "💼",
    demo: "🖥️", proposal_sent: "📄", follow_up: "🔄", note: "📝",
  };
  return map[type] ?? "📌";
}

function outcomeColor(outcome: string) {
  const map: Record<string, string> = {
    positive: "text-green-600", neutral: "text-gray-500",
    negative: "text-red-600", no_response: "text-yellow-600",
  };
  return map[outcome] ?? "text-gray-500";
}

// ─── Add/Edit Prospect Dialog ─────────────────────────────────────────────────

function ProspectDialog({ open, onClose, prospect }: { open: boolean; onClose: () => void; prospect?: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: adminUsers } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });
  const [form, setForm] = useState({
    companyName: prospect?.company_name ?? "",
    contactName: prospect?.contact_name ?? "",
    contactEmail: prospect?.contact_email ?? "",
    contactPhone: prospect?.contact_phone ?? "",
    industry: prospect?.industry ?? "",
    source: prospect?.source ?? "",
    status: prospect?.status ?? "new",
    notes: prospect?.notes ?? "",
    assignedTo: prospect?.assigned_to ?? "",
  });

  const save = useMutation({
    mutationFn: (data: any) =>
      prospect
        ? apiRequest("PATCH", `/api/bd/pipeline/prospects/${prospect.id}`, data)
        : apiRequest("POST", "/api/bd/pipeline/prospects", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bd/pipeline/prospects"] });
      toast({ title: prospect ? "Prospect updated" : "Prospect added" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{prospect ? "Edit Prospect" : "Add Prospect"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Company Name *</Label>
              <Input data-testid="input-company-name" value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Acme Corp" />
            </div>
            <div>
              <Label>Contact Name</Label>
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Jane Smith" />
            </div>
            <div>
              <Label>Contact Email</Label>
              <Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="jane@acme.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+1 555-0000" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROSPECT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Industry</Label>
              <Select value={form.industry || "__none"} onValueChange={(v) => setForm({ ...form, industry: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source</Label>
              <Select value={form.source || "__none"} onValueChange={(v) => setForm({ ...form, source: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned BD Person</Label>
              <Select value={form.assignedTo || "__none"} onValueChange={(v) => setForm({ ...form, assignedTo: v === "__none" ? "" : v })}>
                <SelectTrigger data-testid="select-assigned-to"><SelectValue placeholder="— Unassigned —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Unassigned —</SelectItem>
                  {(adminUsers ?? []).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Key context about this prospect…" rows={3} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-prospect" onClick={() => save.mutate(form)} disabled={!form.companyName.trim() || save.isPending}
            className="bg-[#1F3A6E] hover:bg-[#1F3A6E]/90">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Deal Dialog ──────────────────────────────────────────────────────────

function DealDialog({ open, onClose, prospectId, deal }: { open: boolean; onClose: () => void; prospectId?: string; deal?: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    prospectId: deal?.prospect_id ?? prospectId ?? "",
    title: deal?.title ?? "",
    stage: deal?.stage ?? "discovery",
    dealValue: deal?.deal_value ?? "",
    headcount: deal?.headcount ?? "",
    specialty: deal?.specialty ?? "",
    probability: deal?.probability ?? "",
    expectedCloseDate: deal?.expected_close_date ?? "",
    lostReason: deal?.lost_reason ?? "",
    assignedTo: deal?.assigned_to ?? "",
  });

  const { data: prospects } = useQuery<any[]>({ queryKey: ["/api/bd/pipeline/prospects"] });
  const { data: adminUsers } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });

  const save = useMutation({
    mutationFn: (data: any) =>
      deal
        ? apiRequest("PATCH", `/api/bd/pipeline/deals/${deal.id}`, data)
        : apiRequest("POST", "/api/bd/pipeline/deals", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bd/pipeline/deals"] });
      qc.invalidateQueries({ queryKey: ["/api/bd/pipeline/prospects"] });
      toast({ title: deal ? "Deal updated" : "Deal added" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{deal ? "Edit Deal" : "Add Deal"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            {!prospectId && (
              <div className="col-span-2">
                <Label>Prospect *</Label>
                <Select value={form.prospectId} onValueChange={(v) => setForm({ ...form, prospectId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select prospect" /></SelectTrigger>
                  <SelectContent>
                    {(prospects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2">
              <Label>Deal Title *</Label>
              <Input data-testid="input-deal-title" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Q3 Healthcare Staffing Contract" />
            </div>
            <div>
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Probability (%)</Label>
              <Input type="number" min="0" max="100" value={form.probability}
                onChange={(e) => setForm({ ...form, probability: e.target.value })} placeholder="50" />
            </div>
            <div>
              <Label>Estimated Value ($)</Label>
              <Input type="number" value={form.dealValue}
                onChange={(e) => setForm({ ...form, dealValue: e.target.value })} placeholder="50000" />
            </div>
            <div>
              <Label>Headcount</Label>
              <Input type="number" value={form.headcount}
                onChange={(e) => setForm({ ...form, headcount: e.target.value })} placeholder="5" />
            </div>
            <div>
              <Label>Specialty</Label>
              <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="RN, Software Engineer…" />
            </div>
            <div>
              <Label>Expected Close Date</Label>
              <Input type="date" value={form.expectedCloseDate}
                onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} />
            </div>
            {(form.stage === "closed_lost") && (
              <div className="col-span-2">
                <Label>Lost Reason</Label>
                <Textarea value={form.lostReason} onChange={(e) => setForm({ ...form, lostReason: e.target.value })}
                  placeholder="Why was this deal lost?" rows={2} />
              </div>
            )}
            <div className="col-span-2">
              <Label>Assigned BD Person</Label>
              <Select value={form.assignedTo || "__none"} onValueChange={(v) => setForm({ ...form, assignedTo: v === "__none" ? "" : v })}>
                <SelectTrigger data-testid="select-deal-assigned-to"><SelectValue placeholder="— Unassigned —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Unassigned —</SelectItem>
                  {(adminUsers ?? []).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-deal" onClick={() => save.mutate(form)}
            disabled={!form.title.trim() || !form.prospectId || save.isPending}
            className="bg-[#1F3A6E] hover:bg-[#1F3A6E]/90">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Log Activity Dialog ──────────────────────────────────────────────────────

function ActivityDialog({ open, onClose, prospectId, dealId }: { open: boolean; onClose: () => void; prospectId?: string; dealId?: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    activityType: "call",
    subject: "",
    body: "",
    durationMinutes: "",
    outcome: "neutral",
    activityDate: format(new Date(), "yyyy-MM-dd"),
  });

  const save = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/bd/pipeline/activities", {
      ...data, prospectId: prospectId ?? null, dealId: dealId ?? null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bd/pipeline/activities"] });
      qc.invalidateQueries({ queryKey: ["/api/bd/pipeline/prospects"] });
      toast({ title: "Activity logged" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const showDuration = ["call", "meeting", "demo"].includes(form.activityType);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type *</Label>
              <Select value={form.activityType} onValueChange={(v) => setForm({ ...form, activityType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.activityDate} onChange={(e) => setForm({ ...form, activityDate: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Subject *</Label>
              <Input data-testid="input-activity-subject" value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="What was this activity about?" />
            </div>
            <div>
              <Label>Outcome</Label>
              <Select value={form.outcome} onValueChange={(v) => setForm({ ...form, outcome: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {showDuration && (
              <div>
                <Label>Duration (min)</Label>
                <Input type="number" value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} placeholder="30" />
              </div>
            )}
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="What happened? What's the next step?" rows={3} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-activity" onClick={() => save.mutate(form)}
            disabled={!form.subject.trim() || !form.activityDate || save.isPending}
            className="bg-[#1F3A6E] hover:bg-[#1F3A6E]/90">
            {save.isPending ? "Logging…" : "Log Activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Link Client Dialog ───────────────────────────────────────────────────────

function LinkClientDialog({ open, onClose, prospectId }: { open: boolean; onClose: () => void; prospectId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");

  const { data: clients } = useQuery<any[]>({ queryKey: ["/api/bd/pipeline/contract-clients"] });

  const linkExisting = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/bd/pipeline/prospects/${prospectId}`, { linkedClientId: selectedClientId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bd/pipeline/prospects"] });
      qc.invalidateQueries({ queryKey: ["/api/bd/pipeline/contract-clients"] });
      toast({ title: "Prospect linked to client" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createAndLink = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/bd/pipeline/contract-clients", { name: newClientName.trim() });
      const created = await r.json();
      if (!created?.id) throw new Error("Failed to create client");
      await apiRequest("PATCH", `/api/bd/pipeline/prospects/${prospectId}`, { linkedClientId: created.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bd/pipeline/prospects"] });
      qc.invalidateQueries({ queryKey: ["/api/bd/pipeline/contract-clients"] });
      toast({ title: "Client created and prospect linked" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isPending = linkExisting.isPending || createAndLink.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-green-600" />
            Link to Contract Client
          </DialogTitle>
        </DialogHeader>
        {/* Mode toggle */}
        <div className="flex gap-2 mb-1">
          <Button size="sm" variant={mode === "existing" ? "default" : "outline"}
            onClick={() => setMode("existing")} data-testid="toggle-link-existing">
            Link Existing
          </Button>
          <Button size="sm" variant={mode === "new" ? "default" : "outline"}
            onClick={() => setMode("new")} data-testid="toggle-create-new">
            Create New
          </Button>
        </div>

        {mode === "existing" ? (
          <>
            <p className="text-sm text-muted-foreground">Connect this prospect to an existing client record in the contracts system.</p>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger data-testid="select-existing-client"><SelectValue placeholder="Select a contract client…" /></SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Create a new client record and link this prospect to it.</p>
            <div>
              <Label>Client / Company Name *</Label>
              <Input data-testid="input-new-client-name" value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)} placeholder="Acme Healthcare Inc." />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {mode === "existing" ? (
            <Button onClick={() => linkExisting.mutate()} disabled={!selectedClientId || isPending}
              className="bg-green-700 hover:bg-green-800" data-testid="button-link-client">
              {isPending ? "Linking…" : "Link Client"}
            </Button>
          ) : (
            <Button onClick={() => createAndLink.mutate()} disabled={!newClientName.trim() || isPending}
              className="bg-green-700 hover:bg-green-800" data-testid="button-create-link-client">
              {isPending ? "Creating…" : "Create & Link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Prospect Detail Slide-Over ───────────────────────────────────────────────

function ProspectDetail({ prospect, onClose }: { prospect: any; onClose: () => void }) {
  const [showDealDialog, setShowDealDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [editDeal, setEditDeal] = useState<any>(null);

  const { data: deals } = useQuery<any[]>({
    queryKey: ["/api/bd/pipeline/deals", prospect.id],
    queryFn: () => apiRequest("GET", `/api/bd/pipeline/deals?prospectId=${prospect.id}`).then((r) => r.json()),
  });

  const { data: activities } = useQuery<any[]>({
    queryKey: ["/api/bd/pipeline/activities", prospect.id],
    queryFn: () => apiRequest("GET", `/api/bd/pipeline/activities?prospectId=${prospect.id}`).then((r) => r.json()),
  });

  const qc = useQueryClient();
  const { toast } = useToast();
  const deleteDeal = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bd/pipeline/deals/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/bd/pipeline/deals"] }); toast({ title: "Deal removed" }); },
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b bg-[#1F3A6E] text-white rounded-tl-lg rounded-tr-lg">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{prospect.company_name}</h2>
            {prospect.contact_name && <p className="text-sm text-blue-200">{prospect.contact_name}</p>}
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(prospect.status, PROSPECT_STATUSES)}
            {prospect.status === "closed_won" && !prospect.linked_client_id && (
              <Button size="sm" variant="outline" className="text-white border-white/40 hover:bg-white/10 text-xs"
                onClick={() => setShowLinkDialog(true)}>
                <Link2 className="h-3 w-3 mr-1" /> Link Client
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-4 mt-3 text-xs text-blue-200">
          {prospect.contact_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{prospect.contact_email}</span>}
          {prospect.contact_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{prospect.contact_phone}</span>}
          {prospect.industry && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{prospect.industry}</span>}
        </div>
      </div>

      {/* Deals section */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm text-gray-700">Deals ({deals?.length ?? 0})</h3>
          <Button size="sm" variant="outline" onClick={() => setShowDealDialog(true)} data-testid="button-add-deal">
            <Plus className="h-3 w-3 mr-1" /> Add Deal
          </Button>
        </div>
        {(deals ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No deals yet. Add the first one.</p>
        ) : (
          <div className="space-y-2">
            {(deals ?? []).map((d: any) => (
              <div key={d.id} className="flex items-center justify-between p-2 rounded-lg border bg-gray-50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{d.title}</span>
                    {statusBadge(d.stage, DEAL_STAGES)}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    {d.deal_value && <span><DollarSign className="h-3 w-3 inline" />{formatMoney(d.deal_value)}</span>}
                    {d.probability != null && <span><Target className="h-3 w-3 inline" />{d.probability}%</span>}
                    {d.specialty && <span>{d.specialty}</span>}
                    {d.expected_close_date && <span><Calendar className="h-3 w-3 inline" />{format(new Date(d.expected_close_date), "MMM d, yyyy")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditDeal(d)}><Briefcase className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => { if (confirm("Remove this deal?")) deleteDeal.mutate(d.id); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity feed */}
      <div className="p-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm text-gray-700">Activity Feed ({activities?.length ?? 0})</h3>
          <Button size="sm" variant="outline" onClick={() => setShowActivityDialog(true)} data-testid="button-log-activity">
            <Plus className="h-3 w-3 mr-1" /> Log Activity
          </Button>
        </div>
        {(activities ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No activities yet.</p>
        ) : (
          <div className="space-y-2">
            {(activities ?? []).map((a: any) => (
              <div key={a.id} className="flex gap-3 p-2 rounded-lg border bg-gray-50">
                <span className="text-lg mt-0.5">{activityTypeIcon(a.activity_type)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{a.subject}</span>
                    {a.outcome && (
                      <span className={`text-xs font-medium ${outcomeColor(a.outcome)}`}>
                        {a.outcome.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  {a.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.body}</p>}
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{format(new Date(a.activity_date), "MMM d, yyyy")}</span>
                    {a.duration_minutes && <span>{a.duration_minutes} min</span>}
                    {a.logged_by_name && <span>by {a.logged_by_name}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showDealDialog && (
        <DealDialog open onClose={() => setShowDealDialog(false)} prospectId={prospect.id} />
      )}
      {editDeal && (
        <DealDialog open onClose={() => setEditDeal(null)} prospectId={prospect.id} deal={editDeal} />
      )}
      {showActivityDialog && (
        <ActivityDialog open onClose={() => setShowActivityDialog(false)} prospectId={prospect.id} />
      )}
      {showLinkDialog && (
        <LinkClientDialog open onClose={() => setShowLinkDialog(false)} prospectId={prospect.id} />
      )}
    </div>
  );
}

// ─── Prospects Tab ────────────────────────────────────────────────────────────

function ProspectsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProspect, setSelectedProspect] = useState<any>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editProspect, setEditProspect] = useState<any>(null);

  const { data: prospects, isLoading } = useQuery<any[]>({
    queryKey: ["/api/bd/pipeline/prospects"],
    queryFn: () => apiRequest("GET", "/api/bd/pipeline/prospects").then((r) => r.json()),
  });

  const qc = useQueryClient();
  const { toast } = useToast();
  const deleteProspect = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bd/pipeline/prospects/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/bd/pipeline/prospects"] }); toast({ title: "Prospect removed" }); },
  });

  const filtered = (prospects ?? []).filter((p: any) => {
    const matchSearch = !search || p.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.contact_name?.toLowerCase().includes(search.toLowerCase()) || p.contact_email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#1F3A6E] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-search-prospects" className="pl-9" placeholder="Search prospects…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {PROSPECT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button data-testid="button-add-prospect" onClick={() => setShowAddDialog(true)}
          className="bg-[#1F3A6E] hover:bg-[#1F3A6E]/90">
          <Plus className="h-4 w-4 mr-2" /> Add Prospect
        </Button>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">{filtered.length} prospect{filtered.length !== 1 ? "s" : ""}</p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground font-medium">No prospects found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Start adding companies you're cultivating.</p>
          <Button className="mt-4 bg-[#1F3A6E] hover:bg-[#1F3A6E]/90" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Your First Prospect
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p: any) => (
            <Card key={p.id} className="hover:shadow-md transition-shadow" data-testid={`card-prospect-${p.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setSelectedProspect(p)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#1F3A6E]">{p.company_name}</span>
                      {statusBadge(p.status, PROSPECT_STATUSES)}
                      {p.industry && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{p.industry}</span>}
                      {p.linked_client_id && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1"><Link2 className="h-2.5 w-2.5" />Linked</span>}
                    </div>
                    <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      {p.contact_name && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.contact_name}</span>}
                      {p.contact_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.contact_email}</span>}
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {p.deal_count ?? 0} deal{p.deal_count !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {p.activity_count ?? 0} {p.activity_count === 1 ? "activity" : "activities"}
                      </span>
                      {p.last_activity_at ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last: {formatDistanceToNow(new Date(p.last_activity_at), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-orange-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Never contacted
                        </span>
                      )}
                      {p.assigned_to_name && <span className="flex items-center gap-1">👤 {p.assigned_to_name}</span>}
                    </div>
                  </div>
                  {/* Action buttons: edit, delete, open detail */}
                  <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      data-testid={`button-edit-prospect-${p.id}`}
                      onClick={(e) => { e.stopPropagation(); setEditProspect(p); }}
                      title="Edit prospect"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700"
                      data-testid={`button-delete-prospect-${p.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove "${p.company_name}"? All deals and activities will also be deleted.`)) {
                          deleteProspect.mutate(p.id);
                        }
                      }}
                      title="Delete prospect"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      data-testid={`button-open-prospect-${p.id}`}
                      onClick={() => setSelectedProspect(p)}
                      title="View details"
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      {showAddDialog && <ProspectDialog open onClose={() => setShowAddDialog(false)} />}
      {editProspect && <ProspectDialog open onClose={() => setEditProspect(null)} prospect={editProspect} />}

      {/* Prospect Detail Sheet */}
      <Sheet open={!!selectedProspect} onOpenChange={(o) => { if (!o) setSelectedProspect(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0">
          {selectedProspect && (
            <ProspectDetail prospect={selectedProspect} onClose={() => setSelectedProspect(null)} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Deals Tab ────────────────────────────────────────────────────────────────

function DealsTab() {
  const [stageFilter, setStageFilter] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: deals, isLoading } = useQuery<any[]>({
    queryKey: ["/api/bd/pipeline/deals"],
    queryFn: () => apiRequest("GET", "/api/bd/pipeline/deals").then((r) => r.json()),
  });

  const filtered = (deals ?? []).filter((d: any) => {
    const matchStage = stageFilter === "all" || d.stage === stageFilter;
    const matchSpec = specialtyFilter === "all" || d.specialty?.toLowerCase().includes(specialtyFilter.toLowerCase());
    return matchStage && matchSpec;
  });

  const specialties = Array.from(new Set((deals ?? []).map((d: any) => d.specialty).filter(Boolean))) as string[];

  // Group by stage
  const grouped = DEAL_STAGES.reduce((acc: Record<string, any[]>, s) => {
    acc[s.value] = filtered.filter((d: any) => d.stage === s.value);
    return acc;
  }, {});

  const totalValue = filtered.reduce((s: number, d: any) => s + Number(d.deal_value ?? 0), 0);
  const weightedValue = filtered.reduce((s: number, d: any) => s + Number(d.deal_value ?? 0) * (Number(d.probability ?? 0) / 100), 0);

  if (isLoading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#1F3A6E] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Filters + stats */}
      <div className="flex gap-3 flex-wrap items-center">
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All stages" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {DEAL_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {specialties.length > 0 && (
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All specialties" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specialties</SelectItem>
              {specialties.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
          <span>Total: <strong className="text-foreground">{formatMoney(totalValue)}</strong></span>
          <span>Weighted: <strong className="text-foreground">{formatMoney(weightedValue)}</strong></span>
        </div>
        <Button data-testid="button-add-deal-tab" onClick={() => setShowAddDialog(true)}
          className="bg-[#1F3A6E] hover:bg-[#1F3A6E]/90">
          <Plus className="h-4 w-4 mr-2" /> Add Deal
        </Button>
      </div>

      {/* Deals by stage */}
      {Object.entries(grouped).map(([stageVal, stagDeals]) => {
        if (stagDeals.length === 0) return null;
        const stageMeta = DEAL_STAGES.find((s) => s.value === stageVal);
        const stageTotal = stagDeals.reduce((s, d: any) => s + Number(d.deal_value ?? 0), 0);
        return (
          <div key={stageVal}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${stageMeta?.color}`}>{stageMeta?.label}</span>
              <span className="text-xs text-muted-foreground">{stagDeals.length} deal{stagDeals.length !== 1 ? "s" : ""} · {formatMoney(stageTotal)}</span>
            </div>
            <div className="grid gap-2">
              {stagDeals.map((d: any) => (
                <Card key={d.id} data-testid={`card-deal-${d.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{d.title}</span>
                          {d.deal_value && <span className="text-xs font-semibold text-[#F47C20]">{formatMoney(d.deal_value)}</span>}
                          {d.probability != null && (
                            <span className="text-xs text-muted-foreground">{d.probability}%</span>
                          )}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="text-[#1F3A6E]">{d.prospect_company_name}</span>
                          {d.specialty && <span>{d.specialty}</span>}
                          {d.headcount && <span>{d.headcount} hc</span>}
                          {d.expected_close_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(d.expected_close_date), "MMM d, yyyy")}
                            </span>
                          )}
                          {d.assigned_to_name && <span>→ {d.assigned_to_name}</span>}
                        </div>
                        {d.lost_reason && <p className="text-xs text-red-500 mt-1">{d.lost_reason}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground font-medium">No deals yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Add deals from the Prospects tab or click below.</p>
          <Button className="mt-4 bg-[#1F3A6E] hover:bg-[#1F3A6E]/90" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add First Deal
          </Button>
        </div>
      )}

      {showAddDialog && <DealDialog open onClose={() => setShowAddDialog(false)} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BDPipeline() {
  const { user } = useAuth();

  // Summary stats — must be declared before any early return (Rules of Hooks)
  const { data: summary } = useQuery<any>({
    queryKey: ["/api/bd/pipeline/summary"],
    queryFn: () => apiRequest("GET", "/api/bd/pipeline/summary").then((r) => r.json()),
    enabled: !!user,
  });

  const BD_ROLES = ["super_admin", "admin", "operations", "manager"];
  if (user && !BD_ROLES.includes(user.role)) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-96">
          <p className="text-muted-foreground">You don't have access to BD Pipeline.</p>
        </div>
      </AdminLayout>
    );
  }

  const pt = (summary?.pipelineTotal ?? {}) as any;
  const openDeals = Number(pt.open_deal_count ?? 0);
  const totalValue = Number(pt.total_pipeline_value ?? 0);
  const staleCount = (summary?.staleProspects as any[])?.length ?? 0;
  const expiringCount = (summary?.expiringContracts as any[])?.length ?? 0;

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A6E]">BD Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage prospects, track deals, and log activities across your business development pipeline.</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1F3A6E]">{openDeals}</p>
                  <p className="text-xs text-muted-foreground">Open Deals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#F47C20]">{formatMoney(totalValue)}</p>
                  <p className="text-xs text-muted-foreground">Pipeline Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${staleCount > 0 ? "bg-orange-100" : "bg-green-100"}`}>
                  <Clock className={`h-5 w-5 ${staleCount > 0 ? "text-orange-600" : "text-green-600"}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${staleCount > 0 ? "text-orange-600" : "text-green-600"}`}>{staleCount}</p>
                  <p className="text-xs text-muted-foreground">Stale (14+ days)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${expiringCount > 0 ? "bg-red-100" : "bg-gray-100"}`}>
                  <AlertCircle className={`h-5 w-5 ${expiringCount > 0 ? "text-red-600" : "text-gray-400"}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${expiringCount > 0 ? "text-red-600" : "text-gray-600"}`}>{expiringCount}</p>
                  <p className="text-xs text-muted-foreground">Renewals in 90d</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="prospects">
          <TabsList>
            <TabsTrigger value="prospects" data-testid="tab-prospects">Prospects</TabsTrigger>
            <TabsTrigger value="deals" data-testid="tab-deals">Deals</TabsTrigger>
          </TabsList>
          <TabsContent value="prospects" className="mt-4">
            <ProspectsTab />
          </TabsContent>
          <TabsContent value="deals" className="mt-4">
            <DealsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
