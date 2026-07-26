import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  FileText, Plus, Search, Download, Send, CheckCircle, Upload,
  Building2, FileUp, Eye, Clock, XCircle, PenLine, FilePlus,
  ReceiptText, Calendar, DollarSign, RefreshCw, AlertCircle, X,
  Loader2, ShieldCheck, Users, Globe, User, ScrollText, ClipboardList, ThumbsUp, RotateCcw
} from "lucide-react";
import type { Contract, ContractClient } from "@shared/schema";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import ContractGenerator from "./ContractGenerator";
import FreeformMsaGenerator from "./FreeformMsaGenerator";
import ImportContract from "./ImportContract";
import ClientRegistry from "./ClientRegistry";
import ContractTemplates from "./ContractTemplates";
import InvoiceTracker from "./InvoiceTracker";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  pending_dispatch_approval: "bg-violet-100 text-violet-700",
  sent: "bg-blue-100 text-blue-700",
  client_signed: "bg-amber-100 text-amber-700",
  countersigned: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  pending_review: "bg-amber-100 text-amber-800",
  needs_revision: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_dispatch_approval: "Pending Approval",
  sent: "Sent",
  client_signed: "Client Signed",
  countersigned: "Countersigned",
  cancelled: "Cancelled",
  pending_review: "Pending Review",
  needs_revision: "Needs Revision",
};

const SOURCE_LABELS: Record<string, string> = {
  generated: "Generated",
  imported: "Imported",
};

function ContractStatusIcon({ status }: { status: string }) {
  if (status === "countersigned") return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (status === "client_signed") return <PenLine className="h-4 w-4 text-amber-600" />;
  if (status === "sent") return <Send className="h-4 w-4 text-blue-600" />;
  if (status === "cancelled") return <XCircle className="h-4 w-4 text-red-600" />;
  if (status === "pending_dispatch_approval") return <AlertCircle className="h-4 w-4 text-violet-600" />;
  return <Clock className="h-4 w-4 text-slate-500" />;
}

interface CcRecipient {
  email: string;
  name: string;
  source: "employee" | "manual";
}

const INTERNAL_DOMAINS = ["hirein.com", "hirein.solutions", "rayomind.com"];
function isExternalEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  return !domain || !INTERNAL_DOMAINS.includes(domain);
}

export default function ContractsHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { enabled: newLook } = useNewLook();
  const [tab, setTab] = useState("contracts");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showGenerator, setShowGenerator] = useState(false);
  const [showMsaBuilder, setShowMsaBuilder] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Dispatch modal state
  const [dispatchContract, setDispatchContract] = useState<Contract | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<"esign_link" | "presigned_pdf" | "both">("esign_link");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [dispatchNote, setDispatchNote] = useState("");
  const [ccList, setCcList] = useState<CcRecipient[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [ccNameInput, setCcNameInput] = useState("");

  // Reject modal state
  const [rejectContract, setRejectContract] = useState<Contract | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Approval delivery-method picker state
  const [approvalContract, setApprovalContract] = useState<Contract | null>(null);
  const [approvalDeliveryMethod, setApprovalDeliveryMethod] = useState<"esign_link" | "presigned_pdf" | "both">("esign_link");
  const [approvalRecipientEmail, setApprovalRecipientEmail] = useState("");

  // Employee CC picker state
  const [ccEmployeeSearch, setCcEmployeeSearch] = useState("");
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);

  const isSuperAdmin = user?.role === "super_admin" || user?.role === "architect";
  const canManage = ["super_admin", "admin", "hr", "operations"].includes(user?.role || "");
  const canCreate = ["super_admin", "admin", "hr", "operations", "manager", "director"].includes(user?.role || "");
  const isSubmitter = user?.role === "manager" || user?.role === "director";

  const canDispatch = ["super_admin", "admin", "hr", "operations", "manager"].includes(user?.role || "");
  const canCountersign = ["super_admin", "admin", "hr"].includes(user?.role || "");
  const canApproveDispatch = isSuperAdmin;
  const canReviewSubmissions = ["super_admin", "admin", "operations"].includes(user?.role || "");

  useEffect(() => {
    if (isSubmitter && tab === "contracts") {
      setTab("my-submissions");
    }
  }, [isSubmitter]);

  // Review modal state
  const [reviewContract, setReviewContract] = useState<Contract | null>(null);
  const [revisionReason, setRevisionReason] = useState("");
  const [showRevisionModal, setShowRevisionModal] = useState(false);

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: mySubmissions = [], isLoading: mySubLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts/my-submissions"],
    enabled: isSubmitter,
  });

  const { data: pendingSubmissions = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contracts/pending-submissions"],
    enabled: canReviewSubmissions,
  });

  const { data: clients = [] } = useQuery<ContractClient[]>({
    queryKey: ["/api/contracts/clients"],
  });

  const { data: adminUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/admin-users"],
  });

  const dispatchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, any> }) =>
      apiRequest("POST", `/api/contracts/${id}/dispatch`, body),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      const data = await res.json().catch(() => ({}));
      setDispatchContract(null);
      resetDispatchForm();
      if (isSuperAdmin) {
        toast({ title: "Contract dispatched", description: data.signingUrl ? `Signing URL: ${data.signingUrl}` : "Sent successfully" });
      } else {
        toast({ title: "Dispatch request submitted", description: "Waiting for super-admin approval" });
      }
    },
    onError: (e: any) => toast({ title: "Dispatch failed", description: e.message, variant: "destructive" }),
  });

  const approveDispatchMutation = useMutation({
    mutationFn: ({ id, deliveryMethod, recipientEmail }: { id: string; deliveryMethod: string; recipientEmail?: string }) =>
      apiRequest("POST", `/api/contracts/${id}/dispatch/approve`, { deliveryMethod, recipientEmail }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Dispatch approved and sent" });
    },
    onError: (e: any) => toast({ title: "Approval failed", description: e.message, variant: "destructive" }),
  });

  const rejectDispatchMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/contracts/${id}/dispatch/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setRejectContract(null);
      setRejectReason("");
      toast({ title: "Dispatch request rejected" });
    },
    onError: (e: any) => toast({ title: "Rejection failed", description: e.message, variant: "destructive" }),
  });

  const countersignMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/contracts/${id}/countersign`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Contract countersigned successfully" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const approveSubmissionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/contracts/${id}/approve-submission`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/pending-submissions"] });
      toast({ title: "Contract approved and added to live ledger" });
    },
    onError: (e: any) => toast({ title: "Approval failed", description: e.message, variant: "destructive" }),
  });

  const reviseSubmissionMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/contracts/${id}/revise-submission`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/pending-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/my-submissions"] });
      setShowRevisionModal(false);
      setReviewContract(null);
      setRevisionReason("");
      toast({ title: "Revision requested — submitter has been notified" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const filtered = contracts.filter(c => {
    const matchSearch = !search ||
      c.clientName.toLowerCase().includes(search.toLowerCase()) ||
      c.candidateName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingApproval = contracts.filter(c => c.status === "pending_dispatch_approval");

  const stats = {
    total: contracts.length,
    active: contracts.filter(c => c.status === "countersigned").length,
    pending: contracts.filter(c => ["sent", "client_signed"].includes(c.status)).length,
    pendingApproval: pendingApproval.length,
    pendingReview: pendingSubmissions.length,
  };

  const handleDownload = (contract: Contract) => {
    window.open(`/api/contracts/${contract.id}/download`, "_blank");
  };

  const handleView = (contract: Contract) => {
    window.open(`/api/contracts/${contract.id}/view`, "_blank");
  };

  function resetDispatchForm() {
    setDeliveryMethod("esign_link");
    setRecipientEmail("");
    setDispatchNote("");
    setCcList([]);
    setCcInput("");
    setCcNameInput("");
    setCcEmployeeSearch("");
    setShowEmployeePicker(false);
  }

  function openDispatch(contract: Contract) {
    setDispatchContract(contract);
    resetDispatchForm(); // clears all fields first
    // Pre-fill recipient email AFTER reset so it is not cleared
    const client = clients.find(c => c.id === contract.clientId);
    setRecipientEmail(client?.email || "");
  }

  function addCc() {
    if (!ccInput || !ccInput.includes("@")) return;
    setCcList(prev => [...prev, { email: ccInput, name: ccNameInput || ccInput, source: "manual" }]);
    setCcInput("");
    setCcNameInput("");
  }

  function addEmployeeCc(emp: any) {
    const email = emp.email;
    if (!email) return;
    if (ccList.some(c => c.email === email)) {
      toast({ title: "Already added", description: `${email} is already in the CC list`, variant: "destructive" });
      return;
    }
    const name = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || email;
    setCcList(prev => [...prev, { email, name, source: "employee" }]);
    setCcEmployeeSearch("");
    setShowEmployeePicker(false);
  }

  const filteredEmployees = ccEmployeeSearch.length >= 1
    ? (adminUsers as any[]).filter(emp =>
        emp.email &&
        !ccList.some(c => c.email === emp.email) &&
        (`${emp.firstName || ""} ${emp.lastName || ""} ${emp.email}`.toLowerCase().includes(ccEmployeeSearch.toLowerCase()))
      ).slice(0, 8)
    : [];

  const externalCcs = ccList.filter(c => isExternalEmail(c.email));

  function handleDispatch() {
    if (!dispatchContract) return;
    const body: Record<string, any> = {
      ccRecipients: ccList,
      recipientEmail: recipientEmail || undefined,
    };
    if (isSuperAdmin) {
      body.deliveryMethod = deliveryMethod;
    } else {
      body.note = dispatchNote;
    }
    dispatchMutation.mutate({ id: dispatchContract.id, body });
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={ReceiptText}
            eyebrow="Finance"
            title="Finance & Contracts"
            subtitle="Manage client contracts, compliance documents, and invoice tracking"
            testId="text-contracts-hub-title"
            actions={canCreate ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowImport(true)} data-testid="button-import-contract" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  <Upload className="h-4 w-4 mr-2" /> {isSubmitter ? "Upload Contract" : "Import"}
                </Button>
                {!isSubmitter && (
                  <Button variant="outline" onClick={() => setShowMsaBuilder(true)} data-testid="button-new-msa" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                    <ScrollText className="h-4 w-4 mr-2" /> New MSA
                  </Button>
                )}
                <Button onClick={() => setShowGenerator(true)} data-testid="button-new-contract" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                  <Plus className="h-4 w-4 mr-2" /> {isSubmitter ? "Submit Contract" : "Generate"}
                </Button>
              </div>
            ) : undefined}
          />
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900" data-testid="text-contracts-hub-title">Finance & Contracts</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage client contracts, compliance documents, and invoice tracking</p>
            </div>
            {canCreate && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowImport(true)} data-testid="button-import-contract">
                  <Upload className="h-4 w-4 mr-2" /> {isSubmitter ? "Upload Contract" : "Import Contract"}
                </Button>
                {!isSubmitter && (
                  <Button variant="outline" onClick={() => setShowMsaBuilder(true)} data-testid="button-new-msa">
                    <ScrollText className="h-4 w-4 mr-2" /> New MSA (Freeform)
                  </Button>
                )}
                <Button onClick={() => setShowGenerator(true)} data-testid="button-new-contract">
                  <Plus className="h-4 w-4 mr-2" /> {isSubmitter ? "Submit Contract" : "Generate Contract"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Contracts", value: stats.total, icon: FileText, color: "text-slate-700" },
            { label: "Active (Signed)", value: stats.active, icon: CheckCircle, color: "text-green-600" },
            { label: "Pending Signature", value: stats.pending, icon: Clock, color: "text-amber-600" },
            { label: "Awaiting Approval", value: stats.pendingApproval, icon: AlertCircle, color: "text-violet-600" },
            ...(canReviewSubmissions ? [{ label: "Pending Review", value: stats.pendingReview, icon: ClipboardList, color: "text-amber-600" }] : []),
          ].map(s => (
            <Card key={s.label} className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color} opacity-80`} />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-10 flex-wrap">
            {!isSubmitter && (
              <TabsTrigger value="contracts" data-testid="tab-contracts">
                <FileText className="h-4 w-4 mr-1.5" /> Contracts
              </TabsTrigger>
            )}
            {isSubmitter && (
              <TabsTrigger value="my-submissions" data-testid="tab-my-submissions">
                <ClipboardList className="h-4 w-4 mr-1.5" /> My Submissions
              </TabsTrigger>
            )}
            {canReviewSubmissions && pendingSubmissions.length > 0 && (
              <TabsTrigger value="review-queue" data-testid="tab-review-queue">
                <ClipboardList className="h-4 w-4 mr-1.5 text-amber-600" />
                Review Queue
                <Badge className="ml-1.5 h-5 px-1.5 text-[10px] bg-amber-100 text-amber-800 border-amber-200">
                  {pendingSubmissions.length}
                </Badge>
              </TabsTrigger>
            )}
            {canApproveDispatch && pendingApproval.length > 0 && (
              <TabsTrigger value="pending-approval" data-testid="tab-pending-approval">
                <AlertCircle className="h-4 w-4 mr-1.5 text-violet-600" />
                Pending Approval
                <Badge className="ml-1.5 h-5 px-1.5 text-[10px] bg-violet-100 text-violet-700 border-violet-200">
                  {pendingApproval.length}
                </Badge>
              </TabsTrigger>
            )}
            {!isSubmitter && (
              <>
                <TabsTrigger value="invoices" data-testid="tab-invoices">
                  <ReceiptText className="h-4 w-4 mr-1.5" /> Invoices
                </TabsTrigger>
                <TabsTrigger value="clients" data-testid="tab-clients">
                  <Building2 className="h-4 w-4 mr-1.5" /> Client Registry
                </TabsTrigger>
                <TabsTrigger value="templates" data-testid="tab-templates">
                  <FilePlus className="h-4 w-4 mr-1.5" /> Templates
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* ── Contracts Tab ─────────────────────────── */}
          <TabsContent value="contracts" className="mt-4 space-y-4">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by client or candidate..."
                  className="pl-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-search-contracts"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48" data-testid="select-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_dispatch_approval">Pending Approval</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="client_signed">Client Signed</SelectItem>
                  <SelectItem value="countersigned">Countersigned</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading contracts...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No contracts found</p>
                <p className="text-sm mt-1">Generate a new contract or import an existing one.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Candidate / Role</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Start Date</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Billing</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(contract => (
                      <tr key={contract.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-contract-${contract.id}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{contract.clientName}</div>
                          {contract.templateName && (
                            <div className="text-xs text-muted-foreground">{contract.templateName}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>{contract.candidateName || "—"}</div>
                          <div className="text-xs text-muted-foreground">{contract.candidateRole || ""}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <ContractStatusIcon status={contract.status} />
                            <Badge className={`text-xs ${STATUS_COLORS[contract.status] || "bg-slate-100 text-slate-700"}`}>
                              {STATUS_LABELS[contract.status] || contract.status}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {SOURCE_LABELS[contract.source || "generated"]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {contract.contractStartDate
                            ? new Date(contract.contractStartDate).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {contract.billingFrequency ? (
                            <span className="capitalize">{contract.billingFrequency.replace(/_/g, " ")}</span>
                          ) : "—"}
                          {contract.paymentTermsDays ? ` · Net ${contract.paymentTermsDays}` : ""}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {(contract.docxPath || contract.uploadedDocPath) && (
                              <>
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => handleView(contract)}
                                  data-testid={`button-view-doc-${contract.id}`}
                                  title="View document"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => handleDownload(contract)}
                                  data-testid={`button-download-${contract.id}`}
                                  title="Download document"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {canDispatch && contract.source !== "imported" && ["draft", "pending_dispatch_approval"].includes(contract.status) && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => openDispatch(contract)}
                                data-testid={`button-dispatch-${contract.id}`}
                                title={isSuperAdmin ? "Dispatch contract" : "Request dispatch"}
                                className="text-[#1F3A6E] hover:text-blue-700"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            {canDispatch && contract.source !== "imported" && contract.status === "sent" && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => openDispatch(contract)}
                                data-testid={`button-resend-${contract.id}`}
                                title="Resend"
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            {canCountersign && contract.status === "client_signed" && (
                              <Button
                                variant="ghost" size="sm"
                                className="text-green-700"
                                onClick={() => countersignMutation.mutate(contract.id)}
                                data-testid={`button-countersign-${contract.id}`}
                                title="Countersign"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setSelectedContract(contract)}
                              data-testid={`button-view-${contract.id}`}
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── My Submissions Tab (manager/director only) ──────────── */}
          {isSubmitter && (
            <TabsContent value="my-submissions" className="mt-4 space-y-4">
              {mySubLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading submissions...</div>
              ) : mySubmissions.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No submissions yet</p>
                  <p className="text-sm mt-1">Use the buttons above to upload or generate a contract.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Candidate / Role</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {mySubmissions.map(contract => (
                        <tr key={contract.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-my-submission-${contract.id}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{contract.clientName}</div>
                            {contract.templateName && <div className="text-xs text-muted-foreground">{contract.templateName}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div>{contract.candidateName || "—"}</div>
                            <div className="text-xs text-muted-foreground">{contract.candidateRole || ""}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Badge className={`text-xs ${STATUS_COLORS[contract.status] || "bg-slate-100 text-slate-700"}`}>
                                {STATUS_LABELS[contract.status] || contract.status}
                              </Badge>
                            </div>
                            {contract.status === "needs_revision" && (contract as any).submissionRevisionReason && (
                              <div className="mt-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1 max-w-xs">
                                {(contract as any).submissionRevisionReason}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">
                              {SOURCE_LABELS[contract.source || "generated"]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {(contract.docxPath || contract.uploadedDocPath) && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => handleView(contract)} title="View document" data-testid={`button-view-my-${contract.id}`}>
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDownload(contract)} title="Download" data-testid={`button-download-my-${contract.id}`}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {contract.status === "needs_revision" && (
                                <Button
                                  variant="outline" size="sm"
                                  className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs"
                                  onClick={() => {
                                    // Resubmit via PATCH (backend auto-promotes needs_revision → pending_review)
                                    apiRequest("PATCH", `/api/contracts/${contract.id}`, {}).then(() => {
                                      queryClient.invalidateQueries({ queryKey: ["/api/contracts/my-submissions"] });
                                      toast({ title: "Resubmitted for review" });
                                    }).catch((e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }));
                                  }}
                                  data-testid={`button-resubmit-${contract.id}`}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Resubmit
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => setSelectedContract(contract)} data-testid={`button-view-my-${contract.id}`} title="View details">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          )}

          {/* ── Review Queue Tab (admin/ops/super_admin) ─────────────── */}
          {canReviewSubmissions && (
            <TabsContent value="review-queue" className="mt-4 space-y-4">
              {pendingSubmissions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ThumbsUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No contracts pending review</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-amber-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Candidate / Role</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Notes / Reason</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted By</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingSubmissions.map(contract => (
                        <tr key={contract.id} className="hover:bg-muted/30" data-testid={`row-review-${contract.id}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{contract.clientName}</div>
                            {contract.templateName && <div className="text-xs text-muted-foreground">{contract.templateName}</div>}
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const cands: any[] = (contract as any).candidates || [];
                              if (cands.filter((c: any) => c.name).length > 1) {
                                return (
                                  <div>
                                    {cands.filter((c: any) => c.name).map((c: any, i: number) => (
                                      <div key={i} className="text-sm">{c.name}{c.role ? <span className="text-xs text-muted-foreground"> · {c.role}</span> : null}</div>
                                    ))}
                                  </div>
                                );
                              }
                              return (
                                <>
                                  <div>{contract.candidateName || "—"}</div>
                                  <div className="text-xs text-muted-foreground">{contract.candidateRole || ""}</div>
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 max-w-[220px]">
                            {(contract as any).notes ? (
                              <p className="text-xs text-slate-600 line-clamp-3">{(contract as any).notes}</p>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {(contract as any).submitterName || (contract as any).createdBy || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {(contract.docxPath || contract.uploadedDocPath) && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => handleView(contract)} title="View document" data-testid={`button-view-doc-review-${contract.id}`}>
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDownload(contract)} title="Download document" data-testid={`button-download-review-${contract.id}`}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => setSelectedContract(contract)} title="View details" data-testid={`button-view-review-${contract.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                className="text-green-700 border-green-300 hover:bg-green-50"
                                onClick={() => approveSubmissionMutation.mutate(contract.id)}
                                disabled={approveSubmissionMutation.isPending}
                                data-testid={`button-approve-submission-${contract.id}`}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                className="text-red-700 border-red-300 hover:bg-red-50"
                                onClick={() => { setReviewContract(contract); setRevisionReason(""); setShowRevisionModal(true); }}
                                data-testid={`button-send-back-${contract.id}`}
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Send Back
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          )}

          {/* ── Pending Approval Tab (super_admin only) ──────────────── */}
          {canApproveDispatch && (
            <TabsContent value="pending-approval" className="mt-4 space-y-4">
              {pendingApproval.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No contracts awaiting dispatch approval</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-violet-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Candidate / Role</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Requested By</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingApproval.map(contract => (
                        <tr key={contract.id} className="hover:bg-muted/30" data-testid={`row-pending-${contract.id}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{contract.clientName}</div>
                            {contract.templateName && <div className="text-xs text-muted-foreground">{contract.templateName}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div>{contract.candidateName || "—"}</div>
                            <div className="text-xs text-muted-foreground">{contract.candidateRole || ""}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {(contract as any).createdBy || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline" size="sm"
                                className="text-green-700 border-green-300 hover:bg-green-50"
                                onClick={() => {
                                  setApprovalContract(contract);
                                  setApprovalDeliveryMethod("esign_link");
                                  // Pre-fill from stored request email or client record
                                  const client = clients.find(c => c.id === contract.clientId);
                                  setApprovalRecipientEmail((contract as any).dispatchRecipientEmail || client?.email || "");
                                }}
                                disabled={approveDispatchMutation.isPending}
                                data-testid={`button-approve-dispatch-${contract.id}`}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Approve & Send
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                className="text-red-700 border-red-300 hover:bg-red-50"
                                onClick={() => { setRejectContract(contract); setRejectReason(""); }}
                                data-testid={`button-reject-dispatch-${contract.id}`}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          )}

          {/* ── Invoices Tab ─────────────────────────── */}
          <TabsContent value="invoices" className="mt-4">
            <InvoiceTracker contracts={contracts} clients={clients} canManage={canManage} />
          </TabsContent>

          {/* ── Client Registry Tab ──────────────────── */}
          <TabsContent value="clients" className="mt-4">
            <ClientRegistry canManage={canManage} />
          </TabsContent>

          {/* ── Templates Tab ────────────────────────── */}
          <TabsContent value="templates" className="mt-4">
            <ContractTemplates canManage={canManage} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Generate Contract Dialog */}
      {showGenerator && (
        <ContractGenerator
          clients={clients}
          onClose={() => setShowGenerator(false)}
          onCreated={() => {
            setShowGenerator(false);
            queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
          }}
          onGoToClientsTab={() => setTab("clients")}
        />
      )}

      {/* Freeform MSA Builder Dialog */}
      {showMsaBuilder && (
        <FreeformMsaGenerator
          clients={clients}
          onClose={() => setShowMsaBuilder(false)}
          onCreated={() => {
            setShowMsaBuilder(false);
            queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
          }}
        />
      )}

      {/* Import Contract Dialog */}
      {showImport && (
        <ImportContract
          clients={clients}
          onClose={() => setShowImport(false)}
          onCreated={() => {
            setShowImport(false);
            queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
          }}
        />
      )}

      {/* ── Dispatch Modal ────────────────────────────────────────────────── */}
      {dispatchContract && (
        <Dialog open onOpenChange={() => { setDispatchContract(null); resetDispatchForm(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-[#1F3A6E]" />
                {isSuperAdmin ? "Dispatch Contract" : "Request Dispatch Approval"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-slate-50 border px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">{dispatchContract.clientName}</p>
                {dispatchContract.candidateName && (
                  <p className="text-xs text-muted-foreground mt-0.5">{dispatchContract.candidateName} · {dispatchContract.candidateRole}</p>
                )}
              </div>

              {isSuperAdmin ? (
                <>
                  {/* Delivery method */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Delivery Method</Label>
                    <Select value={deliveryMethod} onValueChange={v => setDeliveryMethod(v as any)}>
                      <SelectTrigger data-testid="select-delivery-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="esign_link">E-Sign Link only — send signing URL by email</SelectItem>
                        <SelectItem value="presigned_pdf">Pre-Signed PDF only — attach signed PDF</SelectItem>
                        <SelectItem value="both">Both — link + signed PDF attachment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Recipient email */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Recipient Email *</Label>
                    <Input
                      type="email"
                      placeholder="client@company.com"
                      value={recipientEmail}
                      onChange={e => setRecipientEmail(e.target.value)}
                      data-testid="input-recipient-email"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Recipient Email *</Label>
                    <Input
                      type="email"
                      placeholder="client@company.com"
                      value={recipientEmail}
                      onChange={e => setRecipientEmail(e.target.value)}
                      data-testid="input-recipient-email-request"
                    />
                    <p className="text-xs text-muted-foreground">Saved so the approver can dispatch directly without needing to re-enter it.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Note for approver (optional)</Label>
                    <Textarea
                      placeholder="Any context for the super-admin approving this dispatch..."
                      value={dispatchNote}
                      onChange={e => setDispatchNote(e.target.value)}
                      rows={2}
                      data-testid="textarea-dispatch-note"
                    />
                    <p className="text-xs text-muted-foreground">
                      This will be sent to super-admins for approval before the contract is dispatched.
                    </p>
                  </div>
                </div>
              )}

              {/* CC Recipients */}
              <div className="space-y-2">
                <Label className="text-sm">CC Recipients</Label>
                {/* Manual email entry */}
                <div className="flex gap-2">
                  <Input
                    placeholder="name@company.com"
                    value={ccInput}
                    onChange={e => setCcInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCc(); } }}
                    className="flex-1"
                    data-testid="input-cc-email"
                  />
                  <Input
                    placeholder="Name (optional)"
                    value={ccNameInput}
                    onChange={e => setCcNameInput(e.target.value)}
                    className="w-28"
                    data-testid="input-cc-name"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addCc} data-testid="button-add-cc">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {/* Employee picker */}
                <div className="relative">
                  <div className="flex gap-2 items-center">
                    <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Search employees to CC…"
                      value={ccEmployeeSearch}
                      onChange={e => { setCcEmployeeSearch(e.target.value); setShowEmployeePicker(true); }}
                      onFocus={() => setShowEmployeePicker(true)}
                      onBlur={() => setTimeout(() => setShowEmployeePicker(false), 150)}
                      className="flex-1 h-8 text-xs"
                      data-testid="input-cc-employee-search"
                    />
                  </div>
                  {showEmployeePicker && filteredEmployees.length > 0 && (
                    <div className="absolute z-50 w-full bg-white border rounded-md shadow-lg max-h-44 overflow-y-auto mt-1">
                      {filteredEmployees.map((emp: any) => (
                        <div
                          key={emp.id}
                          className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-xs flex justify-between items-center"
                          onMouseDown={() => addEmployeeCc(emp)}
                          data-testid={`option-cc-employee-${emp.id}`}
                        >
                          <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                          <span className="text-muted-foreground">{emp.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {ccList.length > 0 && (
                  <div className="space-y-1">
                    {ccList.map((cc, i) => (
                      <div key={i} className={`flex items-center justify-between rounded px-2 py-1 text-xs ${isExternalEmail(cc.email) ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border"}`}>
                        <div>
                          <span className="font-medium">{cc.name}</span>
                          <span className="text-muted-foreground ml-1.5">{cc.email}</span>
                          {isExternalEmail(cc.email) && (
                            <Badge className="ml-1.5 h-4 px-1 text-[10px] bg-amber-100 text-amber-700">External</Badge>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setCcList(prev => prev.filter((_, j) => j !== i))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {externalCcs.length > 0 && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      <strong>External CC detected:</strong> {externalCcs.map(c => c.email).join(", ")}.
                      Super admins will be notified of external recipients.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setDispatchContract(null); resetDispatchForm(); }}>Cancel</Button>
              <Button
                onClick={handleDispatch}
                disabled={dispatchMutation.isPending || (isSuperAdmin && !recipientEmail)}
                data-testid="button-confirm-dispatch"
                className="bg-[#1F3A6E] hover:bg-[#152d56]"
              >
                {dispatchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isSuperAdmin ? <><Send className="h-4 w-4 mr-2" /> Send Now</> : <><AlertCircle className="h-4 w-4 mr-2" /> Submit for Approval</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Reject Dispatch Modal ─────────────────────────────────────────── */}
      {rejectContract && (
        <Dialog open onOpenChange={() => { setRejectContract(null); setRejectReason(""); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Reject Dispatch Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Rejecting will return the contract to <strong>Draft</strong> status and notify the requester.
              </p>
              <div className="space-y-1.5">
                <Label>Reason for rejection *</Label>
                <Textarea
                  placeholder="Explain why this dispatch is being rejected..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  data-testid="textarea-reject-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejectContract(null); setRejectReason(""); }}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => rejectDispatchMutation.mutate({ id: rejectContract.id, reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectDispatchMutation.isPending}
                data-testid="button-confirm-reject"
              >
                {rejectDispatchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Approval delivery-method picker dialog */}
      {approvalContract && (
        <Dialog open onOpenChange={() => setApprovalContract(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Approve & Send Contract</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Choose how to deliver <strong>{approvalContract.clientName}</strong>'s contract.
              </p>
              <div className="space-y-1.5">
                <Label>Recipient Email *</Label>
                <Input
                  type="email"
                  placeholder="client@company.com"
                  value={approvalRecipientEmail}
                  onChange={e => setApprovalRecipientEmail(e.target.value)}
                  data-testid="input-approval-recipient-email"
                />
                <p className="text-xs text-muted-foreground">Pre-filled from the requester's submission. Override if needed.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Method</Label>
                <Select value={approvalDeliveryMethod} onValueChange={v => setApprovalDeliveryMethod(v as any)}>
                  <SelectTrigger data-testid="select-approval-delivery-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="esign_link">E-Sign Link (email with signing URL)</SelectItem>
                    <SelectItem value="presigned_pdf">Pre-signed PDF (email with PDF attachment)</SelectItem>
                    <SelectItem value="both">Both — link + PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApprovalContract(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  approveDispatchMutation.mutate({ id: approvalContract.id, deliveryMethod: approvalDeliveryMethod, recipientEmail: approvalRecipientEmail || undefined });
                  setApprovalContract(null);
                }}
                disabled={approveDispatchMutation.isPending}
                data-testid="button-confirm-approve"
              >
                {approveDispatchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <CheckCircle className="h-4 w-4 mr-2" /> Approve & Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Send Back (revision request) modal */}
      {showRevisionModal && reviewContract && (
        <Dialog open onOpenChange={() => { setShowRevisionModal(false); setReviewContract(null); setRevisionReason(""); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Request Revision</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                The submitter will be notified and the contract returned to <strong>Needs Revision</strong> status.
              </p>
              <div className="space-y-1.5">
                <Label>Reason for revision *</Label>
                <Textarea
                  placeholder="Describe what needs to be corrected or clarified..."
                  value={revisionReason}
                  onChange={e => setRevisionReason(e.target.value)}
                  rows={3}
                  data-testid="textarea-revision-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowRevisionModal(false); setReviewContract(null); setRevisionReason(""); }}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => reviseSubmissionMutation.mutate({ id: reviewContract.id, reason: revisionReason })}
                disabled={!revisionReason.trim() || reviseSubmissionMutation.isPending}
                data-testid="button-confirm-revision"
              >
                {reviseSubmissionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Back
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Contract detail dialog */}
      {selectedContract && (
        <Dialog open onOpenChange={() => setSelectedContract(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Contract Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Client</span><p className="font-medium">{selectedContract.clientName}</p></div>
                <div><span className="text-muted-foreground">Candidate</span><p className="font-medium">{selectedContract.candidateName || "—"}</p></div>
                <div><span className="text-muted-foreground">Role</span><p>{selectedContract.candidateRole || "—"}</p></div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={`text-xs mt-0.5 ${STATUS_COLORS[selectedContract.status] || "bg-slate-100 text-slate-700"}`}>
                    {STATUS_LABELS[selectedContract.status] || selectedContract.status}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground">Start Date</span><p>{selectedContract.contractStartDate ? new Date(selectedContract.contractStartDate).toLocaleDateString() : "—"}</p></div>
                <div><span className="text-muted-foreground">End Date</span><p>{selectedContract.contractEndDate ? new Date(selectedContract.contractEndDate).toLocaleDateString() : "—"}</p></div>
                <div><span className="text-muted-foreground">Payment Terms</span><p>{selectedContract.paymentTermsDays ? `Net ${selectedContract.paymentTermsDays}` : "—"}</p></div>
                <div><span className="text-muted-foreground">Billing Freq.</span><p className="capitalize">{selectedContract.billingFrequency?.replace(/_/g, " ") || "—"}</p></div>
                <div><span className="text-muted-foreground">Source</span><p>{SOURCE_LABELS[selectedContract.source || "generated"]}</p></div>
                <div>
                  <span className="text-muted-foreground">Contract Type</span>
                  <p>
                    {(selectedContract as any).contractType === "permanent_placement" ? "Permanent Placement"
                      : (selectedContract as any).contractType === "contract_to_hire" ? "Contract-to-Hire"
                      : "Contract / Hourly"}
                  </p>
                </div>
              </div>

              {/* ── Candidates ── */}
              {(() => {
                const cands: any[] = (selectedContract as any).candidates || [];
                const named = cands.filter((c: any) => c.name);
                if (named.length === 0 && !selectedContract.candidateName) return null;
                return (
                  <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                      Candidates ({named.length || 1})
                    </p>
                    {named.length > 0 ? named.map((c: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 py-1 border-b last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{c.name}</p>
                          {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                          {c.location && <p className="text-xs text-muted-foreground">{c.location}</p>}
                        </div>
                      </div>
                    )) : (
                      <div>
                        <p className="font-medium text-sm">{selectedContract.candidateName}</p>
                        {selectedContract.candidateRole && <p className="text-xs text-muted-foreground">{selectedContract.candidateRole}</p>}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Submission Notes ── */}
              {(selectedContract as any).notes && (
                <div className="rounded-lg border bg-amber-50 border-amber-200 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1.5">Submission Notes / Reason</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{(selectedContract as any).notes}</p>
                </div>
              )}

              {/* ── Financial Summary ── */}
              {(() => {
                const c = selectedContract as any;
                const isPerm = c.contractType === "permanent_placement";
                const cur: string = c.currency || "USD";
                const fmt = (v: string | number | null) =>
                  v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: 2 }).format(Number(v));
                const hasFinancial = c.billRate != null || c.referralFee != null || c.netMargin != null;
                if (!hasFinancial) return null;
                return (
                  <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Financial Summary ({cur})</p>
                    {!isPerm && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Bill Rate / hr</span>
                          <span className="font-medium tabular-nums">{fmt(c.billRate)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Pay Rate / hr</span>
                          <span className="font-medium tabular-nums">{fmt(c.payRate)}</span>
                        </div>
                        {c.passthroughFee != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Passthrough Fee / hr</span>
                            <span className="font-medium tabular-nums">{fmt(c.passthroughFee)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center rounded bg-slate-100 px-2 py-1">
                          <span className="text-slate-600 text-xs font-medium flex items-center gap-1">
                            Gross Margin / hr
                            <span className="text-[10px] bg-slate-200 rounded px-1 text-slate-500 ml-1">calculated</span>
                          </span>
                          <span className="font-semibold tabular-nums">{fmt(c.grossMargin)}</span>
                        </div>
                      </>
                    )}
                    {isPerm && (
                      <>
                        {c.passthroughFee != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Passthrough Fee</span>
                            <span className="font-medium tabular-nums">{fmt(c.passthroughFee)}</span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex justify-between items-center rounded bg-slate-100 px-2 py-1">
                      <span className="text-slate-600 text-xs font-medium flex items-center gap-1">
                        {isPerm ? "Referral Fee" : "Referral Fee / hr"}
                        {!isPerm && <span className="text-[10px] bg-slate-200 rounded px-1 text-slate-500 ml-1">calculated</span>}
                      </span>
                      <span className="font-semibold tabular-nums" title={isPerm ? "Entered directly" : "Gross Margin − Passthrough Fee"}>{fmt(c.referralFee)}</span>
                    </div>
                    {c.businessMarketingCost != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Business Marketing Cost</span>
                        <span className="font-medium tabular-nums">{fmt(c.businessMarketingCost)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center rounded bg-primary/8 border border-primary/20 px-2 py-1.5">
                      <span className="text-primary text-xs font-semibold flex items-center gap-1">
                        {isPerm ? "Net Margin" : "Net Margin / hr"}
                        <span className="text-[10px] bg-primary/10 rounded px-1 ml-1">calculated</span>
                      </span>
                      <span
                        className={`font-bold tabular-nums ${c.netMargin != null && Number(c.netMargin) < 0 ? "text-red-600" : "text-green-700"}`}
                        title={isPerm ? "Referral Fee − Passthrough − Business Marketing Cost" : "Referral Fee − Business Marketing Cost"}
                        data-testid="text-net-margin-detail"
                      >
                        {fmt(c.netMargin)}
                      </span>
                    </div>
                  </div>
                );
              })()}
              {selectedContract.notes && (
                <div>
                  <span className="text-muted-foreground">Notes</span>
                  <p className="mt-0.5 text-slate-700 whitespace-pre-wrap">{selectedContract.notes}</p>
                </div>
              )}
              {(selectedContract as any).rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-xs text-muted-foreground">Rejection Reason</p>
                  <p className="text-sm text-red-800">{(selectedContract as any).rejectionReason}</p>
                </div>
              )}
              {selectedContract.authCode && (
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-xs text-muted-foreground">Verification Auth Code</p>
                  <p className="font-mono font-bold text-green-800">{selectedContract.authCode}</p>
                </div>
              )}
              {(selectedContract as any).dispatchRecipientEmail && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Sent To</p>
                  <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-1">
                    <Send className="h-3 w-3" />
                    {(selectedContract as any).dispatchRecipientEmail}
                  </span>
                </div>
              )}
              {(() => {
                const cc: CcRecipient[] = (selectedContract as any).ccRecipients || [];
                if (!cc.length) return null;
                return (
                  <div data-testid="contract-cc-recipients">
                    <p className="text-xs text-muted-foreground mb-1.5">CC'd Recipients</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cc.map((r, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs rounded-full px-3 py-1 border border-slate-200 bg-white"
                          data-testid={`cc-chip-${i}`}
                        >
                          {r.source === "external" ? (
                            <Globe className="h-3 w-3 text-amber-500" />
                          ) : (
                            <User className="h-3 w-3 text-slate-400" />
                          )}
                          <span className="font-medium">{r.name || r.email}</span>
                          {r.name && <span className="text-muted-foreground">·&nbsp;{r.email}</span>}
                          {r.source === "external" && (
                            <span className="text-amber-600 text-[10px]">ext</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            <DialogFooter>
              {(selectedContract.docxPath || selectedContract.uploadedDocPath) && (
                <>
                  <Button variant="outline" onClick={() => handleView(selectedContract)} data-testid="button-view-detail">
                    <FileText className="h-4 w-4 mr-2" /> View
                  </Button>
                  <Button variant="outline" onClick={() => handleDownload(selectedContract)} data-testid="button-download-detail">
                    <Download className="h-4 w-4 mr-2" /> Download
                  </Button>
                </>
              )}
              <Button onClick={() => setSelectedContract(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}
