import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, X } from "lucide-react";
import type { ContractClient } from "@shared/schema";

interface Props {
  clients: ContractClient[];
  onClose: () => void;
  onCreated: () => void;
}

export default function ImportContract({ clients, onClose, onCreated }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidateRole, setCandidateRole] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [margin, setMargin] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [billingFreq, setBillingFreq] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClientChange = (id: string) => {
    setClientId(id);
    const client = clients.find(c => c.id === id);
    if (client) setClientName(client.name);
  };

  const handleSubmit = async () => {
    if (!file) return toast({ title: "Please select a file", variant: "destructive" });
    if (!clientName.trim()) return toast({ title: "Client name is required", variant: "destructive" });

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("clientName", clientName);
      if (clientId) formData.append("clientId", clientId);
      if (candidateName) formData.append("candidateName", candidateName);
      if (candidateRole) formData.append("candidateRole", candidateRole);
      if (startDate) formData.append("contractStartDate", startDate);
      if (endDate) formData.append("contractEndDate", endDate);
      if (margin) formData.append("marginPerHour", margin);
      if (paymentTerms) formData.append("paymentTermsDays", paymentTerms);
      if (billingFreq) formData.append("billingFrequency", billingFreq);
      if (notes) formData.append("notes", notes);

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

        <div className="space-y-4 py-2">
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
            <div className="space-y-1.5">
              <Label>Candidate Name</Label>
              <Input
                value={candidateName}
                onChange={e => setCandidateName(e.target.value)}
                placeholder="Placed candidate name"
                data-testid="input-candidate-name-import"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Candidate Role</Label>
              <Input
                value={candidateRole}
                onChange={e => setCandidateRole(e.target.value)}
                placeholder="e.g. Registered Nurse"
                data-testid="input-candidate-role-import"
              />
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
              <Label>Margin Per Hour ($)</Label>
              <Input
                placeholder="e.g. 15.00"
                value={margin}
                onChange={e => setMargin(e.target.value)}
                data-testid="input-margin-import"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Terms (days)</Label>
              <Input
                type="number"
                placeholder="e.g. 30"
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
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Internal Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Legacy contract signed March 2023, uploaded for record-keeping"
                rows={2}
                data-testid="textarea-notes-import"
              />
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
