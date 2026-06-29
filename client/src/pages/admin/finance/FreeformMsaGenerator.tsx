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
  Loader2, ChevronRight, ChevronLeft, Building2, ScrollText, MapPin, FileText,
} from "lucide-react";
import type { ContractClient, InsertContractClient } from "@shared/schema";
import {
  buildDefaultMsaClauses, buildGoverningLawClause, GOVERNING_LAW_KEY, type MsaClause,
} from "@shared/msaClauses";

interface Props {
  clients?: ContractClient[];
  onClose: () => void;
  onCreated: () => void;
}

interface PartyState {
  name: string;
  ein: string;
  address: string;
  signatoryName: string;
  signatoryTitle: string;
}

const EMPTY_PARTY: PartyState = { name: "", ein: "", address: "", signatoryName: "", signatoryTitle: "" };

const PROVIDER_DEFAULT: PartyState = {
  name: "Hire'in Solutions",
  ein: "",
  address: "",
  signatoryName: "",
  signatoryTitle: "Authorized Signatory",
};

function formatAgreementDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export default function FreeformMsaGenerator({ onClose, onCreated }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Client (registry pick OR manual)
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState<PartyState>({ ...EMPTY_PARTY });

  // Service provider (us) — editable
  const [provider, setProvider] = useState<PartyState>({ ...PROVIDER_DEFAULT });

  // Establishment jurisdiction
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [country, setCountry] = useState("");

  // Commercial / dates
  const [agreementDate, setAgreementDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30");
  const [billingFreq, setBillingFreq] = useState("monthly");
  const [notes, setNotes] = useState("");

  // Editable clauses
  const [clauses, setClauses] = useState<MsaClause[]>(() => buildDefaultMsaClauses());
  const [additionalTerms, setAdditionalTerms] = useState("");

  // Track whether the user has manually edited the governing-law clause so we
  // only auto-regenerate it from the jurisdiction fields while it's untouched.
  const govTouched = useRef(false);
  const lastAutoGov = useRef(buildGoverningLawClause("", "", ""));

  const { data: clients = [] } = useQuery<ContractClient[]>({
    queryKey: ["/api/contracts/clients"],
  });

  // Keep the governing-law clause synced with jurisdiction unless user edited it.
  useEffect(() => {
    if (govTouched.current) return;
    const next = buildGoverningLawClause(city, stateRegion, country);
    lastAutoGov.current = next;
    setClauses(prev => prev.map(c => (c.key === GOVERNING_LAW_KEY ? { ...c, body: next } : c)));
  }, [city, stateRegion, country]);

  function handleClientSelect(id: string) {
    setClientId(id);
    const c = clients.find(x => x.id === id);
    if (c) {
      setClient({
        name: c.name || "",
        ein: (c as any).ein || "",
        address: c.address || "",
        signatoryName: c.signatoryName || "",
        signatoryTitle: c.signatoryTitle || "",
      });
    }
  }

  function updateClause(key: string, field: "title" | "body", value: string) {
    if (key === GOVERNING_LAW_KEY && field === "body") govTouched.current = true;
    setClauses(prev => prev.map(c => (c.key === key ? { ...c, [field]: value } : c)));
  }

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/contracts", {
      clientName: client.name,
      clientId: clientId || null,
      agreementDate: agreementDate || null,
      paymentTermsDays: paymentTerms ? Number(paymentTerms) : null,
      billingFrequency: billingFreq || null,
      notes: notes || null,
      templateName: "Master Services Agreement (Freeform)",
      freeformMsa: {
        client: {
          name: client.name,
          ein: client.ein,
          address: client.address,
          signatoryName: client.signatoryName,
          signatoryTitle: client.signatoryTitle,
        },
        provider: {
          name: provider.name,
          ein: provider.ein,
          address: provider.address,
          signatoryName: provider.signatoryName,
          signatoryTitle: provider.signatoryTitle,
        },
        establishment: { city, state: stateRegion, country },
        clauses,
        additionalTerms,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "MSA generated", description: "The freeform Master Services Agreement was created." });
      onCreated();
    },
    onError: (e: any) => {
      toast({ title: "Generation failed", description: e?.message || "Could not generate the MSA.", variant: "destructive" });
    },
  });

  const canProceedStep1 = client.name.trim().length > 0;
  const isLastStep = step === 4;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-[#1F3A6E]" />
            New MSA — Freeform Builder
            <Badge variant="outline" className="text-xs ml-1">Step {step} of 4</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Parties ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Client</h3>
                <Badge variant="outline" className="text-xs">Required</Badge>
              </div>

              <div className="space-y-1.5">
                <Label>Select from Registry (optional)</Label>
                <Select value={clientId || "_manual"} onValueChange={v => (v === "_manual" ? (setClientId(""), setClient({ ...EMPTY_PARTY })) : handleClientSelect(v))}>
                  <SelectTrigger data-testid="select-msa-client">
                    <SelectValue placeholder="Type details manually or pick a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_manual">Enter details manually</SelectItem>
                    {clients.filter(c => c.isActive !== false).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Company Name *</Label>
                  <Input value={client.name} onChange={e => setClient(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Acme Corp" data-testid="input-msa-client-name" />
                </div>
                <div className="space-y-1.5">
                  <Label>EIN / Tax ID</Label>
                  <Input value={client.ein} onChange={e => setClient(c => ({ ...c, ein: e.target.value }))} placeholder="e.g. 12-3456789" data-testid="input-msa-client-ein" />
                </div>
                <div className="space-y-1.5">
                  <Label>Signatory Name</Label>
                  <Input value={client.signatoryName} onChange={e => setClient(c => ({ ...c, signatoryName: e.target.value }))} placeholder="e.g. Jane Smith" data-testid="input-msa-client-signatory-name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Signatory Title</Label>
                  <Input value={client.signatoryTitle} onChange={e => setClient(c => ({ ...c, signatoryTitle: e.target.value }))} placeholder="e.g. VP of Operations" data-testid="input-msa-client-signatory-title" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Address</Label>
                  <Textarea value={client.address} onChange={e => setClient(c => ({ ...c, address: e.target.value }))} rows={2} placeholder="123 Business St, City, State ZIP" data-testid="textarea-msa-client-address" />
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Service Provider (You)</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input value={provider.name} onChange={e => setProvider(p => ({ ...p, name: e.target.value }))} data-testid="input-msa-provider-name" />
                </div>
                <div className="space-y-1.5">
                  <Label>EIN / Tax ID</Label>
                  <Input value={provider.ein} onChange={e => setProvider(p => ({ ...p, ein: e.target.value }))} data-testid="input-msa-provider-ein" />
                </div>
                <div className="space-y-1.5">
                  <Label>Signatory Name</Label>
                  <Input value={provider.signatoryName} onChange={e => setProvider(p => ({ ...p, signatoryName: e.target.value }))} data-testid="input-msa-provider-signatory-name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Signatory Title</Label>
                  <Input value={provider.signatoryTitle} onChange={e => setProvider(p => ({ ...p, signatoryTitle: e.target.value }))} data-testid="input-msa-provider-signatory-title" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Address</Label>
                  <Textarea value={provider.address} onChange={e => setProvider(p => ({ ...p, address: e.target.value }))} rows={2} data-testid="textarea-msa-provider-address" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Establishment & Terms ───────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Establishment Jurisdiction</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Dallas" data-testid="input-msa-city" />
                </div>
                <div className="space-y-1.5">
                  <Label>State / Region</Label>
                  <Input value={stateRegion} onChange={e => setStateRegion(e.target.value)} placeholder="e.g. Texas" data-testid="input-msa-state" />
                </div>
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. USA" data-testid="input-msa-country" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Used in the preamble and to pre-fill the Governing Law clause (still editable in the next step).</p>
            </div>

            <div className="space-y-3 border-t pt-4">
              <h3 className="font-semibold text-sm">Agreement & Commercial Terms</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Agreement Date</Label>
                  <Input type="date" value={agreementDate} onChange={e => setAgreementDate(e.target.value)} data-testid="input-msa-agreement-date" />
                  {agreementDate && <p className="text-xs text-muted-foreground">Renders as: <strong>{formatAgreementDate(agreementDate)}</strong></p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Terms (days)</Label>
                  <Input type="number" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="e.g. 30" data-testid="input-msa-payment-terms" />
                </div>
                <div className="space-y-1.5">
                  <Label>Billing Frequency</Label>
                  <Select value={billingFreq} onValueChange={setBillingFreq}>
                    <SelectTrigger data-testid="select-msa-billing-freq"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="milestone">Milestone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Internal Notes</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any internal notes..." data-testid="textarea-msa-notes" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Clauses + freeform terms ────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Standard Clauses</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Pre-written defaults — edit any title or wording before generating.</p>
            </div>
            <div className="space-y-4">
              {clauses.map((cl) => (
                <div key={cl.key} className="rounded-lg border p-3 space-y-2 bg-slate-50/50">
                  <Input
                    value={cl.title}
                    onChange={e => updateClause(cl.key, "title", e.target.value)}
                    className="font-semibold text-sm"
                    data-testid={`input-msa-clause-title-${cl.key}`}
                  />
                  <Textarea
                    value={cl.body}
                    onChange={e => updateClause(cl.key, "body", e.target.value)}
                    rows={4}
                    className="text-sm"
                    data-testid={`textarea-msa-clause-body-${cl.key}`}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1.5 border-t pt-4">
              <Label>Additional Legal Terms (freeform)</Label>
              <Textarea
                value={additionalTerms}
                onChange={e => setAdditionalTerms(e.target.value)}
                rows={6}
                placeholder="Paste any extra legal terms, special conditions, or annexures here..."
                data-testid="textarea-msa-additional-terms"
              />
            </div>
          </div>
        )}

        {/* ── Step 4: Review ──────────────────────────────────────────────── */}
        {isLastStep && (
          <div className="space-y-4 py-2">
            <h3 className="font-semibold text-sm">Review & Generate</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground w-36 inline-block">Client:</span> <strong>{client.name || "—"}</strong>{client.ein ? ` · EIN ${client.ein}` : ""}</p>
              {client.signatoryName && <p><span className="text-muted-foreground w-36 inline-block">Client Signatory:</span> {client.signatoryName}{client.signatoryTitle ? ` · ${client.signatoryTitle}` : ""}</p>}
              <p><span className="text-muted-foreground w-36 inline-block">Service Provider:</span> {provider.name || "—"}</p>
              {(city || stateRegion || country) && <p><span className="text-muted-foreground w-36 inline-block">Establishment:</span> {[city, stateRegion, country].filter(Boolean).join(", ")}</p>}
              {agreementDate && <p><span className="text-muted-foreground w-36 inline-block">Agreement Date:</span> {formatAgreementDate(agreementDate)}</p>}
              {paymentTerms && <p><span className="text-muted-foreground w-36 inline-block">Payment:</span> Net {paymentTerms} · {billingFreq?.replace(/_/g, " ")} billing</p>}
              <p><span className="text-muted-foreground w-36 inline-block">Clauses:</span> {clauses.length} standard{additionalTerms.trim() ? " + additional terms" : ""}</p>
            </div>
            <p className="text-xs text-muted-foreground">A DOCX will be generated and saved as a draft contract. You can then dispatch it for e-signature like any other contract.</p>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} data-testid="button-msa-back">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1} data-testid="button-msa-next-1">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => setStep(3)} data-testid="button-msa-next-2">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={() => setStep(4)} data-testid="button-msa-next-3">
                Review <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {isLastStep && (
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !client.name.trim()} data-testid="button-msa-generate">
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate MSA
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
