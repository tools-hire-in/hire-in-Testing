import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronRight, ChevronLeft, Wand2, Search, User, X, Info, AlertCircle } from "lucide-react";
import type { ContractClient, ContractTemplate } from "@shared/schema";

interface CandidateSuggestion {
  name: string;
  email?: string;
  phone?: string;
  skills?: string;
}

interface Props {
  clients: ContractClient[];
  onClose: () => void;
  onCreated: () => void;
}

interface TemplateField {
  key: string;
  value: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function ContractGenerator({ clients, onClose, onCreated }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Candidate search state
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidateRole, setCandidateRole] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Client state
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");

  // Step 2 — Commercial terms
  const [templateId, setTemplateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [margin, setMargin] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [billingFreq, setBillingFreq] = useState("");
  const [notes, setNotes] = useState("");

  // Step 3 — Template variable fill
  const [fields, setFields] = useState<TemplateField[]>([]);

  const debouncedSearch = useDebounce(candidateSearch, 350);

  const { data: templates = [] } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contracts/templates"],
  });

  // Ceipal candidate search
  const { data: searchResult, isFetching: isSearching } = useQuery<{
    candidates: CandidateSuggestion[];
    ceipal_unavailable?: boolean;
    message?: string;
  }>({
    queryKey: ["/api/contracts/candidates/search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return { candidates: [] };
      const res = await fetch(`/api/contracts/candidates/search?q=${encodeURIComponent(debouncedSearch)}`, { credentials: "include" });
      return res.json();
    },
    enabled: debouncedSearch.length >= 2,
  });

  const ceipalUnavailable = searchResult?.ceipal_unavailable === true;
  const suggestions = searchResult?.candidates || [];

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedTemplate = templates.find(t => t.id === templateId);

  const handleClientChange = (id: string) => {
    setClientId(id);
    const client = clients.find(c => c.id === id);
    if (client) setClientName(client.name);
  };

  const handleSelectCandidate = (c: CandidateSuggestion) => {
    setCandidateName(c.name);
    setCandidateSearch(c.name);
    setShowSuggestions(false);
  };

  const buildPrefillMap = (client?: ContractClient | null) => ({
    client_name: clientName,
    candidate_name: candidateName,
    candidate_role: candidateRole,
    start_date: startDate,
    end_date: endDate,
    margin_per_hour: margin,
    payment_terms_days: paymentTerms,
    billing_frequency: billingFreq.replace(/_/g, " "),
    signatory_name: client?.signatoryName || "",
    signatory_title: client?.signatoryTitle || "",
    client_address: client?.address || "",
    agency_name: "Rayomind Solutions LLP",
    contract_date: new Date().toLocaleDateString("en-GB"),
    notice_period_days: "14",
  } as Record<string, string>);

  const computeFields = () => {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl?.placeholderList) return;
    const client = clients.find(c => c.id === clientId) || null;
    const prefill = buildPrefillMap(client);
    setFields((tmpl.placeholderList as string[]).map(p => ({ key: p, value: prefill[p] || "" })));
  };

  const hasPlaceholders = !!templateId && (selectedTemplate?.placeholderList as string[] | null)?.length;

  const createMutation = useMutation({
    mutationFn: () => {
      const variableValues: Record<string, string> = {};
      fields.forEach(f => { variableValues[f.key] = f.value; });
      return apiRequest("POST", "/api/contracts", {
        templateId: templateId || null,
        clientId: clientId || null,
        clientName,
        candidateName,
        candidateRole,
        variableValues,
        contractStartDate: startDate || null,
        contractEndDate: endDate || null,
        marginPerHour: margin || null,
        paymentTermsDays: paymentTerms ? Number(paymentTerms) : null,
        billingFrequency: billingFreq || null,
        notes: notes || null,
        templateName: selectedTemplate?.name || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Contract generated successfully" });
      onCreated();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isLastStep = hasPlaceholders ? step === 4 : step === 3;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Generate Contract
            <span className="text-sm font-normal text-muted-foreground ml-2">
              Step {step} of {hasPlaceholders ? 4 : 3}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Candidate + Client ─────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Candidate Details</h3>
                <Badge variant="outline" className="text-xs">Optional</Badge>
              </div>

              {/* Ceipal search box */}
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 pr-9"
                    placeholder={ceipalUnavailable ? "Type candidate name (manual entry)..." : "Search Ceipal ATS for candidate..."}
                    value={candidateSearch}
                    onChange={e => {
                      setCandidateSearch(e.target.value);
                      setCandidateName(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    data-testid="input-candidate-search"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {candidateSearch && !isSearching && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => { setCandidateSearch(""); setCandidateName(""); setShowSuggestions(false); }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Suggestions dropdown */}
                {showSuggestions && debouncedSearch.length >= 2 && !isSearching && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {ceipalUnavailable ? (
                      <div className="p-3 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">Ceipal search unavailable</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {searchResult?.message || "Using manual entry — type the candidate's name above."}
                          </p>
                        </div>
                      </div>
                    ) : suggestions.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        No candidates found for "{debouncedSearch}"
                      </div>
                    ) : (
                      suggestions.map((c, i) => (
                        <button
                          key={i}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b last:border-b-0 transition-colors"
                          onClick={() => handleSelectCandidate(c)}
                          data-testid={`candidate-suggestion-${i}`}
                        >
                          <p className="font-medium text-sm text-slate-900">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[c.email, c.skills].filter(Boolean).join(" · ")}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Ceipal unavailability info strip */}
              {ceipalUnavailable && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">
                    Ceipal ATS candidate lookup is not available. Enter the name and role manually — they'll be merged into the contract.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Candidate Role / Title</Label>
                <Input
                  placeholder="e.g. Senior Software Engineer"
                  value={candidateRole}
                  onChange={e => setCandidateRole(e.target.value)}
                  data-testid="input-candidate-role"
                />
              </div>
            </div>

            {/* Client section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Client Details</h3>
                <Badge variant="outline" className="text-xs">Required</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Client (from registry)</Label>
                  <Select value={clientId} onValueChange={handleClientChange}>
                    <SelectTrigger data-testid="select-client">
                      <SelectValue placeholder="Select existing client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.length === 0 && (
                        <SelectItem value="_none" disabled>No clients in registry yet</SelectItem>
                      )}
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Client Name *</Label>
                  <Input
                    placeholder="Type or auto-filled from registry"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    data-testid="input-client-name"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Commercial Terms + Template ───────────────────── */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <h3 className="font-semibold text-sm">Commercial Terms & Template</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Contract Start Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} data-testid="input-start-date" />
              </div>
              <div className="space-y-1.5">
                <Label>Contract End Date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} data-testid="input-end-date" />
              </div>
              <div className="space-y-1.5">
                <Label>Margin Per Hour ($)</Label>
                <Input placeholder="e.g. 15.00" value={margin} onChange={e => setMargin(e.target.value)} data-testid="input-margin" />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Terms (days)</Label>
                <Input type="number" placeholder="e.g. 30 for Net 30" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} data-testid="input-payment-terms" />
              </div>
              <div className="space-y-1.5">
                <Label>Billing Frequency</Label>
                <Select value={billingFreq} onValueChange={setBillingFreq}>
                  <SelectTrigger data-testid="select-billing-freq">
                    <SelectValue placeholder="Select frequency..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>DOCX Template (optional)</Label>
                <Select value={templateId || "_none"} onValueChange={v => { setTemplateId(v === "_none" ? "" : v); if (v === "_none") setFields([]); }}>
                  <SelectTrigger data-testid="select-template">
                    <SelectValue placeholder="No template — metadata only" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No template (metadata record only)</SelectItem>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!templateId && (
                  <p className="text-xs text-amber-600">No template — contract saved as metadata record without DOCX.</p>
                )}
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Internal Notes</Label>
                <Textarea placeholder="Any internal notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} data-testid="textarea-notes" />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Template Variables ─────────────────────────────── */}
        {step === 3 && hasPlaceholders && (
          <div className="space-y-4 py-2">
            <div>
              <h3 className="font-semibold text-sm">Fill Template Placeholders</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                These values will be merged into <strong>{selectedTemplate?.name}</strong>. Fields pre-filled from previous steps — complete any blanks.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {fields.map((f, i) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="font-mono text-xs text-muted-foreground">{`{{${f.key}}}`}</Label>
                  <Input
                    placeholder={f.key.replace(/_/g, " ")}
                    value={f.value}
                    onChange={e => {
                      const updated = [...fields];
                      updated[i] = { ...f, value: e.target.value };
                      setFields(updated);
                    }}
                    data-testid={`input-field-${f.key}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Review Step ────────────────────────────────────────────── */}
        {isLastStep && (
          <div className="space-y-4 py-2">
            <h3 className="font-semibold text-sm">Review & Generate</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground w-32 inline-block">Client:</span> <strong>{clientName}</strong></p>
              {candidateName && (
                <p>
                  <span className="text-muted-foreground w-32 inline-block">Candidate:</span>
                  <strong>{candidateName}</strong>{candidateRole ? ` — ${candidateRole}` : ""}
                </p>
              )}
              {startDate && <p><span className="text-muted-foreground w-32 inline-block">Period:</span> {startDate} → {endDate || "Open-ended"}</p>}
              {margin && <p><span className="text-muted-foreground w-32 inline-block">Margin:</span> ${margin}/hr</p>}
              {paymentTerms && <p><span className="text-muted-foreground w-32 inline-block">Payment:</span> Net {paymentTerms} · {billingFreq?.replace(/_/g, " ") || "unset"} billing</p>}
              {selectedTemplate && <p><span className="text-muted-foreground w-32 inline-block">Template:</span> {selectedTemplate.name}</p>}
              {!templateId && (
                <p className="text-amber-600 text-xs mt-2 bg-amber-50 rounded p-2">
                  No DOCX template — saved as a metadata record. You can import the actual document later.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} data-testid="button-back">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>

            {/* Step 1 → 2 */}
            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!clientName.trim()} data-testid="button-next">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {/* Step 2 → 3 (compute fields) or → review */}
            {step === 2 && (
              <Button
                onClick={() => {
                  computeFields();
                  setStep(3);
                }}
                data-testid="button-next-terms"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {/* Step 3: if there are placeholders → review; else generate */}
            {step === 3 && hasPlaceholders && (
              <Button onClick={() => setStep(4)} data-testid="button-next-review">
                Review <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {step === 3 && !hasPlaceholders && (
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-create-contract">
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate Contract
              </Button>
            )}

            {step === 4 && (
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-create-contract">
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate Contract
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
