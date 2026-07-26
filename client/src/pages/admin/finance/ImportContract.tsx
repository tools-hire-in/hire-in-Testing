import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, X, DollarSign, Info, TrendingUp, Plus, Trash2 } from "lucide-react";
import type { ContractClient } from "@shared/schema";

interface CandidateEntry {
  name: string;
  role: string;
  location: string;
}

const EMPTY_CANDIDATE: CandidateEntry = { name: "", role: "", location: "" };

interface Props {
  clients: ContractClient[];
  onClose: () => void;
  onCreated: () => void;
}

type ContractType = "contract_hourly" | "permanent_placement" | "contract_to_hire";

const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  contract_hourly: "Contract / Hourly",
  permanent_placement: "Permanent Placement",
  contract_to_hire: "Contract-to-Hire",
};

const SPECIALTIES = ["Healthcare", "IT", "Engineering", "Professional Services", "Other"];
const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "INR"];

interface MarginPreview {
  grossMargin: number | null;
  referralFee: number | null;
  netMargin: number | null;
}

function fmt(v: number | null, currency = "USD"): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(v);
}

function CalcBadge({ label, value, tooltip, currency }: { label: string; value: number | null; tooltip: string; currency?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="rounded-lg bg-slate-50 border px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className={`text-sm font-semibold tabular-nums ${value != null && value < 0 ? "text-red-600" : "text-slate-800"}`}>
              {fmt(value, currency)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function ImportContract({ clients, onClose, onCreated }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [candidates, setCandidates] = useState<CandidateEntry[]>([{ ...EMPTY_CANDIDATE }]);

  const updateCandidate = (idx: number, patch: Partial<CandidateEntry>) =>
    setCandidates(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  const addCandidate = () => setCandidates(prev => [...prev, { ...EMPTY_CANDIDATE }]);
  const removeCandidate = (idx: number) =>
    setCandidates(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  const [agreementDate, setAgreementDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [billingFreq, setBillingFreq] = useState("");
  const [notes, setNotes] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);

  const [contractType, setContractType] = useState<ContractType>("contract_hourly");

  const [billRate, setBillRate] = useState("");
  const [payRate, setPayRate] = useState("");
  const [passthroughFee, setPassthroughFee] = useState("");

  const [referralFeeFlat, setReferralFeeFlat] = useState("");
  const [referralFeeMode, setReferralFeeMode] = useState<"flat" | "pct">("flat");
  const [referralFeePct, setReferralFeePct] = useState("");
  const [candidateAnnualSalary, setCandidateAnnualSalary] = useState("");
  const [businessMarketingCost, setBusinessMarketingCost] = useState("");

  // Contractor details
  const [showContractorDetails, setShowContractorDetails] = useState(false);
  const [contractorName, setContractorName] = useState("");
  const [contractorType, setContractorType] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [contractorPhone, setContractorPhone] = useState("");
  const [contractorCompany, setContractorCompany] = useState("");

  const [preview, setPreview] = useState<MarginPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const isHourly = contractType === "contract_hourly" || contractType === "contract_to_hire";
  const isPerm = contractType === "permanent_placement";

  const handleClientChange = (id: string) => {
    setClientId(id);
    const client = clients.find(c => c.id === id);
    if (client) setClientName(client.name);
  };

  const fetchPreview = useCallback(async () => {
    const body: Record<string, any> = { contractType, currency, businessMarketingCost: businessMarketingCost || null };
    if (isHourly) {
      body.billRate = billRate || null;
      body.payRate = payRate || null;
      body.passthroughFee = passthroughFee || null;
    } else {
      body.passthroughFee = passthroughFee || null;
      if (referralFeeMode === "flat") {
        body.referralFeeFlat = referralFeeFlat || null;
      } else {
        body.referralFeePct = referralFeePct || null;
        body.candidateAnnualSalary = candidateAnnualSalary || null;
      }
    }

    const hasInput = isHourly
      ? (billRate || payRate)
      : (referralFeeMode === "flat" ? referralFeeFlat : (referralFeePct && candidateAnnualSalary));
    if (!hasInput) { setPreview(null); return; }

    setPreviewLoading(true);
    try {
      const res = await fetch("/api/contracts/calculate-margins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      }
    } catch { /* non-fatal */ }
    setPreviewLoading(false);
  }, [contractType, billRate, payRate, passthroughFee, referralFeeFlat, referralFeeMode, referralFeePct, candidateAnnualSalary, businessMarketingCost, isHourly]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchPreview, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchPreview]);

  const handleSubmit = async () => {
    if (!file) return toast({ title: "Please select a file", variant: "destructive" });
    if (!clientName.trim()) return toast({ title: "Client name is required", variant: "destructive" });

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("clientName", clientName);
      formData.append("contractType", contractType);
      formData.append("currency", currency);
      if (clientId) formData.append("clientId", clientId);
      const filledCandidates = candidates.filter(c => c.name.trim() || c.role.trim());
      if (filledCandidates.length > 0) {
        formData.append("candidateName", filledCandidates[0].name || "");
        formData.append("candidateRole", filledCandidates[0].role || "");
        formData.append("candidates", JSON.stringify(filledCandidates));
      }
      if (agreementDate) formData.append("agreementDate", agreementDate);
      if (startDate) formData.append("contractStartDate", startDate);
      if (endDate) formData.append("contractEndDate", endDate);
      if (paymentTerms) formData.append("paymentTermsDays", paymentTerms);
      if (billingFreq) formData.append("billingFrequency", billingFreq);
      if (notes) formData.append("notes", notes);
      if (specialty) formData.append("specialty", specialty);
      if (businessMarketingCost) formData.append("businessMarketingCost", businessMarketingCost);
      if (isHourly) {
        if (billRate) formData.append("billRate", billRate);
        if (payRate) formData.append("payRate", payRate);
        if (passthroughFee) formData.append("passthroughFee", passthroughFee);
      } else {
        if (passthroughFee) formData.append("passthroughFee", passthroughFee);
        if (referralFeeMode === "flat") {
          if (referralFeeFlat) formData.append("referralFeeFlat", referralFeeFlat);
        } else {
          if (referralFeePct) formData.append("referralFeePct", referralFeePct);
          if (candidateAnnualSalary) formData.append("candidateAnnualSalary", candidateAnnualSalary);
        }
      }

      // Contractor details (if any filled)
      const cdFields: Record<string, string> = {};
      if (contractorName) cdFields.name = contractorName;
      if (contractorType) cdFields.contractorType = contractorType;
      if (contractorEmail) cdFields.email = contractorEmail;
      if (contractorPhone) cdFields.phone = contractorPhone;
      if (contractorCompany) cdFields.companyAgency = contractorCompany;
      if (Object.keys(cdFields).length > 0) {
        formData.append("contractorDetails", JSON.stringify(cdFields));
      }

      const res = await fetch("/api/contracts/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      toast({ title: "Contract imported successfully" });
      onCreated();
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import Existing Contract
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* File drop zone */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
            data-testid="dropzone-contract"
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button
                  variant="ghost" size="sm"
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                  data-testid="button-remove-file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="font-medium text-sm">Click to upload a contract</p>
                <p className="text-xs text-muted-foreground mt-1">PDF or DOCX, up to 20 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.doc"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)}
            data-testid="input-file-upload"
          />

          {/* ── Step 1: Contract type ─── */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Contract Type *</Label>
            <Select value={contractType} onValueChange={v => { setContractType(v as ContractType); setPreview(null); }}>
              <SelectTrigger data-testid="select-contract-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contract_hourly">Contract / Hourly — ongoing bill & pay rate</SelectItem>
                <SelectItem value="permanent_placement">Permanent Placement — one-time referral fee</SelectItem>
                <SelectItem value="contract_to_hire">Contract-to-Hire — hourly now, converts to perm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Step 2: Client ─── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client (from registry)</Label>
              <Select value={clientId} onValueChange={handleClientChange}>
                <SelectTrigger data-testid="select-client-import">
                  <SelectValue placeholder="Select existing client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Client Name *</Label>
              <Input
                placeholder="Client company name"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                data-testid="input-client-name-import"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="flex items-center gap-1.5">
                Specialty / Department
                <span className="text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded">Rate Dashboard</span>
              </Label>
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger data-testid="select-specialty-import">
                  <SelectValue placeholder="Select specialty..." />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Candidates ─── */}
          <div className="rounded-lg border bg-slate-50/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
              <p className="text-sm font-semibold text-slate-800">
                Candidates
                <span className="ml-2 text-xs font-normal text-muted-foreground">({candidates.length} added — all entered manually by your team)</span>
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={addCandidate}
                data-testid="button-add-candidate-import"
              >
                <Plus className="h-3.5 w-3.5" /> Add Candidate
              </Button>
            </div>
            <div className="divide-y">
              {candidates.map((cand, idx) => (
                <div key={idx} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-600">Candidate {idx + 1}</p>
                    {candidates.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeCandidate(idx)}
                        data-testid={`button-remove-candidate-import-${idx}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Full name"
                        value={cand.name}
                        onChange={e => updateCandidate(idx, { name: e.target.value })}
                        data-testid={`input-candidate-name-import-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Role / Title</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="e.g. Registered Nurse"
                        value={cand.role}
                        onChange={e => updateCandidate(idx, { role: e.target.value })}
                        data-testid={`input-candidate-role-import-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Location (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="City, State"
                        value={cand.location}
                        onChange={e => updateCandidate(idx, { location: e.target.value })}
                        data-testid={`input-candidate-location-import-${idx}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Step 3: Financial fields (type-conditional) ─── */}
          <div className="rounded-lg border bg-slate-50/50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-primary" />
                Financial Details — {CONTRACT_TYPE_LABELS[contractType]}
              </p>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-24 h-7 text-xs" data-testid="select-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isHourly ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-xs">
                    <DollarSign className="h-3.5 w-3.5 text-green-600" />
                    Bill Rate ({currency}/hr) *
                  </Label>
                  <Input
                    type="number" step="0.01" placeholder="150.00"
                    value={billRate}
                    onChange={e => setBillRate(e.target.value)}
                    data-testid="input-bill-rate-import"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-xs">
                    <DollarSign className="h-3.5 w-3.5 text-blue-600" />
                    Pay Rate ({currency}/hr) *
                  </Label>
                  <Input
                    type="number" step="0.01" placeholder="120.00"
                    value={payRate}
                    onChange={e => setPayRate(e.target.value)}
                    data-testid="input-pay-rate-import"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Passthrough Fee ({currency}/hr)</Label>
                  <Input
                    type="number" step="0.01" placeholder="e.g. 5.00"
                    value={passthroughFee}
                    onChange={e => setPassthroughFee(e.target.value)}
                    data-testid="input-passthrough-fee-import"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Referral fee entry mode */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Referral Fee as:</span>
                  <div className="inline-flex rounded-md border overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setReferralFeeMode("flat")}
                      className={`px-3 py-1.5 transition-colors ${referralFeeMode === "flat" ? "bg-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                      data-testid="btn-referral-mode-flat"
                    >
                      Flat Amount
                    </button>
                    <button
                      type="button"
                      onClick={() => setReferralFeeMode("pct")}
                      className={`px-3 py-1.5 border-l transition-colors ${referralFeeMode === "pct" ? "bg-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                      data-testid="btn-referral-mode-pct"
                    >
                      % of Salary
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {referralFeeMode === "flat" ? (
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1 text-xs">
                        <DollarSign className="h-3.5 w-3.5 text-green-600" />
                        Referral Fee ({currency}) *
                      </Label>
                      <Input
                        type="number" step="0.01" placeholder="e.g. 15000.00"
                        value={referralFeeFlat}
                        onChange={e => setReferralFeeFlat(e.target.value)}
                        data-testid="input-referral-fee-flat-import"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Referral Fee % *
                        </Label>
                        <Input
                          type="number" step="0.1" min="0" max="100" placeholder="e.g. 20"
                          value={referralFeePct}
                          onChange={e => setReferralFeePct(e.target.value)}
                          data-testid="input-referral-fee-pct-import"
                        />
                        <p className="text-[10px] text-muted-foreground">% of candidate annual salary</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Candidate Annual Salary ({currency}) *</Label>
                        <Input
                          type="number" step="1" placeholder="e.g. 75000"
                          value={candidateAnnualSalary}
                          onChange={e => setCandidateAnnualSalary(e.target.value)}
                          data-testid="input-candidate-salary-import"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Passthrough Fee ({currency}, flat)</Label>
                    <Input
                      type="number" step="0.01" placeholder="e.g. 2000.00"
                      value={passthroughFee}
                      onChange={e => setPassthroughFee(e.target.value)}
                      data-testid="input-passthrough-fee-perm-import"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Business Marketing Cost ({currency}, flat)</Label>
              <Input
                type="number" step="0.01" placeholder="e.g. 500.00"
                value={businessMarketingCost}
                onChange={e => setBusinessMarketingCost(e.target.value)}
                data-testid="input-bmc-import"
                className="max-w-xs"
              />
            </div>

            {/* Live calculated preview */}
            {(preview || previewLoading) && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                  {previewLoading ? "Calculating…" : "Calculated (server-side)"}
                </p>
                {!previewLoading && preview && (
                  <div className="grid grid-cols-1 gap-1.5">
                    {isHourly && (
                      <CalcBadge
                        label="Gross Margin / hr"
                        value={preview.grossMargin}
                        tooltip="Bill Rate − Pay Rate"
                        currency={currency}
                      />
                    )}
                    <CalcBadge
                      label={isHourly ? "Referral Fee / hr" : "Referral Fee"}
                      value={preview.referralFee}
                      tooltip={isHourly ? "Gross Margin − Passthrough Fee" : "Entered directly"}
                      currency={currency}
                    />
                    <CalcBadge
                      label={isHourly ? "Net Margin / hr" : "Net Margin"}
                      value={preview.netMargin}
                      tooltip={isHourly ? "Referral Fee − Business Marketing Cost" : "Referral Fee − Passthrough − Business Marketing Cost"}
                      currency={currency}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Contractor Details (optional collapsible) ─── */}
          <div className="rounded-lg border bg-slate-50/50 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100/50 transition-colors"
              onClick={() => setShowContractorDetails(v => !v)}
              data-testid="button-toggle-contractor-details"
            >
              <span className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Contractor / Candidate Details <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </span>
              <span className="text-muted-foreground text-xs">{showContractorDetails ? "▲ Hide" : "▼ Show"}</span>
            </button>
            {showContractorDetails && (
              <div className="px-4 pb-4 pt-2 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Contractor Name</Label>
                  <Input placeholder="Full name" value={contractorName} onChange={e => setContractorName(e.target.value)} data-testid="input-contractor-name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contractor Type</Label>
                  <Select value={contractorType} onValueChange={setContractorType}>
                    <SelectTrigger data-testid="select-contractor-type">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="external_contractor">External Contractor</SelectItem>
                      <SelectItem value="internal_employee">Internal Employee</SelectItem>
                      <SelectItem value="sub_vendor">Sub-Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" placeholder="contractor@email.com" value={contractorEmail} onChange={e => setContractorEmail(e.target.value)} data-testid="input-contractor-email" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input placeholder="+1 555 000 0000" value={contractorPhone} onChange={e => setContractorPhone(e.target.value)} data-testid="input-contractor-phone" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Company / Agency</Label>
                  <Input placeholder="Agency or employer name" value={contractorCompany} onChange={e => setContractorCompany(e.target.value)} data-testid="input-contractor-company" />
                </div>
              </div>
            )}
          </div>

          {/* ── Submission Notes / Reason ─── */}
          <div className="space-y-1.5">
            <Label className="font-semibold flex items-center gap-1.5">
              Submission Notes / Reason for Upload
              <span className="text-[10px] font-normal text-muted-foreground bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Visible to admin reviewers</span>
            </Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Explain the context — e.g. 'New contract with Sunrise Health for 3 travel nurses starting June. Rates agreed verbally, uploading signed copy for records.'"
              rows={3}
              data-testid="textarea-notes-import"
            />
          </div>

          {/* ── Step 4: Contract dates & billing ─── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Agreement / Signing Date</Label>
              <Input type="date" value={agreementDate} onChange={e => setAgreementDate(e.target.value)} data-testid="input-agreement-date-import" />
            </div>
            <div className="space-y-1.5">
              <Label>Contract Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} data-testid="input-start-date-import" />
            </div>
            <div className="space-y-1.5">
              <Label>Contract End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} data-testid="input-end-date-import" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Terms (days)</Label>
              <Input
                type="number" placeholder="e.g. 30"
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                data-testid="input-payment-terms-import"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Billing Frequency</Label>
              <Select value={billingFreq} onValueChange={setBillingFreq}>
                <SelectTrigger data-testid="select-billing-freq-import">
                  <SelectValue placeholder="Select frequency..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="one_time">One-Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !file || !clientName} data-testid="button-submit-import">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import Contract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
