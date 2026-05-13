import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, FileText, Download, Loader2, Plus, Tag, Info, BookOpen } from "lucide-react";
import type { ContractTemplate } from "@shared/schema";

interface Props { canManage: boolean; }

const COMMON_PLACEHOLDERS = [
  { tag: "{{client_name}}", desc: "Legal name of the client company" },
  { tag: "{{client_address}}", desc: "Client's registered address" },
  { tag: "{{signatory_name}}", desc: "Name of the person signing on client side" },
  { tag: "{{signatory_title}}", desc: "Title / designation of the client signatory" },
  { tag: "{{candidate_name}}", desc: "Full name of the placed candidate" },
  { tag: "{{candidate_role}}", desc: "Job title / role of the candidate" },
  { tag: "{{contract_date}}", desc: "Date of contract execution" },
  { tag: "{{start_date}}", desc: "Contract / placement start date" },
  { tag: "{{end_date}}", desc: "Contract end date (leave blank if open-ended)" },
  { tag: "{{margin_per_hour}}", desc: "Agency margin per hour (e.g. 15.00)" },
  { tag: "{{payment_terms_days}}", desc: "Net payment days (e.g. 30 for Net 30)" },
  { tag: "{{billing_frequency}}", desc: "Weekly / Bi-Weekly / Monthly / Milestone" },
  { tag: "{{agency_name}}", desc: "Staffing agency name (pre-filled)" },
  { tag: "{{notice_period_days}}", desc: "Number of days' notice for termination" },
];

export default function ContractTemplates({ canManage }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: templates = [], isLoading } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contracts/templates"],
  });

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
      const res = await fetch("/api/contracts/templates", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/contracts/templates"] });
      toast({ title: "Template uploaded", description: "Placeholders auto-detected from the document." });
      setShowUpload(false);
      setFile(null); setName(""); setDescription("");
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      {/* Authoring Guide Banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-900 text-sm">How to author a contract template</p>
              <p className="text-blue-700 text-sm mt-1">
                Write your contract in Microsoft Word (.docx). Anywhere you want dynamic data merged in, insert a placeholder in{" "}
                <code className="bg-blue-100 px-1 rounded font-mono text-blue-900 text-xs">{"{{double_curly_braces}}"}</code>{" "}
                notation using <strong>snake_case</strong> (e.g. <code className="bg-blue-100 px-1 rounded font-mono text-blue-900 text-xs">{"{{client_name}}"}</code>).
                Both lowercase and UPPERCASE are accepted. When you upload the template the system auto-detects all placeholders.
              </p>
              <Button variant="link" className="text-blue-700 p-0 h-auto text-sm mt-1" onClick={() => setShowGuide(true)} data-testid="button-view-guide">
                <BookOpen className="h-3.5 w-3.5 mr-1" /> View full placeholder reference →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <div />
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/contracts/sample-template" download="Staffing_Services_Agreement_Sample.docx" data-testid="button-download-sample">
              <Download className="h-4 w-4 mr-2" /> Download Sample Template
            </a>
          </Button>
          {canManage && (
            <Button onClick={() => setShowUpload(true)} data-testid="button-upload-template">
              <Plus className="h-4 w-4 mr-2" /> Upload Template
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No templates uploaded yet</p>
          <p className="text-sm mt-1">
            Create a Word document with <code className="bg-muted px-1 rounded font-mono text-xs">{"{{placeholder}}"}</code> tags, then upload it here.
          </p>
          <Button variant="link" className="mt-2" onClick={() => setShowGuide(true)}>View placeholder reference</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {templates.map(t => (
            <div key={t.id} className="border rounded-lg p-4 flex items-start gap-4" data-testid={`card-template-${t.id}`}>
              <FileText className="h-8 w-8 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{t.name}</p>
                    {t.description && <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">Used {t.usageCount}×</Badge>
                </div>
                {Array.isArray(t.placeholderList) && t.placeholderList.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(t.placeholderList as string[]).slice(0, 10).map(p => (
                      <Badge key={p} variant="outline" className="text-xs font-mono">
                        <Tag className="h-3 w-3 mr-1" />{`{{${p}}}`}
                      </Badge>
                    ))}
                    {(t.placeholderList as string[]).length > 10 && (
                      <Badge variant="outline" className="text-xs">+{(t.placeholderList as string[]).length - 10} more</Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1 italic">No placeholders detected — template uses static text only</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Uploaded {new Date(t.createdAt!).toLocaleDateString()}
                </p>
              </div>
              {canManage && (
                <Button
                  variant="ghost" size="sm" className="text-red-600 hover:text-red-700 shrink-0"
                  onClick={() => deleteMutation.mutate(t.id)}
                  data-testid={`button-delete-template-${t.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Placeholder Reference Guide Dialog */}
      {showGuide && (
        <Dialog open onOpenChange={() => setShowGuide(false)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Template Placeholder Reference
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <p className="font-semibold">Syntax Rules</p>
                <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
                  <li>Wrap placeholders in double curly braces: <code className="bg-white border px-1 rounded font-mono text-slate-800">{"{{client_name}}"}</code></li>
                  <li>Use snake_case (all lowercase, words separated by underscores)</li>
                  <li>Only alphanumeric characters and underscores allowed</li>
                  <li>No spaces inside the braces</li>
                  <li>Both <code className="bg-white border px-1 rounded font-mono text-slate-800">{"{{client_name}}"}</code> and <code className="bg-white border px-1 rounded font-mono text-slate-800">{"{{CLIENT_NAME}}"}</code> are accepted</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold mb-2">Common Placeholders</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Placeholder</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {COMMON_PLACEHOLDERS.map(p => (
                        <tr key={p.tag} className="hover:bg-muted/20">
                          <td className="px-3 py-2">
                            <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">{p.tag}</code>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{p.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  You can add any custom placeholder not listed here — the system will auto-detect it and ask you to fill in the value when generating a contract.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="font-semibold text-amber-800 text-xs mb-1">Example snippet from a Word document:</p>
                <p className="font-mono text-xs text-amber-900 whitespace-pre">{`This Agreement is entered into as of {{contract_date}} between {{client_name}},\nlocated at {{client_address}}, and Rayomind Solutions LLP ("Agency").`}</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowGuide(false)}>Got it</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Upload Dialog */}
      {showUpload && (
        <Dialog open onOpenChange={() => { setShowUpload(false); setFile(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Contract Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
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
                    <p className="text-xs text-muted-foreground mt-1">Use <code>{"{{placeholder}}"}</code> in your Word document</p>
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
              <Button variant="link" className="p-0 h-auto text-xs" onClick={() => setShowGuide(true)}>
                <BookOpen className="h-3 w-3 mr-1" /> View placeholder reference
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
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
