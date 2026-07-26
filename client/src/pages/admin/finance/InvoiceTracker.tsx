import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, ReceiptText, CheckCircle, Clock, AlertCircle,
  XCircle, Send, Loader2, Pencil, DollarSign, ExternalLink
} from "lucide-react";
import type { Contract, ContractClient, ContractInvoice } from "@shared/schema";

interface Props {
  contracts: Contract[];
  clients: ContractClient[];
  canManage: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-zinc-100 text-zinc-700",
};

const STATUS_ICONS: Record<string, any> = {
  scheduled: Clock,
  sent: Send,
  paid: CheckCircle,
  overdue: AlertCircle,
  cancelled: XCircle,
};

const EMPTY_FORM = {
  contractId: "", invoiceNumber: "", periodStart: "", periodEnd: "",
  dueDate: "", amount: "", currency: "USD", status: "scheduled", notes: ""
};

export default function InvoiceTracker({ contracts, clients, canManage }: Props) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<ContractInvoice | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);

  const { data: invoices = [], isLoading } = useQuery<ContractInvoice[]>({
    queryKey: ["/api/contracts/invoices/all"],
  });

  // Compute billing-overdue contracts: next_billing_date in the past with no sent/paid invoice
  // in the CURRENT billing period (period-aware check prevents old invoices suppressing alerts).
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  function getPeriodStart(nextBillingDateStr: string, billingFrequency: string | null): Date | null {
    if (!billingFrequency) return null;
    const d = new Date(nextBillingDateStr);
    switch (billingFrequency) {
      case "weekly":    d.setDate(d.getDate() - 7);   break;
      case "bi_weekly": d.setDate(d.getDate() - 14);  break;
      case "monthly":   d.setMonth(d.getMonth() - 1); break;
      default: return null;
    }
    return d;
  }

  const billingOverdueContracts = contracts.filter(c => {
    const nbd = (c as any).nextBillingDate;
    if (!nbd || c.status !== "countersigned") return false;
    const nbdDate = new Date(nbd);
    nbdDate.setHours(0, 0, 0, 0);
    if (nbdDate >= todayMidnight) return false;

    const contractInvs = invoices.filter(inv => inv.contractId === c.id);
    const periodStart = getPeriodStart(nbd, (c as any).billingFrequency);
    if (periodStart) {
      // Period-aware: only a sent/paid invoice that covers the current period suppresses the alert.
      // Prefer the invoice's own period_start column (most accurate); fall back to createdAt
      // only for invoices that predate the period columns.
      return !contractInvs.some(inv => {
        if (!["sent", "paid"].includes(inv.status)) return false;
        const nbdDate = new Date(nbd);
        if (inv.periodStart) {
          // Invoice has period columns — check period_start falls within [periodStart, nextBillingDate]
          const invPeriod = new Date(inv.periodStart);
          return invPeriod >= periodStart && invPeriod <= nbdDate;
        }
        // Fallback: use createdAt proximity
        return !!(inv.createdAt && new Date(inv.createdAt as any) >= periodStart);
      });
    }
    // Fallback for one_time / milestone: any sent/paid invoice counts
    return !contractInvs.some(inv => ["sent", "paid"].includes(inv.status));
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/contracts/${form.contractId}/invoices`, {
      invoiceNumber: form.invoiceNumber || null,
      periodStart: form.periodStart || null,
      periodEnd: form.periodEnd || null,
      dueDate: form.dueDate || null,
      amount: form.amount || null,
      currency: form.currency,
      status: form.status,
      notes: form.notes || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/invoices/all"] });
      setShowNew(false); setForm(EMPTY_FORM);
      toast({ title: "Invoice added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/contracts/invoices/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/invoices/all"] });
      setEditing(null);
      toast({ title: "Invoice updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = invoices.filter(inv => {
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchContract = contractFilter === "all" || inv.contractId === contractFilter;
    return matchStatus && matchContract;
  });

  const getContractLabel = (id: string) => {
    const c = contracts.find(c => c.id === id);
    return c ? `${c.clientName}${c.candidateName ? ` — ${c.candidateName}` : ""}` : id;
  };

  const isOverdue = (inv: ContractInvoice) =>
    inv.status === "scheduled" && inv.dueDate && new Date(inv.dueDate) < new Date();

  const stats = {
    total: invoices.length,
    pending: invoices.filter(i => ["scheduled", "sent"].includes(i.status)).length,
    paid: invoices.filter(i => i.status === "paid").length,
    overdue: invoices.filter(i => isOverdue(i)).length,
  };

  const InvoiceForm = ({ data, onChange }: { data: typeof EMPTY_FORM; onChange: (d: typeof EMPTY_FORM) => void }) => (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5 col-span-2">
        <Label>Contract *</Label>
        <Select value={data.contractId} onValueChange={v => onChange({ ...data, contractId: v })}>
          <SelectTrigger data-testid="select-invoice-contract">
            <SelectValue placeholder="Select contract..." />
          </SelectTrigger>
          <SelectContent>
            {contracts.filter(c => c.status !== "cancelled").map(c => (
              <SelectItem key={c.id} value={c.id}>{getContractLabel(c.id)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Invoice Number</Label>
        <Input value={data.invoiceNumber} onChange={e => onChange({ ...data, invoiceNumber: e.target.value })}
          placeholder="e.g. INV-2025-001" data-testid="input-invoice-number" />
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={data.status} onValueChange={v => onChange({ ...data, status: v })}>
          <SelectTrigger data-testid="select-invoice-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Period Start</Label>
        <Input type="date" value={data.periodStart} onChange={e => onChange({ ...data, periodStart: e.target.value })} data-testid="input-period-start" />
      </div>
      <div className="space-y-1.5">
        <Label>Period End</Label>
        <Input type="date" value={data.periodEnd} onChange={e => onChange({ ...data, periodEnd: e.target.value })} data-testid="input-period-end" />
      </div>
      <div className="space-y-1.5">
        <Label>Due Date</Label>
        <Input type="date" value={data.dueDate} onChange={e => onChange({ ...data, dueDate: e.target.value })} data-testid="input-due-date" />
      </div>
      <div className="space-y-1.5">
        <Label>Amount</Label>
        <div className="flex gap-2">
          <Select value={data.currency} onValueChange={v => onChange({ ...data, currency: v })}>
            <SelectTrigger className="w-24" data-testid="select-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="INR">INR</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" step="0.01" value={data.amount} onChange={e => onChange({ ...data, amount: e.target.value })}
            placeholder="0.00" data-testid="input-invoice-amount" />
        </div>
      </div>
      <div className="space-y-1.5 col-span-2">
        <Label>Notes</Label>
        <Textarea value={data.notes} onChange={e => onChange({ ...data, notes: e.target.value })} rows={2} data-testid="textarea-invoice-notes" />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Billing Overdue Banner */}
      {billingOverdueContracts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3" data-testid="banner-billing-overdue">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800">
                {billingOverdueContracts.length} contract{billingOverdueContracts.length !== 1 ? "s" : ""} with billing overdue — no invoice raised yet
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {billingOverdueContracts.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setContractFilter(c.id);
                      setForm(prev => ({ ...prev, contractId: c.id }));
                      setShowNew(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs rounded-full bg-red-100 border border-red-200 text-red-800 px-3 py-1 hover:bg-red-200 transition-colors"
                    data-testid={`banner-overdue-contract-${c.id}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    {c.clientName}{(c as any).candidateName ? ` — ${(c as any).candidateName}` : ""}
                    <span className="text-red-500 ml-0.5">
                      (due {new Date((c as any).nextBillingDate).toLocaleDateString()})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-slate-700" },
          { label: "Pending / Sent", value: stats.pending, color: "text-blue-600" },
          { label: "Paid", value: stats.paid, color: "text-green-600" },
          { label: "Overdue", value: stats.overdue, color: "text-red-600" },
        ].map(s => (
          <div key={s.label} className="border rounded-lg p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + Add */}
      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-invoice-filter-status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-56" data-testid="select-invoice-filter-contract">
            <SelectValue placeholder="All Contracts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contracts</SelectItem>
            {contracts.map(c => (
              <SelectItem key={c.id} value={c.id}>{getContractLabel(c.id)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          {canManage && (
            <Button onClick={() => { setForm(EMPTY_FORM); setShowNew(true); }} data-testid="button-add-invoice">
              <Plus className="h-4 w-4 mr-2" /> Add Invoice
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading invoices...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <ReceiptText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No invoices yet</p>
          <p className="text-sm mt-1">Add invoice records here so accounts can track billing against each contract.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contract</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                {canManage && <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(inv => {
                const overdue = isOverdue(inv);
                const Icon = STATUS_ICONS[inv.status] || Clock;
                return (
                  <tr key={inv.id} className={`hover:bg-muted/30 ${overdue ? "bg-red-50/50" : ""}`} data-testid={`row-invoice-${inv.id}`}>
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{getContractLabel(inv.contractId)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {inv.periodStart && inv.periodEnd
                        ? `${new Date(inv.periodStart).toLocaleDateString()} – ${new Date(inv.periodEnd).toLocaleDateString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {inv.dueDate ? (
                        <span className={overdue ? "text-red-600 font-medium" : ""}>
                          {new Date(inv.dueDate).toLocaleDateString()}
                          {overdue && " ⚠"}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {inv.amount ? `${inv.currency} ${Number(inv.amount).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs flex items-center gap-1 w-fit ${STATUS_COLORS[inv.status]}`}>
                        <Icon className="h-3 w-3" />{inv.status}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => {
                              setEditing(inv);
                              setForm({
                                contractId: inv.contractId,
                                invoiceNumber: inv.invoiceNumber || "",
                                periodStart: inv.periodStart || "",
                                periodEnd: inv.periodEnd || "",
                                dueDate: inv.dueDate || "",
                                amount: inv.amount?.toString() || "",
                                currency: inv.currency,
                                status: inv.status,
                                notes: inv.notes || "",
                              });
                            }}
                            data-testid={`button-edit-invoice-${inv.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {inv.status !== "paid" && (
                            <Button
                              variant="ghost" size="sm" className="text-green-700"
                              onClick={() => updateMutation.mutate({ id: inv.id, data: { status: "paid", paidAt: new Date() } })}
                              data-testid={`button-mark-paid-${inv.id}`}
                              title="Mark as paid"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Invoice Dialog */}
      {(showNew || editing) && (
        <Dialog open onOpenChange={() => { setShowNew(false); setEditing(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Invoice" : "Add Invoice"}</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <InvoiceForm data={form} onChange={setForm} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowNew(false); setEditing(null); }}>Cancel</Button>
              <Button
                onClick={() => editing
                  ? updateMutation.mutate({ id: editing.id, data: { ...form, amount: form.amount || null } })
                  : createMutation.mutate()
                }
                disabled={!form.contractId || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-invoice"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? "Save Changes" : "Add Invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
