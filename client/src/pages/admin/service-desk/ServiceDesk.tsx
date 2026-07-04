import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Key, FileText, Settings, ClipboardList,
  CheckCircle2, ExternalLink, Send, AlertCircle,
  Clock, LifeBuoy, Plus, Trash2, FileEdit, Wallet,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const REQUEST_TILES = [
  {
    id: "access",
    label: "Access",
    description: "System access, permissions, tool accounts",
    icon: Key,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    subtypes: [] as string[],
    placeholder: "",
  },
  {
    id: "hr",
    label: "HR",
    description: "Leave disputes, payroll, documents",
    icon: FileText,
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    subtypes: ["Letter Request", "Payslip Issue", "Leave Issue", "Policy Clarification", "Salary Discrepancy", "Documentation", "Other"],
    placeholder: "Describe your HR request — include relevant dates, payslip periods, or document type needed.",
  },
  {
    id: "ops",
    label: "Operations",
    description: "Equipment, facilities, onboarding support",
    icon: Settings,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    subtypes: ["Equipment / hardware", "Facilities request", "Onboarding support", "Software / tool issue", "Other ops request"],
    placeholder: "Describe the equipment, facility, or onboarding issue. Include urgency and any blocking impact.",
  },
  {
    id: "general",
    label: "General",
    description: "Other requests and enquiries",
    icon: ClipboardList,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
    subtypes: ["General enquiry", "Feedback / suggestion", "Compliance question", "Other"],
    placeholder: "Describe your request or enquiry in detail.",
  },
  {
    id: "salary_advance",
    label: "Salary Advance",
    description: "Request an advance on your upcoming salary",
    icon: Wallet,
    color: "text-teal-600",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    border: "border-teal-200 dark:border-teal-800",
    subtypes: [] as string[],
    placeholder: "",
  },
] as const;

type TileId = typeof REQUEST_TILES[number]["id"];
type Tile = typeof REQUEST_TILES[number];

const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  needs_info: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending Approval",
  assigned: "Assigned",
  in_progress: "In Progress",
  needs_info: "Action Needed",
  resolved: "Resolved",
  closed: "Closed",
  rejected: "Rejected",
};

const TYPE_LABELS: Record<string, string> = {
  access: "Access",
  hr: "HR",
  ops: "Operations",
  general: "General",
  salary_advance: "Salary Advance",
};

// ── Access template form ──────────────────────────────────────────────────────
interface AccessDraft {
  system: string;
  accessLevel: "" | "view_only" | "contributor" | "admin" | "custom";
  grantFrom: string;
  creditsInvolved: boolean;
  creditCount: string;
  justification: string;
}

function AccessTemplateForm({
  value,
  onChange,
}: {
  value: AccessDraft;
  onChange: (v: AccessDraft) => void;
}) {
  const set = (patch: Partial<AccessDraft>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="access-system">
          System / Tool name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="access-system"
          placeholder="e.g. Salesforce, AWS console, Jira"
          value={value.system}
          onChange={(e) => set({ system: e.target.value })}
          maxLength={120}
          data-testid="input-access-system"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="access-level">
          Access level <span className="text-destructive">*</span>
        </Label>
        <Select
          value={value.accessLevel}
          onValueChange={(v) => set({ accessLevel: v as AccessDraft["accessLevel"] })}
        >
          <SelectTrigger id="access-level" data-testid="select-access-level">
            <SelectValue placeholder="Select access level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="view_only">Read — view only</SelectItem>
            <SelectItem value="contributor">Write — create and edit</SelectItem>
            <SelectItem value="admin">Admin — full control</SelectItem>
            <SelectItem value="custom">Custom — specify in justification</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="access-grant-from">
          Grant access from (person or team)
        </Label>
        <Input
          id="access-grant-from"
          placeholder="e.g. IT Admin team, John Smith"
          value={value.grantFrom}
          onChange={(e) => set({ grantFrom: e.target.value })}
          maxLength={120}
          data-testid="input-access-grant-from"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Credits involved?</p>
          <p className="text-xs text-muted-foreground">Does this access require paid credits or a licence fee?</p>
        </div>
        <Switch
          checked={value.creditsInvolved}
          onCheckedChange={(v) => set({ creditsInvolved: v, creditCount: v ? value.creditCount : "" })}
          data-testid="switch-credits-involved"
        />
      </div>

      {value.creditsInvolved && (
        <div className="space-y-1.5">
          <Label htmlFor="access-credit-count">
            Number of credits / seats <span className="text-destructive">*</span>
          </Label>
          <Input
            id="access-credit-count"
            type="number"
            min="1"
            placeholder="e.g. 5"
            value={value.creditCount}
            onChange={(e) => set({ creditCount: e.target.value })}
            data-testid="input-credit-count"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="access-justification">
            Business Justification <span className="text-destructive">*</span>
            <span className="text-xs font-normal text-muted-foreground ml-1">(min. 50 chars)</span>
          </Label>
          <button
            type="button"
            onClick={() => set({ justification: JUSTIFICATION_TEMPLATE })}
            className="flex items-center gap-1 text-xs text-muted-foreground border border-dashed rounded px-2 py-0.5 hover:text-foreground hover:border-foreground/40 transition-colors"
            data-testid="button-use-template-access"
          >
            <FileEdit className="h-3 w-3" />
            Use Template
          </button>
        </div>
        <Textarea
          id="access-justification"
          placeholder={JUSTIFICATION_PLACEHOLDER}
          rows={4}
          value={value.justification}
          onChange={(e) => set({ justification: e.target.value })}
          data-testid="textarea-access-justification"
        />
        <p className="text-xs text-muted-foreground text-right">
          {value.justification.trim().length} / 50 min
        </p>
      </div>
    </div>
  );
}

const JUSTIFICATION_TEMPLATE = `Purpose: [What will this be used for?]
Project / Client: [Which engagement or team does this support?]
Urgency / Why now: [Timeline, deadline, or blocker this resolves]`;

const JUSTIFICATION_PLACEHOLDER = "What is the purpose of this request? Which project or client does it support? Why is it needed now?";

interface HardwareItem {
  description: string;
  qty: number;
}

// ── New Request Modal ─────────────────────────────────────────────────────────
function NewRequestModal({
  tile,
  onClose,
}: {
  tile: Tile;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [hirdRef, setHirdRef] = useState<string | null>(null);

  // Shared fields
  const [subject, setSubject] = useState("");
  const [subtype, setSubtype] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"p1" | "p2" | "p3" | "p4">("p3");

  // Hardware items (Equipment / hardware subtype)
  const [hardwareItems, setHardwareItems] = useState<HardwareItem[]>([{ description: "", qty: 1 }]);

  // Tile-type booleans — declared first so hooks below can reference them safely
  const isAccessTile = tile.id === "access";
  const isSalaryAdvanceTile = tile.id === "salary_advance";
  const isEquipmentHardware = tile.id === "ops" && subtype === "Equipment / hardware";

  // Salary advance–specific
  const [saAmount, setSaAmount] = useState("");
  const [saReason, setSaReason] = useState("");
  const [saMonths, setSaMonths] = useState("3");
  const [saFile, setSaFile] = useState<File | null>(null);
  const [saAmountDebounced, setSaAmountDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSaAmountDebounced(saAmount), 600);
    return () => clearTimeout(t);
  }, [saAmount]);

  const { data: saEligibility } = useQuery<{ warnings: string[]; exceedsCap50: boolean; netSalary: number; cap: number }>({
    queryKey: ["/api/salary-advances/eligibility-check", saAmountDebounced],
    queryFn: async () => {
      const amt = parseFloat(saAmountDebounced);
      if (!amt || amt <= 0) return { warnings: [], exceedsCap50: false, netSalary: 0, cap: 0 };
      const res = await fetch(`/api/salary-advances/eligibility-check?amount=${amt}`, { credentials: "include" });
      if (!res.ok) return { warnings: [], exceedsCap50: false, netSalary: 0, cap: 0 };
      return res.json();
    },
    enabled: isSalaryAdvanceTile && !!parseFloat(saAmountDebounced) && parseFloat(saAmountDebounced) > 0,
  });

  // Access-specific
  const [accessDraft, setAccessDraft] = useState<AccessDraft>({
    system: "",
    accessLevel: "",
    grantFrom: "",
    creditsInvolved: false,
    creditCount: "",
    justification: "",
  });

  // OPS-001 (Tool Access, Credential Control & Deprovisioning) awareness: when the
  // employee has this SOP assigned, remind them of their individual responsibility
  // and tag the access request to OPS-001 so it lands in the SOP's evidence trail.
  const { data: mySops } = useQuery<{ enabled: boolean; assignments: Array<{ sopId: string; code: string }> }>({
    queryKey: ["/api/sops/my-assignments"],
    enabled: isAccessTile,
  });
  const ops001 = isAccessTile && mySops?.enabled
    ? mySops.assignments.find((a) => a.code === "OPS-001")
    : undefined;

  const hasSubtypes = tile.subtypes.length > 0;
  // HR and Ops require a subtype; General's is optional
  const subtypeRequired = tile.id === "hr" || tile.id === "ops";

  const isAccessValid =
    accessDraft.system.trim().length > 0 &&
    accessDraft.accessLevel !== "" &&
    accessDraft.justification.trim().length >= 50 &&
    (!accessDraft.creditsInvolved || accessDraft.creditCount.trim().length > 0);

  const hardwareValid =
    !isEquipmentHardware ||
    (hardwareItems.length > 0 && hardwareItems.every((item) => item.description.trim().length > 0 && item.qty >= 1));

  const isStandardValid =
    subject.trim().length >= 5 &&
    description.trim().length >= 20 &&
    (!subtypeRequired || subtype.length > 0) &&
    hardwareValid;

  const isSaValid =
    subject.trim().length >= 3 &&
    saReason.trim().length >= 5 &&
    parseFloat(saAmount) > 0;

  const isValid = isAccessTile
    ? (subject.trim().length >= 5 && isAccessValid)
    : isSalaryAdvanceTile
      ? isSaValid
      : isStandardValid;

  const addHardwareRow = () =>
    setHardwareItems((prev) => [...prev, { description: "", qty: 1 }]);

  const removeHardwareRow = (idx: number) =>
    setHardwareItems((prev) => prev.filter((_, i) => i !== idx));

  const updateHardwareRow = (idx: number, patch: Partial<HardwareItem>) =>
    setHardwareItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));

  const buildTemplateData = (): Record<string, any> | undefined => {
    if (isAccessTile) {
      return {
        system: accessDraft.system.trim(),
        accessLevel: accessDraft.accessLevel,
        requestedRole: accessDraft.grantFrom.trim() || undefined,
        creditsInvolved: accessDraft.creditsInvolved,
        creditCount: accessDraft.creditsInvolved ? parseInt(accessDraft.creditCount) || undefined : undefined,
        justification: accessDraft.justification.trim(),
      };
    }
    if (isSalaryAdvanceTile) {
      return {
        requestedAmount: parseFloat(saAmount) || 0,
        reason: saReason.trim(),
        repaymentMonths: parseInt(saMonths, 10) || 3,
      };
    }
    if (tile.id === "hr") {
      return { requestSubtype: subtype };
    }
    if (tile.id === "ops") {
      return { requestSubtype: subtype };
    }
    // general — backend GENERAL_TEMPLATE uses `category`
    return subtype ? { category: subtype } : {};
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/help-desk/requests", {
        type: tile.id,
        title: subject.trim(),
        description: isAccessTile
          ? accessDraft.justification.trim()
          : isSalaryAdvanceTile
            ? saReason.trim()
            : description.trim(),
        priority,
        templateData: buildTemplateData(),
        linkedSopId: isAccessTile && ops001 ? ops001.sopId : undefined,
        hardwareItems: isEquipmentHardware
          ? hardwareItems.filter((i) => i.description.trim()).map((i) => ({ description: i.description.trim(), qty: i.qty }))
          : undefined,
      });
      return res.json();
    },
    onSuccess: async (data: any) => {
      setHirdRef(data?.requestNumber || null);
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests"] });
      // If a file was attached and the server created a linked advance, upload it now
      if (isSalaryAdvanceTile && saFile && data?.linkedAdvanceId) {
        try {
          const advId = data.linkedAdvanceId;
          // 1. Get server-scoped upload URL + HMAC token
          const urlRes = await fetch("/api/salary-advances/request-upload", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ advanceId: advId }),
          });
          if (urlRes.ok) {
            const { uploadURL, uploadToken } = await urlRes.json();
            // 2. Upload to object storage
            await fetch(uploadURL, { method: "PUT", body: saFile, headers: { "Content-Type": saFile.type || "application/octet-stream" } });
            // 3. Record with HMAC token (objectPath comes from token, not client)
            await fetch(`/api/salary-advances/${advId}/attachments`, {
              method: "POST", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uploadToken, fileName: saFile.name, contentType: saFile.type, sizeBytes: saFile.size }),
            });
          }
        } catch { /* non-fatal — request already submitted */ }
      }
    },
    onError: (err: any) => {
      toast({
        title: "Submission failed",
        description: err?.message || "Could not submit your request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    submitMutation.mutate();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="modal-new-request">
        {hirdRef ? (
          // ── Success state ──
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-lg">Request Submitted</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your request has been logged and is pending manager approval.
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-muted/60 border w-full justify-center">
              <span className="text-xs text-muted-foreground">Reference number</span>
              <span className="font-mono font-bold text-sm tracking-wide text-foreground" data-testid="text-hird-ref">{hirdRef}</span>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg border border-dashed text-xs text-muted-foreground text-left w-full">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
              <span>
                For urgent issues,{" "}
                <a href="mailto:ops@hire-in.com" className="underline text-foreground">
                  contact Ops directly at ops@hire-in.com
                </a>.
              </span>
            </div>
            <Button onClick={onClose} className="w-full" data-testid="button-close-success">
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-md ${tile.bg}`}>
                  <tile.icon className={`h-4 w-4 ${tile.color}`} />
                </div>
                New {tile.label} Request
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-1">
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject <span className="text-destructive">*</span></Label>
                <Input
                  id="subject"
                  placeholder="Brief summary of your request"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={120}
                  data-testid="input-request-subject"
                />
              </div>

              {/* Subtype selector for HR / Ops / General */}
              {!isAccessTile && hasSubtypes && (
                <div className="space-y-1.5">
                  <Label htmlFor="sub-type">
                    Request type
                    {subtypeRequired && <span className="text-destructive"> *</span>}
                  </Label>
                  <Select value={subtype} onValueChange={(v) => { setSubtype(v); setHardwareItems([{ description: "", qty: 1 }]); }}>
                    <SelectTrigger id="sub-type" data-testid="select-sub-type">
                      <SelectValue placeholder="Select a request type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(tile.subtypes as readonly string[]).map((st) => (
                        <SelectItem key={st} value={st}>{st}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isAccessTile && ops001 && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 text-xs" data-testid="note-ops001-responsibility">
                  <Key className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />
                  <span className="text-muted-foreground">
                    Per <span className="font-medium text-foreground">OPS-001 — Tool Access, Credential Control &amp; Deprovisioning</span>,
                    requesting access under least privilege and awaiting approval before use is your individual responsibility.
                    This request will be linked to OPS-001 for your access record.
                  </span>
                </div>
              )}

              {isSalaryAdvanceTile ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-teal-200 bg-teal-50 dark:bg-teal-950/30 p-3 text-xs text-teal-800 dark:text-teal-200">
                    Your request will be routed to your manager for approval, then HR for final sign-off. Repayment will be deducted from your future payslips.
                  </div>
                  {saEligibility?.exceedsCap50 && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200" data-testid="banner-sa-cap-warning">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <p>This amount exceeds <strong>50% of your net salary</strong>. Your request will go through an additional CEO approval step before disbursement.</p>
                    </div>
                  )}
                  {saEligibility?.warnings && saEligibility.warnings.length > 0 && (
                    <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-xs text-amber-700 space-y-0.5" data-testid="banner-sa-eligibility-warnings">
                      {saEligibility.warnings.map((w, i) => <p key={i}>• {w}</p>)}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="sa-amount">Amount (₹) <span className="text-destructive">*</span></Label>
                      <Input
                        id="sa-amount"
                        type="number"
                        min={1}
                        placeholder="e.g. 25000"
                        value={saAmount}
                        onChange={(e) => setSaAmount(e.target.value)}
                        data-testid="input-sa-amount"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sa-months">Repayment Months</Label>
                      <Input
                        id="sa-months"
                        type="number"
                        min={1}
                        max={12}
                        placeholder="3"
                        value={saMonths}
                        onChange={(e) => setSaMonths(e.target.value)}
                        data-testid="input-sa-months"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sa-reason">Reason <span className="text-destructive">*</span></Label>
                    <Textarea
                      id="sa-reason"
                      placeholder="Why do you need this advance? E.g. medical expense, relocation cost..."
                      rows={3}
                      value={saReason}
                      onChange={(e) => setSaReason(e.target.value)}
                      data-testid="textarea-sa-reason"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sa-doc" className="text-xs">Supporting Document <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <div className="flex items-center gap-2">
                      <label htmlFor="sa-doc" className="cursor-pointer flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors">
                        <FileText className="h-3.5 w-3.5" />
                        {saFile ? saFile.name : "Choose file…"}
                        <input
                          id="sa-doc"
                          type="file"
                          className="sr-only"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => setSaFile(e.target.files?.[0] || null)}
                          data-testid="input-sa-file"
                        />
                      </label>
                      {saFile && (
                        <button type="button" onClick={() => setSaFile(null)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                      )}
                    </div>
                  </div>
                </div>
              ) : isAccessTile ? (
                <AccessTemplateForm value={accessDraft} onChange={setAccessDraft} />
              ) : (
                <>
                  {/* Equipment / hardware — inline item table */}
                  {isEquipmentHardware && (
                    <div className="space-y-2" data-testid="hardware-items-section">
                      <p className="text-sm font-medium">Hardware Items <span className="text-destructive">*</span></p>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/60 border-b">
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-full">Item / Description</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-16">Qty</th>
                              <th className="px-2 py-2 w-8" />
                            </tr>
                          </thead>
                          <tbody>
                            {hardwareItems.map((item, idx) => (
                              <tr key={idx} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                                <td className="px-2 py-1.5">
                                  <Input
                                    placeholder="e.g. Dell Latitude 15 Laptop"
                                    value={item.description}
                                    onChange={(e) => updateHardwareRow(idx, { description: e.target.value })}
                                    className="h-7 text-sm border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-ring px-1"
                                    data-testid={`input-hw-desc-${idx}`}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <Input
                                    type="number"
                                    min={1}
                                    value={item.qty}
                                    onChange={(e) => updateHardwareRow(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                                    className="h-7 text-sm border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-ring px-1 w-14"
                                    data-testid={`input-hw-qty-${idx}`}
                                  />
                                </td>
                                <td className="px-1 py-1.5">
                                  <button
                                    type="button"
                                    onClick={() => removeHardwareRow(idx)}
                                    disabled={hardwareItems.length === 1}
                                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
                                    data-testid={`button-hw-remove-${idx}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="border-t px-3 py-1.5">
                          <button
                            type="button"
                            onClick={addHardwareRow}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                            data-testid="button-hw-add-row"
                          >
                            <Plus className="h-3 w-3" />
                            Add item
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Business Justification field (all non-access types) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="description">
                        Business Justification <span className="text-destructive">*</span>
                        <span className="text-xs font-normal text-muted-foreground ml-1">(min. 20 chars)</span>
                      </Label>
                      <button
                        type="button"
                        onClick={() => setDescription(JUSTIFICATION_TEMPLATE)}
                        className="flex items-center gap-1 text-xs text-muted-foreground border border-dashed rounded px-2 py-0.5 hover:text-foreground hover:border-foreground/40 transition-colors"
                        data-testid="button-use-template"
                      >
                        <FileEdit className="h-3 w-3" />
                        Use Template
                      </button>
                    </div>
                    <Textarea
                      id="description"
                      placeholder={JUSTIFICATION_PLACEHOLDER}
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      data-testid="textarea-request-description"
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {description.trim().length} / 20 min
                    </p>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as typeof priority)}
                >
                  <SelectTrigger id="priority" data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p4">Low — no deadline, general request</SelectItem>
                    <SelectItem value="p3">Medium — needed within a few days</SelectItem>
                    <SelectItem value="p2">High — needed soon</SelectItem>
                    <SelectItem value="p1">Critical — blocking my work now</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  data-testid="button-cancel-request"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isValid || submitMutation.isPending}
                  className="flex-1 gap-2"
                  data-testid="button-submit-request"
                >
                  <Send className="h-4 w-4" />
                  {submitMutation.isPending ? "Submitting…" : "Submit Request"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
interface HirdRequest {
  id: string;
  requestNumber: string;
  type: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  linkedAdvanceId?: string | null;
  linkedAdvanceStatus?: string | null;
}

const ADVANCE_STATUS_LABELS: Record<string, string> = {
  pending_manager: "Awaiting Manager",
  pending_final: "Awaiting HR Approval",
  pending_ceo: "Awaiting CEO",
  approved: "Approved",
  disbursed: "Disbursed",
  repaying: "In Repayment",
  settled: "Settled",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const ADVANCE_STATUS_COLORS: Record<string, string> = {
  pending_manager: "bg-yellow-100 text-yellow-800",
  pending_final: "bg-blue-100 text-blue-800",
  pending_ceo: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  disbursed: "bg-green-100 text-green-800",
  repaying: "bg-teal-100 text-teal-800",
  settled: "bg-gray-100 text-gray-600",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function ServiceDesk() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { enabled: newLook } = useNewLook();
  const { toast } = useToast();
  const [activeTile, setActiveTile] = useState<Tile | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    document.title = "Service Desk | Hire'in Portal";
    return () => { document.title = "Hire'in Portal"; };
  }, []);

  const { data: myRequests, isLoading: requestsLoading } = useQuery<HirdRequest[]>({
    queryKey: ["/api/help-desk/requests"],
    queryFn: async () => {
      const res = await fetch("/api/help-desk/requests", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const openRequests = (myRequests || []).filter(
    (r) => !["resolved", "closed", "rejected"].includes(r.status)
  );

  if (authLoading || !isAuthenticated) return null;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={LifeBuoy}
            eyebrow="Service Desk"
            title="Service Desk"
            subtitle="Raise internal support requests — we'll take it from there."
            testId="text-service-desk-title"
          />
        ) : (
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-service-desk-title">Service Desk</h1>
            <p className="text-sm text-muted-foreground">Raise internal support requests — we'll take it from there.</p>
          </div>
        )}

        {/* Request type tiles */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">What do you need help with?</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {REQUEST_TILES.map((tile) => (
              <button
                key={tile.id}
                onClick={() => setActiveTile(tile)}
                className={`group flex flex-col items-start gap-3 p-4 rounded-xl border-2 ${tile.border} ${tile.bg} hover:shadow-md transition-all duration-150 text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
                data-testid={`tile-${tile.id}`}
              >
                <div className="p-2 rounded-lg bg-white dark:bg-background shadow-sm">
                  <tile.icon className={`h-5 w-5 ${tile.color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{tile.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{tile.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* My open requests */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">
              My Open Requests
              {!requestsLoading && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({openRequests.length})
                </span>
              )}
            </p>
          </div>

          {requestsLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                <Clock className="h-6 w-6 mx-auto mb-2 animate-spin opacity-40" />
                Loading requests…
              </CardContent>
            </Card>
          ) : openRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center" data-testid="service-desk-empty-state">
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-3" />
                <p className="text-sm font-medium text-foreground">No open requests — you're all set ✓</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use the tiles above to raise a new request.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2" data-testid="open-requests-list">
              {openRequests.map((req) => (
                <Card key={req.id} data-testid={`request-card-${req.id}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-muted-foreground" data-testid={`text-hird-number-${req.id}`}>
                            {req.requestNumber}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 h-4 capitalize">
                            {TYPE_LABELS[req.type] || req.type}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium mt-0.5 truncate" data-testid={`text-request-title-${req.id}`}>{req.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status] || "bg-muted text-muted-foreground"}`}
                          data-testid={`badge-status-${req.id}`}
                        >
                          {STATUS_LABELS[req.status] || req.status}
                        </span>
                        {req.type === "salary_advance" && req.linkedAdvanceStatus && (
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ADVANCE_STATUS_COLORS[req.linkedAdvanceStatus] || "bg-muted text-muted-foreground"}`}
                            data-testid={`badge-advance-status-${req.id}`}
                          >
                            {ADVANCE_STATUS_LABELS[req.linkedAdvanceStatus] || req.linkedAdvanceStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Info strip */}
        <div className="flex items-start gap-2 p-3 rounded-lg border border-dashed text-xs text-muted-foreground" data-testid="service-desk-info">
          <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            For urgent issues,{" "}
            <a href="mailto:ops@hire-in.com" className="underline text-foreground hover:text-primary transition-colors">
              contact Ops directly at ops@hire-in.com
            </a>.
          </span>
        </div>
      </div>

      {/* New Request Modal */}
      {activeTile && (
        <NewRequestModal
          tile={activeTile}
          onClose={() => setActiveTile(null)}
        />
      )}
    </AdminLayout>
  );
}
