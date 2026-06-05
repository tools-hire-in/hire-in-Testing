import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ChevronRight, ChevronLeft, Wand2, Search, User, X, Info,
  AlertCircle, Plus, Building2, CheckCircle2, ExternalLink, Trash2
} from "lucide-react";
import type { ContractClient, ContractTemplate, InsertContractClient } from "@shared/schema";

interface CandidateSuggestion {
  name: string;
  email?: string;
  phone?: string;
  skills?: string;
}

interface CandidateEntry {
  name: string;
  role: string;
  startDate: string;
  location: string;
  engagementType: string;
  searchQuery: string;
  showSuggestions: boolean;
}

const EMPTY_CANDIDATE: CandidateEntry = {
  name: "", role: "", startDate: "", location: "", engagementType: "",
  searchQuery: "", showSuggestions: false,
};

interface Props {
  clients?: ContractClient[];
  onClose: () => void;
  onCreated: () => void;
  onGoToClientsTab?: () => void;
}

interface TemplateField {
  key: string;
  value: string;
  autoFilled: boolean;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

const EMPTY_CLIENT: Partial<InsertContractClient> = {
  name: "", signatoryName: "", signatoryTitle: "", email: "", address: "",
};

// Format a date string as "04 May 2026"
function formatAgreementDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export default function ContractGenerator({ onClose, onCreated, onGoToClientsTab }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Multi-candidate state
  const [candidates, setCandidates] = useState<CandidateEntry[]>([{ ...EMPTY_CANDIDATE }]);

  // Per-candidate Ceipal search results (keyed by index)
  const [searchResults, setSearchResults] = useState<Record<number, { candidates: CandidateSuggestion[]; ceipal_unavailable?: boolean; message?: string }>>({});
  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({});
  const debouncedQueries = Object.fromEntries(
    Object.entries(searchQueries).map(([k, v]) => [k, v])
  );
  const suggestionsRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Client state
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");

  // Inline add-client form state
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineForm, setInlineForm] = useState<Partial<InsertContractClient>>(EMPTY_CLIENT);

  // Step 2 — Commercial terms
  const [templateId, setTemplateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [agreementDate, setAgreementDate] = useState("");
  const [margin, setMargin] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [billingFreq, setBillingFreq] = useState("");
  const [notes, setNotes] = useState("");

  // Step 3 — Template variable fill
  const [fields, setFields] = useState<TemplateField[]>([]);

  // Own clients query so inline creation refreshes the dropdown
  const { data: clients = [] } = useQuery<ContractClient[]>({
    queryKey: ["/api/contracts/clients"],
  });

  const { data: templates = [] } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contracts/templates"],
  });

  const selectedTemplate = templates.find(t => t.id === templateId);
  const selectedClient = clients.find(c => c.id === clientId) || null;

  // Debounced per-candidate searches
  const [debouncedSearchMap, setDebouncedSearchMap] = useState<Record<number, string>>({});

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    candidates.forEach((_, idx) => {
      const q = searchQueries[idx] || "";
      const timer = setTimeout(() => {
        setDebouncedSearchMap(prev => ({ ...prev, [idx]: q }));
      }, 350);
      timers.push(timer);
    });
    return () => timers.forEach(clearTimeout);
  }, [searchQueries, candidates.length]);

  // Fetch Ceipal suggestions for each candidate that has an active query
  useEffect(() => {
    candidates.forEach((_, idx) => {
      const q = debouncedSearchMap[idx] || "";
      if (q.length < 2) return;
      fetch(`/api/contracts/candidates/search?q=${encodeURIComponent(q)}`, { credentials: "include" })
        .then(r => r.json())
        .then(data => setSearchResults(prev => ({ ...prev, [idx]: data })))
        .catch(() => setSearchResults(prev => ({ ...prev, [idx]: { candidates: [], ceipal_unavailable: true } })));
    });
  }, [debouncedSearchMap]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setCandidates(prev => prev.map((c, idx) => {
        const ref = suggestionsRefs.current[idx];
        if (ref && !ref.contains(e.target as Node)) {
          return { ...c, showSuggestions: false };
        }
        return c;
      }));
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClientChange = (id: string) => {
    setClientId(id);
    const client = clients.find(c => c.id === id);
    if (client) setClientName(client.name);
  };

  const updateCandidate = (idx: number, patch: Partial<CandidateEntry>) => {
    setCandidates(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };

  const addCandidate = () => {
    setCandidates(prev => [...prev, { ...EMPTY_CANDIDATE }]);
  };

  const removeCandidate = (idx: number) => {
    setCandidates(prev => prev.filter((_, i) => i !== idx));
    setSearchResults(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setSearchQueries(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };

  const handleSelectSuggestion = (idx: number, c: CandidateSuggestion) => {
    updateCandidate(idx, { name: c.name, searchQuery: c.name, showSuggestions: false });
    setSearchQueries(prev => ({ ...prev, [idx]: c.name }));
  };

  // Inline client creation mutation
  const addClientMutation = useMutation<ContractClient, Error, Partial<InsertContractClient>>({
    mutationFn: async (data: Partial<InsertContractClient>) => {
      const res = await apiRequest("POST", "/api/contracts/clients", data);
      return res.json() as Promise<ContractClient>;
    },
    onSuccess: async (created: ContractClient) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/contracts/clients"] });
      setClientId(created.id);
      setClientName(created.name);
      setShowInlineAdd(false);
      setInlineForm(EMPTY_CLIENT);
      toast({ title: "Client added", description: `${created.name} saved and selected.` });
    },
    onError: (e: Error) => toast({ title: "Error saving client", description: e.message, variant: "destructive" }),
  });

  const buildPrefillMap = (client?: ContractClient | null) => {
    const first = candidates[0];
    return {
      client_name: clientName,
      candidate_name: first?.name || "",
      candidate_role: first?.role || "",
      start_date: first?.startDate || startDate,
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
      agreement_date: agreementDate ? formatAgreementDate(agreementDate) : "",
      agency_signatory_name: "Authorised Signatory",
      client_signatory_name: client?.signatoryName || "",
      client_signatory_title: client?.signatoryTitle || "",
    } as Record<string, string>;
  };

  const computeFields = () => {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl?.placeholderList) return;
    const client = clients.find(c => c.id === clientId) || null;
    const prefill = buildPrefillMap(client);
    setFields((tmpl.placeholderList as string[]).map(p => ({
      key: p,
      value: prefill[p] || "",
      autoFilled: !!(prefill[p] && prefill[p].trim() !== ""),
    })));
  };

  const hasPlaceholders = !!templateId && (selectedTemplate?.placeholderList as string[] | null)?.length;

  const buildCandidatesPayload = () =>
    candidates
      .filter(c => c.name.trim())
      .map(c => ({
        name: c.name,
        role: c.role,
        startDate: c.startDate,
        location: c.location,
        engagementType: c.engagementType,
      }));

  const createMutation = useMutation({
    mutationFn: () => {
      const variableValues: Record<string, string> = {};
      fields.forEach(f => { variableValues[f.key] = f.value; });
      const candidatesPayload = buildCandidatesPayload();
      const first = candidatesPayload[0];
      return apiRequest("POST", "/api/contracts", {
        templateId: templateId || null,
        clientId: clientId || null,
        clientName,
        candidateName: first?.name || null,
        candidateRole: first?.role || null,
        candidates: candidatesPayload,
        variableValues,
        contractStartDate: startDate || (first?.startDate || null),
        contractEndDate: endDate || null,
        agreementDate: agreementDate ? formatAgreementDate(agreementDate) : null,
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

        {/* ── Step 1: Candidates + Client ─────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Candidate Details</h3>
                  <Badge variant="outline" className="text-xs">Optional</Badge>
                </div>
              </div>

              {/* Candidate cards */}
              {candidates.map((candidate, idx) => {
                const result = searchResults[idx];
                const ceipalUnavailable = result?.ceipal_unavailable === true;
                const suggestions = result?.candidates || [];
                const q = searchQueries[idx] || "";
                const dq = debouncedSearchMap[idx] || "";

                return (
                  <div key={idx} className="border rounded-lg p-3 space-y-3 bg-slate-50/50">
                    {/* Card header */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Candidate {candidates.length > 1 ? idx + 1 : ""}
                      </span>
                      {idx > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeCandidate(idx)}
                          data-testid={`button-remove-candidate-${idx}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Ceipal search */}
                    <div
                      className="relative"
                      ref={el => { suggestionsRefs.current[idx] = el; }}
                    >
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-9 pr-9"
                          placeholder={ceipalUnavailable ? "Type candidate name (manual entry)..." : "Search Ceipal ATS for candidate..."}
                          value={q}
                          onChange={e => {
                            setSearchQueries(prev => ({ ...prev, [idx]: e.target.value }));
                            updateCandidate(idx, { name: e.target.value, showSuggestions: true });
                          }}
                          onFocus={() => updateCandidate(idx, { showSuggestions: true })}
                          data-testid={`input-candidate-search-${idx}`}
                        />
                        {q && (
                          <button
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setSearchQueries(prev => ({ ...prev, [idx]: "" }));
                              updateCandidate(idx, { name: "", searchQuery: "", showSuggestions: false });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Suggestions dropdown */}
                      {candidate.showSuggestions && dq.length >= 2 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                          {ceipalUnavailable ? (
                            <div className="p-3 flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-slate-800">Ceipal search unavailable</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {result?.message || "Using manual entry — type the candidate's name above."}
                                </p>
                              </div>
                            </div>
                          ) : suggestions.length === 0 ? (
                            <div className="p-3 text-sm text-muted-foreground text-center">
                              No candidates found for "{dq}"
                            </div>
                          ) : (
                            suggestions.map((c, si) => (
                              <button
                                key={si}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b last:border-b-0 transition-colors"
                                onClick={() => handleSelectSuggestion(idx, c)}
                                data-testid={`candidate-suggestion-${idx}-${si}`}
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
                          Ceipal ATS is unavailable. Enter the name and role manually.
                        </p>
                      </div>
                    )}

                    {/* Candidate fields grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Role / Title</Label>
                        <Input
                          placeholder="e.g. Senior Software Engineer"
                          value={candidate.role}
                          onChange={e => updateCandidate(idx, { role: e.target.value })}
                          data-testid={`input-candidate-role-${idx}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Start Date</Label>
                        <Input
                          type="date"
                          value={candidate.startDate}
                          onChange={e => updateCandidate(idx, { startDate: e.target.value })}
                          data-testid={`input-candidate-startdate-${idx}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Location</Label>
                        <Input
                          placeholder="e.g. New York, NY"
                          value={candidate.location}
                          onChange={e => updateCandidate(idx, { location: e.target.value })}
                          data-testid={`input-candidate-location-${idx}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Engagement Type</Label>
                        <Select
                          value={candidate.engagementType || "_none"}
                          onValueChange={v => updateCandidate(idx, { engagementType: v === "_none" ? "" : v })}
                        >
                          <SelectTrigger data-testid={`select-candidate-engagement-${idx}`}>
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">— Select —</SelectItem>
                            <SelectItem value="Contract">Contract</SelectItem>
                            <SelectItem value="Contract-to-Hire">Contract-to-Hire</SelectItem>
                            <SelectItem value="Full-Time">Full-Time</SelectItem>
                            <SelectItem value="Part-Time">Part-Time</SelectItem>
                            <SelectItem value="Temp">Temp</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add Another Candidate */}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs gap-1.5 border-dashed"
                onClick={addCandidate}
                data-testid="button-add-candidate"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Another Candidate
              </Button>
            </div>

            {/* Client section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Client Details</h3>
                  <Badge variant="outline" className="text-xs">Required</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowInlineAdd(v => !v); }}
                  data-testid="button-inline-add-client"
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add New Client
                </Button>
              </div>

              {/* Inline add-client form */}
              {showInlineAdd && (
                <div className="border border-primary/20 rounded-lg bg-primary/5 p-4 space-y-3">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">New Client</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Company Name *</Label>
                      <Input
                        placeholder="e.g. Acme Corp"
                        value={inlineForm.name || ""}
                        onChange={e => setInlineForm(f => ({ ...f, name: e.target.value }))}
                        data-testid="input-inline-client-name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Signatory Name</Label>
                      <Input
                        placeholder="e.g. Jane Smith"
                        value={inlineForm.signatoryName || ""}
                        onChange={e => setInlineForm(f => ({ ...f, signatoryName: e.target.value }))}
                        data-testid="input-inline-signatory-name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Signatory Title</Label>
                      <Input
                        placeholder="e.g. VP of Engineering"
                        value={inlineForm.signatoryTitle || ""}
                        onChange={e => setInlineForm(f => ({ ...f, signatoryTitle: e.target.value }))}
                        data-testid="input-inline-signatory-title"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        placeholder="contact@company.com"
                        value={inlineForm.email || ""}
                        onChange={e => setInlineForm(f => ({ ...f, email: e.target.value }))}
                        data-testid="input-inline-client-email"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Address</Label>
                      <Textarea
                        placeholder="123 Business St, City, State ZIP"
                        value={inlineForm.address || ""}
                        onChange={e => setInlineForm(f => ({ ...f, address: e.target.value }))}
                        rows={2}
                        data-testid="textarea-inline-client-address"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowInlineAdd(false); setInlineForm(EMPTY_CLIENT); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => addClientMutation.mutate(inlineForm)}
                      disabled={!inlineForm.name?.trim() || addClientMutation.isPending}
                      data-testid="button-inline-save-client"
                    >
                      {addClientMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                      Save & Select
                    </Button>
                  </div>
                </div>
              )}

              {/* Client dropdown */}
              <div className="space-y-1.5">
                <Label>Select from Registry</Label>
                <Select value={clientId} onValueChange={handleClientChange}>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select existing client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.filter(c => c.isActive !== false).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Client name override */}
              <div className="space-y-1.5">
                <Label>Client Name *</Label>
                <Input
                  placeholder="Type or auto-filled from registry"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  data-testid="input-client-name"
                />
              </div>

              {/* Empty registry state */}
              {clients.length === 0 && !showInlineAdd && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm text-amber-800 font-medium">No clients saved yet</p>
                    <p className="text-xs text-amber-700">
                      Add your first client using the <strong>Add New Client</strong> button above
                      {onGoToClientsTab && (
                        <>, or{" "}
                          <button
                            className="underline font-medium hover:text-amber-900 inline-flex items-center gap-0.5"
                            onClick={() => { onClose(); onGoToClientsTab(); }}
                            data-testid="button-go-to-clients-tab"
                          >
                            go to the Clients tab
                            <ExternalLink className="h-3 w-3" />
                          </button>
                          {" "}to manage your registry
                        </>
                      )}.
                    </p>
                  </div>
                </div>
              )}

              {/* Selected client detail card */}
              {selectedClient && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Client details — will be merged into contract</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
                    <div>
                      <span className="text-muted-foreground">Company</span>
                      <p className="font-medium">{selectedClient.name}</p>
                    </div>
                    {selectedClient.email && (
                      <div>
                        <span className="text-muted-foreground">Email</span>
                        <p className="font-medium">{selectedClient.email}</p>
                      </div>
                    )}
                    {selectedClient.signatoryName && (
                      <div>
                        <span className="text-muted-foreground">Signatory</span>
                        <p className="font-medium">
                          {selectedClient.signatoryName}
                          {selectedClient.signatoryTitle && <span className="text-muted-foreground font-normal"> · {selectedClient.signatoryTitle}</span>}
                        </p>
                      </div>
                    )}
                    {selectedClient.address && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Address</span>
                        <p className="font-medium whitespace-pre-line">{selectedClient.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                <Label>Agreement Date</Label>
                <Input
                  type="date"
                  value={agreementDate}
                  onChange={e => setAgreementDate(e.target.value)}
                  data-testid="input-agreement-date"
                />
                {agreementDate && (
                  <p className="text-xs text-muted-foreground">Will render as: <strong>{formatAgreementDate(agreementDate)}</strong></p>
                )}
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
                    {/* Client-specific templates shown first */}
                    {clientId && templates.filter(t => t.clientId === clientId).length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 -mx-1">
                          {clientName} — Dedicated Templates
                        </div>
                        {templates.filter(t => t.clientId === clientId).map(t => (
                          <SelectItem key={t.id} value={t.id}>⭐ {t.name}</SelectItem>
                        ))}
                        {templates.filter(t => !t.clientId).length > 0 && (
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30 -mx-1">
                            Generic Templates
                          </div>
                        )}
                      </>
                    )}
                    {templates.filter(t => !t.clientId).map(t => (
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
                These values will be merged into <strong>{selectedTemplate?.name}</strong>.
                Fields marked <span className="text-green-700 font-medium">Auto-filled</span> are pre-populated from earlier steps — review and adjust if needed. <span className="text-amber-700 font-medium">Highlighted</span> fields need manual input.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {fields.map((f, i) => {
                const isEmpty = !f.value || f.value.trim() === "";
                return (
                  <div key={f.key} className={`space-y-1.5 rounded-lg p-2 -m-2 ${isEmpty ? "bg-amber-50 border border-amber-200" : ""}`}>
                    <div className="flex items-center gap-2">
                      <Label className="font-mono text-xs text-muted-foreground">{`{{${f.key}}}`}</Label>
                      {f.autoFilled ? (
                        <Badge className="text-[10px] h-4 px-1.5 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Auto-filled
                        </Badge>
                      ) : isEmpty ? (
                        <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                          Needs input
                        </Badge>
                      ) : null}
                    </div>
                    <Input
                      placeholder={f.key.replace(/_/g, " ")}
                      value={f.value}
                      onChange={e => {
                        const updated = [...fields];
                        updated[i] = { ...f, value: e.target.value, autoFilled: false };
                        setFields(updated);
                      }}
                      className={isEmpty ? "border-amber-300 focus-visible:ring-amber-400" : ""}
                      data-testid={`input-field-${f.key}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Review Step ────────────────────────────────────────────── */}
        {isLastStep && (
          <div className="space-y-4 py-2">
            <h3 className="font-semibold text-sm">Review & Generate</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground w-32 inline-block">Client:</span> <strong>{clientName}</strong></p>
              {candidates.filter(c => c.name.trim()).map((c, i) => (
                <p key={i}>
                  <span className="text-muted-foreground w-32 inline-block">{i === 0 ? "Candidate:" : ""}</span>
                  <strong>{c.name}</strong>
                  {c.role ? ` — ${c.role}` : ""}
                  {c.location ? ` · ${c.location}` : ""}
                  {c.engagementType ? ` · ${c.engagementType}` : ""}
                </p>
              ))}
              {startDate && <p><span className="text-muted-foreground w-32 inline-block">Period:</span> {startDate} → {endDate || "Open-ended"}</p>}
              {agreementDate && <p><span className="text-muted-foreground w-32 inline-block">Agreement Date:</span> {formatAgreementDate(agreementDate)}</p>}
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
