import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  FileText, Plus, Search, Download, Send, CheckCircle, Upload,
  Building2, FileUp, Eye, Clock, XCircle, PenLine, FilePlus,
  ReceiptText, Calendar, DollarSign, RefreshCw
} from "lucide-react";
import type { Contract, ContractClient } from "@shared/schema";
import ContractGenerator from "./ContractGenerator";
import ImportContract from "./ImportContract";
import ClientRegistry from "./ClientRegistry";
import ContractTemplates from "./ContractTemplates";
import InvoiceTracker from "./InvoiceTracker";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  client_signed: "bg-amber-100 text-amber-700",
  countersigned: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  client_signed: "Client Signed",
  countersigned: "Countersigned",
  cancelled: "Cancelled",
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
  return <Clock className="h-4 w-4 text-slate-500" />;
}

export default function ContractsHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("contracts");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showGenerator, setShowGenerator] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);

  const canManage = ["super_admin", "admin", "hr", "operations"].includes(user?.role || "");
  const canCountersign = ["super_admin", "admin", "hr"].includes(user?.role || "");

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: clients = [] } = useQuery<ContractClient[]>({
    queryKey: ["/api/contracts/clients"],
  });

  const sendMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      apiRequest("POST", `/api/contracts/${id}/send`, { clientEmail: email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setSendingId(null);
      setSendEmail("");
      toast({ title: "Contract sent for signing" });
    },
    onError: (e: any) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const countersignMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/contracts/${id}/countersign`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Contract countersigned successfully" });
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

  const stats = {
    total: contracts.length,
    active: contracts.filter(c => c.status === "countersigned").length,
    pending: contracts.filter(c => ["sent", "client_signed"].includes(c.status)).length,
    imported: contracts.filter(c => c.source === "imported").length,
  };

  const handleDownload = async (contract: Contract) => {
    window.open(`/api/contracts/${contract.id}/download`, "_blank");
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Finance & Contracts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage client contracts, compliance documents, and invoice tracking</p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowImport(true)} data-testid="button-import-contract">
                <Upload className="h-4 w-4 mr-2" /> Import Contract
              </Button>
              <Button onClick={() => setShowGenerator(true)} data-testid="button-new-contract">
                <Plus className="h-4 w-4 mr-2" /> Generate Contract
              </Button>
            </div>
          )}
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Contracts", value: stats.total, icon: FileText, color: "text-slate-700" },
            { label: "Active (Signed)", value: stats.active, icon: CheckCircle, color: "text-green-600" },
            { label: "Pending Signature", value: stats.pending, icon: Clock, color: "text-amber-600" },
            { label: "Imported Contracts", value: stats.imported, icon: Upload, color: "text-blue-600" },
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
          <TabsList className="h-10">
            <TabsTrigger value="contracts" data-testid="tab-contracts">
              <FileText className="h-4 w-4 mr-1.5" /> Contracts
            </TabsTrigger>
            <TabsTrigger value="invoices" data-testid="tab-invoices">
              <ReceiptText className="h-4 w-4 mr-1.5" /> Invoices
            </TabsTrigger>
            <TabsTrigger value="clients" data-testid="tab-clients">
              <Building2 className="h-4 w-4 mr-1.5" /> Client Registry
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">
              <FilePlus className="h-4 w-4 mr-1.5" /> Templates
            </TabsTrigger>
          </TabsList>

          {/* ── Contracts Tab ─────────────────────────────── */}
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
                <SelectTrigger className="w-44" data-testid="select-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
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
                            <Badge className={`text-xs ${STATUS_COLORS[contract.status]}`}>
                              {STATUS_LABELS[contract.status]}
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
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => handleDownload(contract)}
                                data-testid={`button-download-${contract.id}`}
                                title="Download document"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {canManage && contract.source !== "imported" && contract.status === "draft" && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setSendingId(contract.id)}
                                data-testid={`button-send-${contract.id}`}
                                title="Send for signing"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            {canManage && contract.source !== "imported" && contract.status === "sent" && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setSendingId(contract.id)}
                                data-testid={`button-resend-${contract.id}`}
                                title="Resend signing link"
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

      {/* Send for signing dialog */}
      {sendingId && (
        <Dialog open onOpenChange={() => setSendingId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Send Contract for Signing</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Enter the client's email address to send the signing link.</p>
              <Input
                placeholder="client@company.com"
                value={sendEmail}
                onChange={e => setSendEmail(e.target.value)}
                data-testid="input-send-email"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendingId(null)}>Cancel</Button>
              <Button
                onClick={() => sendMutation.mutate({ id: sendingId, email: sendEmail })}
                disabled={!sendEmail || sendMutation.isPending}
                data-testid="button-confirm-send"
              >
                <Send className="h-4 w-4 mr-2" /> Send Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Contract detail dialog */}
      {selectedContract && (
        <Dialog open onOpenChange={() => setSelectedContract(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Contract Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Client</span><p className="font-medium">{selectedContract.clientName}</p></div>
                <div><span className="text-muted-foreground">Candidate</span><p className="font-medium">{selectedContract.candidateName || "—"}</p></div>
                <div><span className="text-muted-foreground">Role</span><p>{selectedContract.candidateRole || "—"}</p></div>
                <div><span className="text-muted-foreground">Status</span>
                  <Badge className={`text-xs mt-0.5 ${STATUS_COLORS[selectedContract.status]}`}>
                    {STATUS_LABELS[selectedContract.status]}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground">Start Date</span><p>{selectedContract.contractStartDate ? new Date(selectedContract.contractStartDate).toLocaleDateString() : "—"}</p></div>
                <div><span className="text-muted-foreground">End Date</span><p>{selectedContract.contractEndDate ? new Date(selectedContract.contractEndDate).toLocaleDateString() : "—"}</p></div>
                <div><span className="text-muted-foreground">Margin / hr</span><p>{selectedContract.marginPerHour ? `$${selectedContract.marginPerHour}` : "—"}</p></div>
                <div><span className="text-muted-foreground">Payment Terms</span><p>{selectedContract.paymentTermsDays ? `Net ${selectedContract.paymentTermsDays}` : "—"}</p></div>
                <div><span className="text-muted-foreground">Billing Freq.</span><p className="capitalize">{selectedContract.billingFrequency?.replace(/_/g, " ") || "—"}</p></div>
                <div><span className="text-muted-foreground">Source</span><p>{SOURCE_LABELS[selectedContract.source || "generated"]}</p></div>
              </div>
              {selectedContract.notes && (
                <div>
                  <span className="text-muted-foreground">Notes</span>
                  <p className="mt-0.5 text-slate-700 whitespace-pre-wrap">{selectedContract.notes}</p>
                </div>
              )}
              {selectedContract.authCode && (
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-xs text-muted-foreground">Verification Auth Code</p>
                  <p className="font-mono font-bold text-green-800">{selectedContract.authCode}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              {(selectedContract.docxPath || selectedContract.uploadedDocPath) && (
                <Button variant="outline" onClick={() => handleDownload(selectedContract)}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              )}
              <Button onClick={() => setSelectedContract(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}
