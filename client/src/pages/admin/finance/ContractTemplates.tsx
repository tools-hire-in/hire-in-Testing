import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Trash2, FileText, Download, Loader2, Plus, Tag, Info,
  BookOpen, Building2, Globe, ChevronDown, ChevronRight, Copy, Check
} from "lucide-react";
import type { ContractTemplate, ContractClient } from "@shared/schema";

interface Props { canManage: boolean; }

// ─── Placeholder catalogue ────────────────────────────────────────────────────

const STANDARD_PLACEHOLDERS = [
  { tag: "{{client_name}}",           auto: true,  desc: "Legal name of the client company" },
  { tag: "{{client_address}}",        auto: true,  desc: "Client's registered / billing address" },
  { tag: "{{client_signatory_name}}", auto: true,  desc: "Name of the person signing on the client's behalf" },
  { tag: "{{client_signatory_title}}",auto: true,  desc: "Job title of the client signatory" },
  { tag: "{{signatory_name}}",        auto: true,  desc: "Alias for client_signatory_name (legacy)" },
  { tag: "{{signatory_title}}",       auto: true,  desc: "Alias for client_signatory_title (legacy)" },
  { tag: "{{agency_name}}",           auto: true,  desc: "Agency name — always 'Rayomind Solutions LLP'" },
  { tag: "{{agency_signatory_name}}", auto: true,  desc: "Agency authorised signatory name" },
  { tag: "{{contract_date}}",         auto: true,  desc: "Date the contract is generated (DD/MM/YYYY)" },
  { tag: "{{agreement_date}}",        auto: true,  desc: "Agreement date — formatted as '04 May 2026'" },
  { tag: "{{start_date}}",            auto: true,  desc: "Contract / placement start date" },
  { tag: "{{end_date}}",              auto: true,  desc: "Contract end date (blank if open-ended)" },
  { tag: "{{margin_per_hour}}",       auto: true,  desc: "Agency margin per hour (e.g. 15.00)" },
  { tag: "{{payment_terms_days}}",    auto: true,  desc: "Net payment days (e.g. 30 for Net 30)" },
  { tag: "{{billing_frequency}}",     auto: true,  desc: "Weekly / Bi-Weekly / Monthly / Milestone" },
  { tag: "{{notice_period_days}}",    auto: true,  desc: "Days notice required to terminate (default: 14)" },
];

const CANDIDATE_PLACEHOLDERS = [
  { tag: "{{candidate_name}}", auto: true,  desc: "First candidate's full name (single-candidate shortcut)" },
  { tag: "{{candidate_role}}", auto: true,  desc: "First candidate's role / title (single-candidate shortcut)" },
];

const LOOP_FIELDS = [
  { tag: "{{name}}",           desc: "Candidate full name" },
  { tag: "{{role}}",           desc: "Role / job title" },
  { tag: "{{startDate}}",      desc: "Individual start date for this candidate" },
  { tag: "{{location}}",       desc: "Work location (city / remote)" },
  { tag: "{{engagementType}}", desc: "Contract / Contract-to-Hire / Full-Time / etc." },
];

const LOOP_EXAMPLE = `{{#candidates}}
Name: {{name}}  |  Role: {{role}}
Start: {{startDate}}  |  Location: {{location}}
Engagement: {{engagementType}}
{{/candidates}}`;

// ─── Tiny copy-to-clipboard hook ─────────────────────────────────────────────
function CopyBadge({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      className="font-mono text-xs bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 inline-flex items-center gap-1 transition-colors"
      title="Copy"
    >
      {text}
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-slate-400" />}
    </button>
  );
}

// ─── Full placeholder guide dialog ───────────────────────────────────────────
function PlaceholderGuide({ onClose }: { onClose: () => void }) {
  const [loopOpen, setLoopOpen] = useState(true);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Template Placeholder Reference
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1 text-sm">

          {/* Syntax rules */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-blue-900">Syntax rules</p>
            <ul className="space-y-1 text-blue-800 list-disc list-inside text-xs">
              <li>Wrap every placeholder in <CopyBadge text="{{double_curly_braces}}" /></li>
              <li>Use <strong>snake_case</strong> — all lowercase, words separated by underscores</li>
              <li>Only letters, digits, and underscores are allowed inside braces</li>
              <li>Both <CopyBadge text="{{client_name}}" /> and <CopyBadge text="{{CLIENT_NAME}}" /> are accepted</li>
              <li>Badges marked <span className="bg-green-100 text-green-700 px-1 rounded text-[10px] font-medium">Auto-filled</span> are populated automatically — no manual input needed</li>
            </ul>
          </div>

          {/* Standard placeholders */}
          <div>
            <p className="font-semibold mb-2">Standard placeholders — auto-filled from the wizard</p>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-48">Placeholder</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                    <th className="px-3 py-2 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {STANDARD_PLACEHOLDERS.map(p => (
                    <tr key={p.tag} className="hover:bg-muted/20">
                      <td className="px-3 py-2"><CopyBadge text={p.tag} /></td>
                      <td className="px-3 py-2 text-muted-foreground">{p.desc}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge className="text-[10px] h-4 px-1.5 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Auto</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Single-candidate shortcuts */}
          <div>
            <p className="font-semibold mb-2">Single-candidate shortcuts</p>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-48">Placeholder</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                    <th className="px-3 py-2 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {CANDIDATE_PLACEHOLDERS.map(p => (
                    <tr key={p.tag} className="hover:bg-muted/20">
                      <td className="px-3 py-2"><CopyBadge text={p.tag} /></td>
                      <td className="px-3 py-2 text-muted-foreground">{p.desc}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge className="text-[10px] h-4 px-1.5 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Auto</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              For contracts with multiple candidates, use the loop block below instead.
            </p>
          </div>

          {/* Multi-candidate loop */}
          <div className="border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-violet-50 hover:bg-violet-100 transition-colors text-left"
              onClick={() => setLoopOpen(v => !v)}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-violet-900 text-sm">Multi-candidate loop block</span>
                <Badge className="text-[10px] h-4 px-1.5 bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100">Special syntax</Badge>
              </div>
              {loopOpen
                ? <ChevronDown className="h-4 w-4 text-violet-600" />
                : <ChevronRight className="h-4 w-4 text-violet-600" />}
            </button>

            {loopOpen && (
              <div className="p-4 space-y-3 bg-white">
                <p className="text-xs text-muted-foreground">
                  Wrap any repeating candidate block with <CopyBadge text="{{#candidates}}" /> and <CopyBadge text="{{/candidates}}" />.
                  The engine repeats the block once per candidate added in the wizard.
                  Inside the block, use these field names:
                </p>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40">Field tag</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">What it contains</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {LOOP_FIELDS.map(f => (
                        <tr key={f.tag} className="hover:bg-muted/20">
                          <td className="px-3 py-2"><CopyBadge text={f.tag} /></td>
                          <td className="px-3 py-2 text-muted-foreground">{f.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1.5 font-medium">Example — paste into your Word document:</p>
                  <pre className="font-mono text-xs text-green-300 whitespace-pre-wrap leading-relaxed">{LOOP_EXAMPLE}</pre>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs text-amber-800">
                  <strong>Tip:</strong> Each <CopyBadge text="{{#candidates}}" /> and <CopyBadge text="{{/candidates}}" /> tag must be on its own paragraph line in Word. Do not mix them with other text on the same line.
                </div>
              </div>
            )}
          </div>

          {/* Custom placeholders note */}
          <div className="bg-slate-50 border rounded-lg p-3 text-xs text-muted-foreground">
            <strong className="text-slate-700">Custom placeholders:</strong> You can add any <CopyBadge text="{{your_own_tag}}" /> not listed above.
            The system will detect it automatically and prompt for manual input in Step 3 of the contract wizard.
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ContractTemplates({ canManage }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [uploadClientId, setUploadClientId] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: templates = [], isLoading } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contracts/templates"],
  });

  const { data: clients = [] } = useQuery<ContractClient[]>({
    queryKey: ["/api/contracts/clients"],
    select: (data) => data.filter(c => c.isActive !== false),
  });

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/contracts/templates/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/templates"] });
      toast({ title: "Template deleted" });
    },
  });

  const handleUpload = async () => {
    if (!file || !name) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      if (description) formData.append("description", description);
      if (uploadClientId && uploadClientId !== "_generic") formData.append("clientId", uploadClientId);
      const res = await fetch("/api/contracts/templates", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/contracts/templates"] });
      toast({ title: "Template uploaded", description: "Placeholders auto-detected from the document." });
      setShowUpload(false);
      setFile(null); setName(""); setDescription(""); setUploadClientId("");
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const resetUpload = () => { setShowUpload(false); setFile(null); setName(""); setDescription(""); setUploadClientId(""); };

  // Group templates: generic (no client) + per-client buckets
  const generic = templates.filter(t => !t.clientId);
  const byClient: Record<string, ContractTemplate[]> = {};
  templates.filter(t => !!t.clientId).forEach(t => {
    const key = t.clientId!;
    if (!byClient[key]) byClient[key] = [];
    byClient[key].push(t);
  });

  const renderTemplate = (t: ContractTemplate, clientLabel?: string) => (
    <div key={t.id} className="border rounded-lg p-4 flex items-start gap-4 bg-white hover:bg-slate-50/50 transition-colors" data-testid={`card-template-${t.id}`}>
      <FileText className="h-8 w-8 text-blue-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-900 truncate">{t.name}</p>
              {clientLabel
                ? <Badge variant="outline" className="text-xs shrink-0 border-violet-200 text-violet-700 bg-violet-50"><Building2 className="h-3 w-3 mr-1" />{clientLabel}</Badge>
                : <Badge variant="outline" className="text-xs shrink-0 border-slate-200 text-slate-500 bg-slate-50"><Globe className="h-3 w-3 mr-1" />Generic</Badge>
              }
            </div>
            {t.description && <p className="text-sm text-muted-foreground mt-0.5 truncate">{t.description}</p>}
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">Used {t.usageCount}×</Badge>
        </div>
        {Array.isArray(t.placeholderList) && t.placeholderList.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {(t.placeholderList as string[]).slice(0, 8).map(p => (
              <Badge key={p} variant="outline" className="text-xs font-mono">
                <Tag className="h-3 w-3 mr-1" />{`{{${p}}}`}
              </Badge>
            ))}
            {(t.placeholderList as string[]).length > 8 && (
              <Badge variant="outline" className="text-xs">+{(t.placeholderList as string[]).length - 8} more</Badge>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-1 italic">No placeholders detected</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">Uploaded {new Date(t.createdAt!).toLocaleDateString()}</p>
      </div>
      {canManage && (
        <Button
          variant="ghost" size="sm" className="text-red-500 hover:text-red-600 shrink-0"
          onClick={() => deleteMutation.mutate(t.id)}
          data-testid={`button-delete-template-${t.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">

      {/* How-to banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-900 text-sm">How to author a contract template</p>
              <p className="text-blue-700 text-sm mt-1">
                Write your contract in Microsoft Word (.docx). Wherever you want data merged in, insert a placeholder using{" "}
                <code className="bg-blue-100 px-1 rounded font-mono text-blue-900 text-xs">{"{{double_curly_braces}}"}</code>.
                Upload it here — the system auto-detects every placeholder.
                For <strong>multiple candidates</strong> use the loop block{" "}
                <code className="bg-blue-100 px-1 rounded font-mono text-blue-900 text-xs">{"{{#candidates}}…{{/candidates}}"}</code>.
              </p>
              <Button variant="link" className="text-blue-700 p-0 h-auto text-sm mt-1" onClick={() => setShowGuide(true)} data-testid="button-view-guide">
                <BookOpen className="h-3.5 w-3.5 mr-1" /> View full placeholder reference →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action bar */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="text-xs text-muted-foreground">
          {templates.length > 0 && (
            <span>{generic.length} generic · {templates.length - generic.length} client-specific</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/contracts/sample-template" download="Staffing_Services_Agreement_Sample.docx" data-testid="button-download-sample">
              <Download className="h-4 w-4 mr-2" /> Download Sample
            </a>
          </Button>
          {canManage && (
            <Button onClick={() => setShowUpload(true)} data-testid="button-upload-template">
              <Plus className="h-4 w-4 mr-2" /> Upload Template
            </Button>
          )}
        </div>
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No templates uploaded yet</p>
          <p className="text-sm mt-1">Create a Word document with <code className="bg-muted px-1 rounded font-mono text-xs">{"{{placeholder}}"}</code> tags and upload it.</p>
          <Button variant="link" className="mt-2 text-sm" onClick={() => setShowGuide(true)}>View placeholder reference</Button>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Generic section */}
          {generic.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">Generic Templates</h3>
                <span className="text-xs text-muted-foreground">— available for any client</span>
              </div>
              <div className="grid gap-2">
                {generic.map(t => renderTemplate(t))}
              </div>
            </div>
          )}

          {/* Per-client sections */}
          {Object.entries(byClient).map(([cid, tmplList]) => {
            const client = clientMap[cid];
            const label = client?.name || "Unknown Client";
            return (
              <div key={cid} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-violet-500" />
                  <h3 className="text-sm font-semibold text-violet-800">{label}</h3>
                  <span className="text-xs text-muted-foreground">— {tmplList.length} template{tmplList.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid gap-2">
                  {tmplList.map(t => renderTemplate(t, label))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Placeholder guide dialog */}
      {showGuide && <PlaceholderGuide onClose={() => setShowGuide(false)} />}

      {/* Upload dialog */}
      {showUpload && (
        <Dialog open onOpenChange={resetUpload}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Contract Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">

              {/* Drop zone */}
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
                data-testid="dropzone-template"
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-6 w-6 text-primary" />
                    <span className="font-medium text-sm">{file.name}</span>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium">Click to select DOCX file</p>
                    <p className="text-xs text-muted-foreground mt-1">Use <code>{"{{placeholder}}"}</code> tags in your Word document</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".docx" className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)} data-testid="input-template-file" />

              <div className="space-y-1.5">
                <Label>Template Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. IT Staffing Services Agreement" data-testid="input-template-name" />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Optional description..." data-testid="textarea-template-desc" />
              </div>

              {/* Client picker */}
              <div className="space-y-1.5">
                <Label>Link to Client <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Select value={uploadClientId || "_generic"} onValueChange={v => setUploadClientId(v === "_generic" ? "" : v)}>
                  <SelectTrigger data-testid="select-upload-client">
                    <SelectValue placeholder="Generic — available for all clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_generic">
                      <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-slate-400" /> Generic — available for all clients</span>
                    </SelectItem>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-violet-500" /> {c.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {uploadClientId && uploadClientId !== "_generic"
                    ? "This template will appear first when generating a contract for this client."
                    : "Generic templates are available for any client."}
                </p>
              </div>

              <Button variant="link" className="p-0 h-auto text-xs" onClick={() => setShowGuide(true)}>
                <BookOpen className="h-3 w-3 mr-1" /> View all placeholders & loop syntax
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetUpload}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!file || !name || loading} data-testid="button-confirm-upload">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Upload Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
