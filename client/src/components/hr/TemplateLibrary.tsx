import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LayoutTemplate, Plus, Eye, Copy, Pencil, Archive, Star, Search,
  Filter, ChevronDown, ChevronUp, Loader2, BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TEMPLATE_LABELS, PERFORMANCE_BANDS, CONDUCT_BANDS, COMPLETION_BANDS, CLOSING_LINES } from "@shared/hrLetterConstants";
import { LetterPreview } from "./LetterPreview";

const ALL_LETTER_TYPES = [
  { value: "experience", label: "Experience Letter" },
  { value: "relieving", label: "Relieving Letter" },
  { value: "internship_completion", label: "Internship Completion" },
  { value: "internship_certificate", label: "Internship Certificate" },
  { value: "salary_revision", label: "Salary Revision" },
  { value: "role_change", label: "Designation / Promotion" },
  { value: "combined", label: "Salary + Designation (Combined)" },
  { value: "device_allocation", label: "Device Allocation" },
  { value: "offer_letter", label: "Offer Letter" },
];

const AMENDMENT_TYPES = new Set(["salary_revision", "role_change", "combined", "device_allocation"]);

interface LetterTemplate {
  id: number;
  name: string;
  description: string | null;
  letter_type: string;
  template_data: Record<string, unknown>;
  is_system: boolean;
  is_active: boolean;
  created_by: string | null;
  first_name: string | null;
  last_name: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface TemplateEditorState {
  name: string;
  description: string;
  letterType: string;
  performanceBand: string;
  conductBand: string;
  completionBand: string;
  closingLine: string;
  signatoryDesignation: string;
  defaultSignatoryName: string;
  customIntroText: string;
  customBodyText: string;
}

const emptyEditor = (): TemplateEditorState => ({
  name: "",
  description: "",
  letterType: "experience",
  performanceBand: "good",
  conductBand: "good",
  completionBand: "successfully_completed",
  closingLine: "wish_success",
  signatoryDesignation: "HR Manager",
  defaultSignatoryName: "",
  customIntroText: "",
  customBodyText: "",
});

function buildTemplateData(state: TemplateEditorState): Record<string, unknown> {
  const data: Record<string, unknown> = {
    closingLine: state.closingLine,
    signatoryDesignation: state.signatoryDesignation,
  };
  if (state.performanceBand) data.performanceBand = state.performanceBand;
  if (state.conductBand) data.conductBand = state.conductBand;
  if (state.completionBand) data.completionBand = state.completionBand;
  if (state.defaultSignatoryName.trim()) data.defaultSignatoryName = state.defaultSignatoryName.trim();
  if (state.customIntroText.trim()) data.customIntroText = state.customIntroText.trim();
  if (state.customBodyText.trim()) data.customBodyText = state.customBodyText.trim();
  return data;
}

function TypeBadge({ type }: { type: string }) {
  const label = (TEMPLATE_LABELS as Record<string, string>)[type] || type;
  const isAmendment = AMENDMENT_TYPES.has(type);
  return (
    <Badge variant="outline" className={`text-xs ${isAmendment ? "border-orange-300 text-orange-700 bg-orange-50" : "border-blue-300 text-blue-700 bg-blue-50"}`}>
      {label}
    </Badge>
  );
}

function SystemBadge({ isSystem }: { isSystem: boolean }) {
  if (isSystem) {
    return (
      <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200">
        <Star className="h-3 w-3" /> System
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      Custom
    </Badge>
  );
}

// Fetches backend preview-data and renders a structured preview for any letter type
function TemplatePreviewContent({ template }: { template: LetterTemplate }) {
  const [data, setData] = useState<{ preview_fields: Record<string, string>; is_amendment: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    fetch(`/api/hr/templates/${template.id}/preview-data`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [template.id]);

  if (loading) return <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading preview…</div>;
  if (!data) return <div className="mt-4 text-sm text-muted-foreground">Preview not available.</div>;

  const { preview_fields: pf, is_amendment } = data;

  if (!is_amendment) {
    // Use existing LetterPreview with backend-sourced fields
    const previewLetter = {
      templateType: template.letter_type,
      employeeName: pf.employeeName || "[Employee Name]",
      designation: pf.designation || "[Designation]",
      department: pf.department || "[Department]",
      startDate: "2024-01-01",
      endDate: "2025-01-01",
      performanceBand: pf.performanceBand || null,
      conductBand: pf.conductBand || null,
      completionBand: pf.completionBand || null,
      closingLine: pf.closingLine || "wish_success",
      signatoryName: pf.signatoryName || "[Signatory Name]",
      signatoryDesignation: pf.signatoryDesignation || "HR Manager",
    };
    return <div className="mt-4"><LetterPreview letter={previewLetter} /></div>;
  }

  // Amendment: show structured placeholder-field breakdown
  const FIELD_LABELS: Record<string, string> = {
    signatoryDesignation: "Signatory Designation",
    signatoryName: "Signatory Name",
    effectiveDate: "Effective Date",
    previousSalary: "Previous CTC",
    newSalary: "Revised CTC",
    previousDesignation: "Previous Designation",
    newDesignation: "New Designation",
    customIntroText: "Custom Intro Text",
    customBodyText: "Custom Body / Notes",
  };
  const displayFields = Object.entries(pf).filter(([k]) => k !== "employeeName" && k !== "employeeCode" && k !== "designation" && k !== "department" && k !== "startDate" && k !== "endDate");

  return (
    <div className="mt-4 space-y-3">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        Amendment letters are generated as DOCX files. This shows the default field values this template will pre-fill.
      </div>
      <div className="divide-y border rounded-lg overflow-hidden">
        {displayFields.map(([key, value]) => (
          <div key={key} className="flex items-start gap-3 px-3 py-2 text-sm">
            <span className="text-muted-foreground min-w-[160px] shrink-0">{FIELD_LABELS[key] || key}</span>
            <span className="font-medium text-foreground">{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TemplateLibraryProps {
  onUseTemplate?: (id: number, letterType: string) => void;
}

export function TemplateLibrary({ onUseTemplate }: TemplateLibraryProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = ["super_admin", "admin", "hr"].includes(user?.role || "");

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSystem, setFilterSystem] = useState("all");
  const [previewTemplate, setPreviewTemplate] = useState<LetterTemplate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LetterTemplate | null>(null);
  const [editorState, setEditorState] = useState<TemplateEditorState>(emptyEditor());
  const [archiveConfirm, setArchiveConfirm] = useState<LetterTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<LetterTemplate[]>({
    queryKey: ["/api/hr/templates"],
    queryFn: async () => {
      const res = await fetch("/api/hr/templates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; description: string; letterType: string; templateData: Record<string, unknown> }) => {
      const res = await apiRequest("POST", "/api/hr/templates", payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create template");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/templates"] });
      setEditorOpen(false);
      setEditingTemplate(null);
      setEditorState(emptyEditor());
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/hr/templates/${id}`, payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update template");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/templates"] });
      setEditorOpen(false);
      setEditingTemplate(null);
      setEditorState(emptyEditor());
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/hr/templates/${id}/duplicate`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to duplicate template");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template duplicated" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/templates"] });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/hr/templates/${id}/archive`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to archive template");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template archived" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/templates"] });
      setArchiveConfirm(null);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setEditorState(emptyEditor());
    setEditorOpen(true);
  };

  const handleOpenEdit = (tpl: LetterTemplate) => {
    setEditingTemplate(tpl);
    const td = tpl.template_data || {};
    setEditorState({
      name: tpl.name,
      description: tpl.description || "",
      letterType: tpl.letter_type,
      performanceBand: (td.performanceBand as string) || "",
      conductBand: (td.conductBand as string) || "",
      completionBand: (td.completionBand as string) || "",
      closingLine: (td.closingLine as string) || "wish_success",
      signatoryDesignation: (td.signatoryDesignation as string) || "HR Manager",
      defaultSignatoryName: (td.defaultSignatoryName as string) || "",
      customIntroText: (td.customIntroText as string) || "",
      customBodyText: (td.customBodyText as string) || "",
    });
    setEditorOpen(true);
  };

  const handleSave = () => {
    if (!editorState.name.trim()) {
      toast({ title: "Template name is required", variant: "destructive" });
      return;
    }
    const templateData = buildTemplateData(editorState);
    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        payload: { name: editorState.name, description: editorState.description, templateData },
      });
    } else {
      createMutation.mutate({ name: editorState.name, description: editorState.description, letterType: editorState.letterType, templateData });
    }
  };

  const filtered = templates.filter((t) => {
    if (filterType !== "all" && t.letter_type !== filterType) return false;
    if (filterSystem === "system" && !t.is_system) return false;
    if (filterSystem === "custom" && t.is_system) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = ALL_LETTER_TYPES.reduce<Record<string, LetterTemplate[]>>((acc, lt) => {
    const items = filtered.filter((t) => t.letter_type === lt.value);
    if (items.length > 0) acc[lt.value] = items;
    return acc;
  }, {});

  function buildPreviewLetter(tpl: LetterTemplate) {
    const td = tpl.template_data || {};
    return {
      templateType: tpl.letter_type,
      employeeName: "[Employee Name]",
      designation: "[Designation]",
      department: "[Department]",
      startDate: "2024-01-01",
      endDate: "2025-01-01",
      performanceBand: (td.performanceBand as string) || null,
      conductBand: (td.conductBand as string) || null,
      completionBand: (td.completionBand as string) || null,
      closingLine: (td.closingLine as string) || "wish_success",
      signatoryName: "[Signatory Name]",
      signatoryDesignation: (td.signatoryDesignation as string) || "HR Manager",
    };
  }

  const isAmendmentType = AMENDMENT_TYPES.has(editorState.letterType);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-primary" />
            Letter Template Library
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reusable starting points for every letter type. System templates are read-only — duplicate to customise.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={handleOpenCreate} data-testid="button-new-template">
            <Plus className="h-4 w-4 mr-1.5" /> New Template
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="pl-8"
            data-testid="input-template-search"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44" data-testid="select-filter-type">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ALL_LETTER_TYPES.map((lt) => (
              <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSystem} onValueChange={setFilterSystem}>
          <SelectTrigger className="w-36" data-testid="select-filter-system">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All templates</SelectItem>
            <SelectItem value="system">System only</SelectItem>
            <SelectItem value="custom">Custom only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No templates match your filters.</p>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first template
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => {
            const typeLabel = (TEMPLATE_LABELS as Record<string, string>)[type] || type;
            return (
              <div key={type}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <TypeBadge type={type} />
                  <span>{typeLabel}</span>
                  <span className="text-xs text-muted-foreground/60">({items.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      template={tpl}
                      canEdit={canEdit}
                      onPreview={() => setPreviewTemplate(tpl)}
                      onEdit={() => handleOpenEdit(tpl)}
                      onDuplicate={() => duplicateMutation.mutate(tpl.id)}
                      onArchive={() => setArchiveConfirm(tpl)}
                      onUse={onUseTemplate ? () => onUseTemplate(tpl.id, tpl.letter_type) : undefined}
                      isDuplicating={duplicateMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Sheet */}
      <Sheet open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Template Preview
            </SheetTitle>
            <SheetDescription>
              {previewTemplate?.name}
              {previewTemplate && <span className="ml-2"><SystemBadge isSystem={previewTemplate.is_system} /></span>}
            </SheetDescription>
          </SheetHeader>
          {previewTemplate && <TemplatePreviewContent template={previewTemplate} />}
        </SheetContent>
      </Sheet>

      {/* Template Editor Sheet */}
      <Sheet open={editorOpen} onOpenChange={(open) => { if (!open) { setEditorOpen(false); setEditingTemplate(null); setEditorState(emptyEditor()); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingTemplate ? "Edit Template" : "New Template"}</SheetTitle>
            <SheetDescription>
              {editingTemplate ? "Update this custom template." : "Create a reusable template for the letter generator."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="tpl-name">Template Name *</Label>
              <Input
                id="tpl-name"
                value={editorState.name}
                onChange={(e) => setEditorState((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Senior Employee Experience Letter"
                data-testid="input-template-name"
              />
            </div>
            <div>
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                value={editorState.description}
                onChange={(e) => setEditorState((s) => ({ ...s, description: e.target.value }))}
                placeholder="When to use this template…"
                rows={2}
                data-testid="textarea-template-description"
              />
            </div>
            {!editingTemplate && (
              <div>
                <Label>Letter Type *</Label>
                <Select value={editorState.letterType} onValueChange={(v) => setEditorState((s) => ({ ...s, letterType: v }))}>
                  <SelectTrigger data-testid="select-template-letter-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_LETTER_TYPES.map((lt) => (
                      <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!isAmendmentType && (
              <>
                {["experience", "internship_completion"].includes(editorState.letterType) && (
                  <div>
                    <Label>Default Performance Band</Label>
                    <Select value={editorState.performanceBand} onValueChange={(v) => setEditorState((s) => ({ ...s, performanceBand: v }))}>
                      <SelectTrigger data-testid="select-template-performance-band">
                        <SelectValue placeholder="Select band…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {PERFORMANCE_BANDS.map((b) => (
                          <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {editorState.letterType === "experience" && (
                  <div>
                    <Label>Default Conduct Band</Label>
                    <Select value={editorState.conductBand} onValueChange={(v) => setEditorState((s) => ({ ...s, conductBand: v }))}>
                      <SelectTrigger data-testid="select-template-conduct-band">
                        <SelectValue placeholder="Select band…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {CONDUCT_BANDS.map((b) => (
                          <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {["internship_completion", "internship_certificate"].includes(editorState.letterType) && (
                  <div>
                    <Label>Default Completion Band</Label>
                    <Select value={editorState.completionBand} onValueChange={(v) => setEditorState((s) => ({ ...s, completionBand: v }))}>
                      <SelectTrigger data-testid="select-template-completion-band">
                        <SelectValue placeholder="Select band…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {COMPLETION_BANDS.map((b) => (
                          <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Default Closing Line</Label>
                  <Select value={editorState.closingLine} onValueChange={(v) => setEditorState((s) => ({ ...s, closingLine: v }))}>
                    <SelectTrigger data-testid="select-template-closing-line">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLOSING_LINES.map((cl) => (
                        <SelectItem key={cl.value} value={cl.value}>{cl.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <Label>Default Signatory Designation</Label>
              <Input
                value={editorState.signatoryDesignation}
                onChange={(e) => setEditorState((s) => ({ ...s, signatoryDesignation: e.target.value }))}
                placeholder="e.g. HR Manager"
                data-testid="input-template-signatory-designation"
              />
            </div>
            <div>
              <Label>Default Signatory Name</Label>
              <Input
                value={editorState.defaultSignatoryName}
                onChange={(e) => setEditorState((s) => ({ ...s, defaultSignatoryName: e.target.value }))}
                placeholder="e.g. Jane Smith (leave blank to leave blank)"
                data-testid="input-template-signatory-name"
              />
            </div>
            <div>
              <Label>Custom Intro Text <span className="text-muted-foreground font-normal">(optional override)</span></Label>
              <Textarea
                value={editorState.customIntroText}
                onChange={(e) => setEditorState((s) => ({ ...s, customIntroText: e.target.value }))}
                placeholder="Opening paragraph to pre-fill in the letter…"
                rows={3}
                data-testid="textarea-template-intro-text"
              />
            </div>
            <div>
              <Label>Custom Body / Notes <span className="text-muted-foreground font-normal">(optional override)</span></Label>
              <Textarea
                value={editorState.customBodyText}
                onChange={(e) => setEditorState((s) => ({ ...s, customBodyText: e.target.value }))}
                placeholder="Additional body text or notes to pre-fill…"
                rows={3}
                data-testid="textarea-template-body-text"
              />
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-template">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingTemplate ? "Update Template" : "Save Template"}
            </Button>
            <Button variant="outline" onClick={() => { setEditorOpen(false); setEditingTemplate(null); setEditorState(emptyEditor()); }}>
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Archive Confirm Dialog */}
      <Dialog open={!!archiveConfirm} onOpenChange={(open) => { if (!open) setArchiveConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Template?</DialogTitle>
            <DialogDescription>
              "{archiveConfirm?.name}" will be hidden from the library. Existing letters created from this template are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={archiveMutation.isPending}
              onClick={() => archiveConfirm && archiveMutation.mutate(archiveConfirm.id)}
              data-testid="button-confirm-archive"
            >
              {archiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TemplateCardProps {
  template: LetterTemplate;
  canEdit: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onUse?: () => void;
  isDuplicating: boolean;
}

function TemplateCard({ template: tpl, canEdit, onPreview, onEdit, onDuplicate, onArchive, onUse, isDuplicating }: TemplateCardProps) {
  const [showActions, setShowActions] = useState(false);
  const createdByName = tpl.first_name ? `${tpl.first_name} ${tpl.last_name ?? ""}`.trim() : null;

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col" data-testid={`card-template-${tpl.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium leading-snug">{tpl.name}</CardTitle>
          <SystemBadge isSystem={tpl.is_system} />
        </div>
        {tpl.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{tpl.description}</p>
        )}
      </CardHeader>
      <CardContent className="pt-0 flex flex-col flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <TypeBadge type={tpl.letter_type} />
          <span className="text-xs text-muted-foreground">Used {tpl.usage_count} time{tpl.usage_count !== 1 ? "s" : ""}</span>
        </div>
        {createdByName && !tpl.is_system && (
          <p className="text-xs text-muted-foreground mb-2">By {createdByName}</p>
        )}

        {/* Primary action — always visible */}
        {onUse && (
          <Button
            size="sm"
            className="w-full mb-2"
            onClick={onUse}
            data-testid={`button-use-template-${tpl.id}`}
          >
            <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" /> Use this template
          </Button>
        )}

        <div className={`space-y-1 ${showActions ? "" : "hidden"}`} data-testid={`actions-template-${tpl.id}`}>
          <Button size="sm" variant="outline" className="w-full justify-start text-xs" onClick={onPreview} data-testid={`button-preview-${tpl.id}`}>
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
          </Button>
          {canEdit && (
            <Button size="sm" variant="outline" className="w-full justify-start text-xs" onClick={onDuplicate} disabled={isDuplicating} data-testid={`button-duplicate-${tpl.id}`}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Duplicate
            </Button>
          )}
          {canEdit && !tpl.is_system && (
            <>
              <Button size="sm" variant="outline" className="w-full justify-start text-xs" onClick={onEdit} data-testid={`button-edit-${tpl.id}`}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
              <Button size="sm" variant="ghost" className="w-full justify-start text-xs text-destructive hover:text-destructive" onClick={onArchive} data-testid={`button-archive-${tpl.id}`}>
                <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
              </Button>
            </>
          )}
        </div>

        <button
          className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
          onClick={() => setShowActions((v) => !v)}
          data-testid={`button-toggle-actions-${tpl.id}`}
        >
          {showActions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showActions ? "Hide actions" : "Actions"}
        </button>
      </CardContent>
    </Card>
  );
}
