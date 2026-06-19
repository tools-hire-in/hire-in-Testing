import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Inbox, Clock, CheckCircle2, XCircle, Loader2, ChevronRight, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

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
  requester?: { id: string; firstName: string; lastName: string };
  assignedTo?: { firstName: string; lastName: string };
}

const TYPE_LABELS: Record<string, string> = { access: "Access & IT", hr: "HR", ops: "Operations", general: "General" };
const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  p1: { label: "Critical", color: "bg-red-100 text-red-700 border-red-200" },
  p2: { label: "High", color: "bg-orange-100 text-orange-700 border-orange-200" },
  p3: { label: "Medium", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  p4: { label: "Low", color: "bg-slate-100 text-slate-600 border-slate-200" },
};
const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pending_approval: { label: "Pending Approval", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  assigned: { label: "Assigned", color: "bg-blue-100 text-blue-700 border-blue-200", icon: AlertCircle },
  in_progress: { label: "In Progress", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Loader2 },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-600 border-slate-200", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

const HR_SUBTYPES = [
  "Letter Request", "Payslip Issue", "Leave Issue", "Policy Clarification",
  "Salary Discrepancy", "Documentation", "Other",
];


interface TemplateData {
  // Access
  system?: string;
  accessLevel?: string;
  accessType?: string;
  accessEndDate?: string;
  justification?: string;
  // HR + Ops share requestSubtype
  requestSubtype?: string;
  period?: string;
  additionalContext?: string;
  // Ops
  asset?: string;
  quantity?: string;
  urgency?: string;
  isBlocking?: string;
  // General
  category?: string;
}

function AccessFields({ data, onChange }: { data: TemplateData; onChange: (d: TemplateData) => void }) {
  return (
    <>
      <div>
        <Label htmlFor="tpl-system">System / Tool <span className="text-destructive">*</span></Label>
        <Input id="tpl-system" className="mt-1" placeholder="e.g. Salesforce, VPN, GitHub Org" value={data.system || ""} onChange={e => onChange({ ...data, system: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="tpl-access-level">Access Level <span className="text-destructive">*</span></Label>
        <Select value={data.accessLevel || ""} onValueChange={v => onChange({ ...data, accessLevel: v })}>
          <SelectTrigger id="tpl-access-level" className="mt-1">
            <SelectValue placeholder="Select access level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="view_only">View Only (Read-only)</SelectItem>
            <SelectItem value="contributor">Contributor (Read + Write)</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="custom">Custom (specify in description)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tpl-role">Your Role / Designation</Label>
          <Input id="tpl-role" className="mt-1" placeholder="e.g. Senior Recruiter" value={(data as any).requestedRole || ""} onChange={e => onChange({ ...data, requestedRole: e.target.value } as any)} />
        </div>
        <div>
          <Label htmlFor="tpl-project">Project / Client</Label>
          <Input id="tpl-project" className="mt-1" placeholder="e.g. ACME Healthcare" value={(data as any).projectOrClient || ""} onChange={e => onChange({ ...data, projectOrClient: e.target.value } as any)} />
        </div>
      </div>
      <div>
        <Label>Access Duration</Label>
        <RadioGroup
          value={data.accessType || "permanent"}
          onValueChange={v => onChange({ ...data, accessType: v, accessEndDate: v === "permanent" ? undefined : data.accessEndDate })}
          className="flex gap-4 mt-1"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="permanent" id="at-perm" />
            <Label htmlFor="at-perm" className="font-normal cursor-pointer">Permanent</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="temporary" id="at-temp" />
            <Label htmlFor="at-temp" className="font-normal cursor-pointer">Temporary</Label>
          </div>
        </RadioGroup>
      </div>
      {data.accessType === "temporary" && (
        <div>
          <Label htmlFor="tpl-access-end">Access End Date <span className="text-destructive">*</span></Label>
          <Input id="tpl-access-end" type="date" className="mt-1" value={data.accessEndDate || ""} onChange={e => onChange({ ...data, accessEndDate: e.target.value })} />
        </div>
      )}
      <div>
        <Label htmlFor="tpl-justification">
          Business Justification <span className="text-destructive">*</span>
          <span className="text-xs text-muted-foreground ml-1">(min 50 characters)</span>
        </Label>
        <Textarea id="tpl-justification" className="mt-1 resize-none" placeholder="Explain why this access is required for your role and how it will be used…" rows={3} value={data.justification || ""} onChange={e => onChange({ ...data, justification: e.target.value })} />
        {data.justification && data.justification.length < 50 && (
          <p className="text-xs text-amber-600 mt-1">{50 - data.justification.length} more characters needed</p>
        )}
      </div>
    </>
  );
}

function HrFields({ data, onChange }: { data: TemplateData; onChange: (d: TemplateData) => void }) {
  return (
    <>
      <div>
        <Label htmlFor="tpl-subtype">Request Sub-type <span className="text-destructive">*</span></Label>
        <Select value={data.requestSubtype || ""} onValueChange={v => onChange({ ...data, requestSubtype: v })}>
          <SelectTrigger id="tpl-subtype" className="mt-1">
            <SelectValue placeholder="Select sub-type" />
          </SelectTrigger>
          <SelectContent>
            {HR_SUBTYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="tpl-period">Relevant Period</Label>
        <Input id="tpl-period" className="mt-1" placeholder="e.g. March 2026, FY2025-26" value={data.period || ""} onChange={e => onChange({ ...data, period: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="tpl-hr-ctx">Additional Context (optional)</Label>
        <Textarea id="tpl-hr-ctx" className="mt-1 resize-none" placeholder="Any other details the HR team should know…" rows={2} value={data.additionalContext || ""} onChange={e => onChange({ ...data, additionalContext: e.target.value })} />
      </div>
    </>
  );
}

const OPS_SUBTYPES = [
  "Equipment / Device Request",
  "Software / License Request",
  "Stationery / Supplies",
  "Maintenance / Repair",
  "IT Process Support",
  "Report / Data Export",
  "Other",
];

const OPS_URGENCY_LABELS: Record<string, string> = {
  immediate: "Immediate (blocking work)",
  this_week: "This week",
  this_month: "This month",
  no_rush: "No rush — when possible",
};

const EQUIPMENT_SUBTYPES = new Set(["Equipment / Device Request", "Stationery / Supplies", "Maintenance / Repair"]);

function OpsFields({ data, onChange, onPriorityChange }: { data: TemplateData; onChange: (d: TemplateData) => void; onPriorityChange?: (p: string) => void }) {
  const subtype = (data as any).requestSubtype || "";
  const showAssetFields = EQUIPMENT_SUBTYPES.has(subtype);
  return (
    <>
      <div>
        <Label htmlFor="tpl-ops-sub">Operations Sub-type <span className="text-destructive">*</span></Label>
        <Select value={subtype} onValueChange={v => onChange({ ...data, requestSubtype: v } as any)}>
          <SelectTrigger id="tpl-ops-sub" className="mt-1">
            <SelectValue placeholder="Select sub-type" />
          </SelectTrigger>
          <SelectContent>
            {OPS_SUBTYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {showAssetFields && (
        <>
          <div>
            <Label htmlFor="tpl-asset">Item / Asset Description</Label>
            <Input id="tpl-asset" className="mt-1" placeholder="e.g. Dell Laptop, Office Chair, Keyboard" value={data.asset || ""} onChange={e => onChange({ ...data, asset: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="tpl-qty">Quantity</Label>
            <Input id="tpl-qty" className="mt-1" placeholder="1" type="number" min={1} value={data.quantity || ""} onChange={e => onChange({ ...data, quantity: e.target.value })} />
          </div>
        </>
      )}
      <div>
        <Label htmlFor="tpl-urgency">Urgency</Label>
        <Select value={(data as any).urgency || ""} onValueChange={v => onChange({ ...data, urgency: v } as any)}>
          <SelectTrigger id="tpl-urgency" className="mt-1">
            <SelectValue placeholder="How urgent is this?" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(OPS_URGENCY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Is this blocking your work?</Label>
        <RadioGroup
          value={data.isBlocking || "no"}
          onValueChange={v => {
            onChange({ ...data, isBlocking: v });
            if (v === "yes" && onPriorityChange) onPriorityChange("p2");
          }}
          className="flex gap-4 mt-1"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="yes" id="ib-yes" />
            <Label htmlFor="ib-yes" className="font-normal cursor-pointer">Yes — cannot work without this <span className="text-orange-600 text-xs">(auto-sets High priority)</span></Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="no" id="ib-no" />
            <Label htmlFor="ib-no" className="font-normal cursor-pointer">No — helpful but I can continue</Label>
          </div>
        </RadioGroup>
      </div>
    </>
  );
}

function GeneralFields({ data, onChange }: { data: TemplateData; onChange: (d: TemplateData) => void }) {
  return (
    <div>
      <Label htmlFor="tpl-cat">Category</Label>
      <Input id="tpl-cat" className="mt-1" placeholder="e.g. Feedback, Policy Question, Announcement" value={data.category || ""} onChange={e => onChange({ ...data, category: e.target.value })} />
    </div>
  );
}

interface AdminUserOption { id: string; firstName: string; lastName: string; role: string; }

const ROLE_DISPLAY: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  hr: "HR Specialist",
  operations: "Operations",
  manager: "Manager",
  employee: "Employee",
};

const TYPE_ICONS: Record<string, string> = {
  access: "🔐",
  hr: "📋",
  ops: "⚙️",
  general: "💬",
};
const TYPE_DESCRIPTIONS: Record<string, string> = {
  access: "System logins, VPN, software licenses, permissions",
  hr: "Payslips, letters, leave corrections, policy queries",
  ops: "Equipment, devices, process support, reports",
  general: "Feedback, announcements, anything else",
};

function NewRequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Two-step state
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<string>("");
  const [requestedForId, setRequestedForId] = useState<string>("_self");

  // Step 2 state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("p3");
  const [neededByDate, setNeededByDate] = useState("");
  const [templateData, setTemplateData] = useState<TemplateData>({});
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const { data: allUsers = [] } = useQuery<AdminUserOption[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  // When "requested for" changes, auto-fill role/designation from selected employee record
  const handleRequestedForChange = (v: string) => {
    setRequestedForId(v);
    if (type === "access") {
      let role = "";
      if (v === "_self") {
        role = user?.role ? (ROLE_DISPLAY[user.role] || user.role) : "";
      } else {
        const emp = allUsers.find(u => u.id === v);
        role = emp ? (ROLE_DISPLAY[emp.role] || emp.role) : "";
      }
      setTemplateData(prev => ({ ...prev, requestedRole: role } as any));
    }
  };

  // Advance to step 2 with the selected type
  const handleTypeSelect = (t: string) => {
    setType(t);
    // Pre-fill requestedRole for access type from current user/selected employee
    const autoFill: Record<string, string> = {};
    if (t === "access") {
      const emp = requestedForId !== "_self" ? allUsers.find(u => u.id === requestedForId) : null;
      const roleSource = emp ? emp.role : (user?.role || "");
      autoFill.requestedRole = ROLE_DISPLAY[roleSource] || roleSource;
    }
    setTemplateData(autoFill as TemplateData);
    setStep(2);
  };

  const resetAll = () => {
    setStep(1); setType(""); setRequestedForId("_self");
    setTitle(""); setDescription(""); setPriority("p3");
    setNeededByDate(""); setTemplateData({}); setAttachmentUrl("");
  };

  const { mutate, isPending } = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/help-desk/requests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests/stats"] });
      toast({ title: "Request submitted", description: "Your request is pending manager approval." });
      onClose();
      resetAll();
    },
    onError: () => toast({ title: "Failed to submit", variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    if (!description.trim() || description.trim().length < 5) { toast({ title: "Description is too short", variant: "destructive" }); return; }
    if (type === "access") {
      if (!templateData.system?.trim()) { toast({ title: "System/Tool is required", variant: "destructive" }); return; }
      if (!templateData.accessLevel) { toast({ title: "Access Level is required", variant: "destructive" }); return; }
      if (templateData.accessType === "temporary" && !templateData.accessEndDate) { toast({ title: "End date required for temporary access", variant: "destructive" }); return; }
      if (!templateData.justification || templateData.justification.length < 50) { toast({ title: "Justification must be at least 50 characters", variant: "destructive" }); return; }
    }
    if (type === "hr" && !templateData.requestSubtype) { toast({ title: "HR sub-type is required", variant: "destructive" }); return; }
    if (type === "ops" && !(templateData as any).requestSubtype) {
      toast({ title: "Operations sub-type is required", variant: "destructive" }); return;
    }
    mutate({
      type,
      title: title.trim(),
      description: description.trim(),
      priority,
      neededByDate: neededByDate || null,
      templateData,
      requestedForId: requestedForId === "_self" ? null : requestedForId,
      attachmentUrl: attachmentUrl.trim() || null,
    });
  };

  const handleClose = () => { onClose(); resetAll(); };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            {step === 1 ? "New Request — Choose Category" : `New Request — ${TYPE_LABELS[type] || "Details"}`}
          </DialogTitle>
          {step === 2 && (
            <p className="text-xs text-muted-foreground pt-1">
              Step 2 of 2 &mdash; Fill in the details for your <strong>{TYPE_LABELS[type]}</strong> request
            </p>
          )}
        </DialogHeader>

        {step === 1 ? (
          <>
            <div className="space-y-3 py-1">
              {allUsers.length > 1 && (
                <div>
                  <Label htmlFor="req-for">Requesting On Behalf Of</Label>
                  <Select value={requestedForId} onValueChange={handleRequestedForChange}>
                    <SelectTrigger data-testid="select-requested-for" id="req-for" className="mt-1">
                      <SelectValue placeholder="Myself" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_self">Myself</SelectItem>
                      {allUsers.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName} ({ROLE_DISPLAY[u.role] || u.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Label>What type of request is this?</Label>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    data-testid={`type-card-${k}`}
                    onClick={() => handleTypeSelect(k)}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary transition-colors text-left"
                  >
                    <span className="text-2xl leading-none mt-0.5">{TYPE_ICONS[k]}</span>
                    <div>
                      <p className="font-semibold text-sm">{v}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{TYPE_DESCRIPTIONS[k]}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-1">
              <div>
                <Label htmlFor="req-title">Title <span className="text-destructive">*</span></Label>
                <Input id="req-title" data-testid="input-request-title" className="mt-1" placeholder="Brief summary of your request" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              {type === "access" && <AccessFields data={templateData} onChange={setTemplateData} />}
              {type === "hr" && <HrFields data={templateData} onChange={setTemplateData} />}
              {type === "ops" && <OpsFields data={templateData} onChange={setTemplateData} onPriorityChange={setPriority} />}
              {type === "general" && <GeneralFields data={templateData} onChange={setTemplateData} />}
              <div>
                <Label htmlFor="req-desc">Full Description <span className="text-destructive">*</span></Label>
                <Textarea id="req-desc" data-testid="input-request-description" className="mt-1 resize-none" placeholder="Provide as much detail as possible…" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger data-testid="select-request-priority" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="req-date">Needed By (optional)</Label>
                  <Input id="req-date" type="date" className="mt-1" value={neededByDate} onChange={(e) => setNeededByDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="req-attachment">Attachment URL (optional)</Label>
                <Input id="req-attachment" data-testid="input-attachment-url" className="mt-1" placeholder="https://drive.google.com/… or any public link" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Paste a link to a document, screenshot, or relevant file.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isPending}>← Back</Button>
              <Button onClick={handleSubmit} disabled={isPending} data-testid="button-submit-request">
                {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting…</> : "Submit Request"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || { label: status, color: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock };
  return <Badge variant="outline" className={`text-xs ${s.color}`}>{s.label}</Badge>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY_LABELS[priority] || { label: priority, color: "bg-slate-100 text-slate-600" };
  return <Badge variant="outline" className={`text-xs ${p.color}`}>{p.label}</Badge>;
}

export default function RequestsTab() {
  const { user } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: requests = [], isLoading } = useQuery<HirdRequest[]>({
    queryKey: ["/api/help-desk/requests"],
  });

  const { data: stats } = useQuery<{ open: number; pendingApproval: number; resolved: number; total: number }>({
    queryKey: ["/api/help-desk/requests/stats"],
  });

  // "My Requests" shows only self-submitted tickets (important for managers who also see team tickets)
  const myRequests = requests.filter(r => !r.requester || r.requester.id === user?.id);
  const filtered = filterStatus === "all" ? myRequests : myRequests.filter(r => r.status === filterStatus);

  return (
    <div className="space-y-4" data-testid="requests-tab">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">My Requests</h2>
          <p className="text-sm text-muted-foreground">Submit and track your internal requests</p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)} data-testid="button-new-request">
          <Plus className="h-4 w-4 mr-1" />New Request
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Open", value: stats.open, color: "text-blue-600" },
            { label: "Pending Approval", value: stats.pendingApproval, color: "text-amber-600" },
            { label: "Resolved", value: stats.resolved, color: "text-green-600" },
            { label: "Total", value: stats.total, color: "text-slate-600" },
          ].map((s) => (
            <Card key={s.label} className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all", label: "All" },
          { value: "pending_approval", label: "Pending" },
          { value: "in_progress", label: "In Progress" },
          { value: "resolved", label: "Resolved" },
          { value: "closed", label: "Closed" },
        ].map(f => (
          <Button key={f.value} variant={filterStatus === f.value ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(f.value)} data-testid={`filter-${f.value}`}>
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />Loading requests…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">{filterStatus === "all" ? "No requests yet" : `No ${filterStatus.replace("_", " ")} requests`}</p>
          {filterStatus === "all" && <p className="text-sm mt-1">Click "New Request" to submit your first request.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Link href={`/admin/help-desk/${r.id}`} key={r.id}>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors cursor-pointer" data-testid={`request-row-${r.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">{r.requestNumber}</span>
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[r.type] || r.type}</Badge>
                    <StatusBadge status={r.status} />
                    <PriorityBadge priority={r.priority} />
                  </div>
                  <p className="font-medium text-sm mt-1 truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy") : ""}
                    {r.assignedTo && ` · Assigned to ${r.assignedTo.firstName}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <NewRequestDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
