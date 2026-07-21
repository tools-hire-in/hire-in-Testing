import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertTriangle,
  Download,
  GripVertical,
  Info,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { StepCard, type OnboardingStep } from "@/components/onboarding/StepCard";
import type { KCItem } from "@/components/onboarding/KnowledgeCheck";
import { cn } from "@/lib/utils";

// ── Track config ──────────────────────────────────────────────────────────────

const TRACKS = [
  { id: "employee", label: "Employee" },
  { id: "manager", label: "Manager" },
  { id: "hr", label: "HR / Admin" },
  { id: "executive", label: "Executive" },
  { id: "admin", label: "Admin / Super Admin" },
] as const;

type TrackId = (typeof TRACKS)[number]["id"];

// ── Form state ────────────────────────────────────────────────────────────────

interface StepFormState {
  title: string;
  purpose: string;
  whereToFind: string;
  navRoute: string;
  howToUse: string;
  importantRules: string[];
  isHighRisk: boolean;
  commonMistake: string;
  scenario: string;
  practicalExercise: string;
  knowledgeCheck: KCItem[];
  whereToGetHelp: string;
}

const EMPTY_FORM: StepFormState = {
  title: "",
  purpose: "",
  whereToFind: "",
  navRoute: "",
  howToUse: "",
  importantRules: [],
  isHighRisk: false,
  commonMistake: "",
  scenario: "",
  practicalExercise: "",
  knowledgeCheck: [],
  whereToGetHelp: "",
};

function formToPreviewStep(form: StepFormState, track: TrackId, stepNumber = 1): OnboardingStep {
  return {
    id: "preview",
    track,
    stepNumber,
    title: form.title || "Step title will appear here",
    purpose: form.purpose || null,
    whereToFind: form.whereToFind || null,
    navRoute: form.navRoute || null,
    howToUse: form.howToUse || null,
    importantRules: form.importantRules.length > 0 ? form.importantRules : null,
    isHighRisk: form.isHighRisk,
    commonMistake: form.isHighRisk ? form.commonMistake || null : null,
    scenario: form.isHighRisk ? form.scenario || null : null,
    practicalExercise: form.isHighRisk ? form.practicalExercise || null : null,
    knowledgeCheck: form.knowledgeCheck.length > 0 ? form.knowledgeCheck : null,
    whereToGetHelp: form.whereToGetHelp || null,
    isActive: true,
  };
}

// ── Sortable step row ─────────────────────────────────────────────────────────

interface SortableStepRowProps {
  step: OnboardingStep;
  onEdit: (step: OnboardingStep) => void;
  onToggleActive: (step: OnboardingStep) => void;
  onDelete: (step: OnboardingStep) => void;
  isToggling: boolean;
  isDeleting: boolean;
}

function SortableStepRow({
  step,
  onEdit,
  onToggleActive,
  onDelete,
  isToggling,
  isDeleting,
}: SortableStepRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card",
        isDragging && "shadow-lg",
      )}
      data-testid={`step-row-${step.id}`}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 flex-shrink-0"
        {...attributes}
        {...listeners}
        data-testid={`drag-handle-${step.id}`}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="text-xs text-muted-foreground w-6 text-right flex-shrink-0">
        {step.stepNumber}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate" data-testid={`text-step-title-${step.id}`}>
            {step.title}
          </span>
          {step.isHighRisk && (
            <Badge className="bg-red-600 hover:bg-red-700 text-white text-[10px] gap-1 shrink-0" data-testid={`badge-high-risk-${step.id}`}>
              <AlertTriangle className="h-2.5 w-2.5" />
              HIGH RISK
            </Badge>
          )}
          <Badge
            variant={step.isActive ? "default" : "secondary"}
            className="text-[10px] shrink-0"
            data-testid={`badge-active-${step.id}`}
          >
            {step.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(step)}
          data-testid={`button-edit-step-${step.id}`}
          aria-label="Edit step"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", step.isActive ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700")}
          onClick={() => onToggleActive(step)}
          disabled={isToggling}
          data-testid={`button-toggle-step-${step.id}`}
          aria-label={step.isActive ? "Disable step" : "Enable step"}
          title={step.isActive ? "Disable" : "Enable"}
        >
          {step.isActive ? "⏸" : "▶"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(step)}
          disabled={isDeleting}
          data-testid={`button-delete-step-${step.id}`}
          aria-label="Delete step"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Step form (Add / Edit) ────────────────────────────────────────────────────

interface StepFormProps {
  form: StepFormState;
  onChange: (updated: StepFormState) => void;
}

function StepForm({ form, onChange }: StepFormProps) {
  const set = <K extends keyof StepFormState>(key: K, val: StepFormState[K]) =>
    onChange({ ...form, [key]: val });

  const addRule = () => set("importantRules", [...form.importantRules, ""]);
  const updateRule = (i: number, val: string) => {
    const next = [...form.importantRules];
    next[i] = val;
    set("importantRules", next);
  };
  const removeRule = (i: number) => set("importantRules", form.importantRules.filter((_, idx) => idx !== i));

  const addKC = () => set("knowledgeCheck", [...form.knowledgeCheck, { question: "", answer: "" }]);
  const updateKC = (i: number, field: "question" | "answer", val: string) => {
    const next = [...form.knowledgeCheck];
    next[i] = { ...next[i], [field]: val };
    set("knowledgeCheck", next);
  };
  const removeKC = (i: number) => set("knowledgeCheck", form.knowledgeCheck.filter((_, idx) => idx !== i));

  const navRouteError = form.navRoute && !form.navRoute.startsWith("/admin")
    ? "Nav route must start with /admin"
    : null;

  return (
    <div className="space-y-5 text-sm">
      <div className="space-y-1.5">
        <Label htmlFor="step-title">Title <span className="text-destructive">*</span></Label>
        <Input
          id="step-title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Logging In and Setting Up 2FA"
          data-testid="input-step-title"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="step-purpose">Purpose <span className="text-destructive">*</span></Label>
        <Textarea
          id="step-purpose"
          value={form.purpose}
          onChange={(e) => set("purpose", e.target.value)}
          rows={2}
          placeholder="What will the user learn or be able to do?"
          data-testid="input-step-purpose"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="step-where-to-find">Where to Find It</Label>
          <Input
            id="step-where-to-find"
            value={form.whereToFind}
            onChange={(e) => set("whereToFind", e.target.value)}
            placeholder="e.g. My Desk → Time Card"
            data-testid="input-step-where-to-find"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="step-nav-route">Nav Route</Label>
          <Input
            id="step-nav-route"
            value={form.navRoute}
            onChange={(e) => set("navRoute", e.target.value)}
            placeholder="/admin/my-desk"
            className={navRouteError ? "border-destructive" : ""}
            data-testid="input-step-nav-route"
          />
          {navRouteError && (
            <p className="text-xs text-destructive" data-testid="text-nav-route-error">{navRouteError}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="step-how-to-use">How to Use It</Label>
        <p className="text-xs text-muted-foreground">Supports Markdown: **bold**, # headings, bullet lists</p>
        <Textarea
          id="step-how-to-use"
          value={form.howToUse}
          onChange={(e) => set("howToUse", e.target.value)}
          rows={4}
          placeholder="Step-by-step instructions…"
          className="font-mono text-xs"
          data-testid="input-step-how-to-use"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Important Rules</Label>
          <Button type="button" size="sm" variant="outline" onClick={addRule} data-testid="button-add-rule">
            <Plus className="h-3 w-3 mr-1" />
            Add rule
          </Button>
        </div>
        {form.importantRules.map((rule, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={rule}
              onChange={(e) => updateRule(i, e.target.value)}
              placeholder={`Rule ${i + 1}`}
              data-testid={`input-rule-${i}`}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeRule(i)} data-testid={`button-remove-rule-${i}`}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">High Risk Step</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Shows a red badge and reveals extra fields</p>
          </div>
          <Switch
            checked={form.isHighRisk}
            onCheckedChange={(v) => set("isHighRisk", v)}
            data-testid="switch-is-high-risk"
          />
        </div>

        {form.isHighRisk && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="step-common-mistake">Common Mistake</Label>
              <Textarea
                id="step-common-mistake"
                value={form.commonMistake}
                onChange={(e) => set("commonMistake", e.target.value)}
                rows={2}
                placeholder="What do people typically get wrong here?"
                data-testid="input-step-common-mistake"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="step-scenario">Scenario</Label>
              <p className="text-xs text-muted-foreground">Supports Markdown</p>
              <Textarea
                id="step-scenario"
                value={form.scenario}
                onChange={(e) => set("scenario", e.target.value)}
                rows={3}
                placeholder="A real-world example or case study…"
                className="font-mono text-xs"
                data-testid="input-step-scenario"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="step-practical-exercise">Practical Exercise</Label>
              <p className="text-xs text-muted-foreground">Supports Markdown. Users must scroll past this before confirming.</p>
              <Textarea
                id="step-practical-exercise"
                value={form.practicalExercise}
                onChange={(e) => set("practicalExercise", e.target.value)}
                rows={3}
                placeholder="A hands-on task the user should complete…"
                className="font-mono text-xs"
                data-testid="input-step-practical-exercise"
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Knowledge Check Questions</Label>
          <Button type="button" size="sm" variant="outline" onClick={addKC} data-testid="button-add-kc">
            <Plus className="h-3 w-3 mr-1" />
            Add Q&amp;A
          </Button>
        </div>
        {form.knowledgeCheck.map((item, i) => (
          <div key={i} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Question {i + 1}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeKC(i)} data-testid={`button-remove-kc-${i}`}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
            <Input
              value={item.question}
              onChange={(e) => updateKC(i, "question", e.target.value)}
              placeholder="Question…"
              data-testid={`input-kc-question-${i}`}
            />
            <Input
              value={item.answer}
              onChange={(e) => updateKC(i, "answer", e.target.value)}
              placeholder="Answer…"
              data-testid={`input-kc-answer-${i}`}
            />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="step-where-to-get-help">Where to Get Help</Label>
        <Textarea
          id="step-where-to-get-help"
          value={form.whereToGetHelp}
          onChange={(e) => set("whereToGetHelp", e.target.value)}
          rows={2}
          placeholder="Contact HR, raise a ticket at…"
          data-testid="input-step-where-to-get-help"
        />
      </div>
    </div>
  );
}

// ── Main manager ──────────────────────────────────────────────────────────────

export function OnboardingStepsManager() {
  const { toast } = useToast();
  const [activeTrack, setActiveTrack] = useState<TrackId>("employee");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<OnboardingStep | null>(null);
  const [form, setForm] = useState<StepFormState>(EMPTY_FORM);
  const [showPreview, setShowPreview] = useState(true);
  const [localSteps, setLocalSteps] = useState<OnboardingStep[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { data: fetchedSteps, isLoading } = useQuery<OnboardingStep[]>({
    queryKey: ["/api/onboarding/steps", { track: activeTrack }],
  });

  const steps = localSteps ?? fetchedSteps ?? [];

  const invalidate = useCallback(() => {
    setLocalSteps(null);
    queryClient.invalidateQueries({ queryKey: ["/api/onboarding/steps", { track: activeTrack }] });
  }, [activeTrack]);

  const createMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/onboarding/steps", body),
    onSuccess: () => { invalidate(); setSheetOpen(false); toast({ title: "Step created" }); },
    onError: (err: Error) => toast({ title: "Failed to create step", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => apiRequest("PATCH", `/api/onboarding/steps/${id}`, body),
    onSuccess: () => { invalidate(); setSheetOpen(false); toast({ title: "Step updated" }); },
    onError: (err: Error) => toast({ title: "Failed to update step", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/onboarding/steps/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Step deleted" }); },
    onError: (err: Error) => toast({ title: "Failed to delete step", description: err.message, variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => apiRequest("POST", "/api/onboarding/steps/reorder", { orderedIds }),
    onError: (err: Error) => { invalidate(); toast({ title: "Reorder failed", description: err.message, variant: "destructive" }); },
  });

  const openAddSheet = () => {
    setEditingStep(null);
    setForm(EMPTY_FORM);
    setSheetOpen(true);
  };

  const openEditSheet = (step: OnboardingStep) => {
    setEditingStep(step);
    setForm({
      title: step.title,
      purpose: step.purpose ?? "",
      whereToFind: step.whereToFind ?? "",
      navRoute: step.navRoute ?? "",
      howToUse: step.howToUse ?? "",
      importantRules: Array.isArray(step.importantRules) ? (step.importantRules as string[]) : [],
      isHighRisk: step.isHighRisk ?? false,
      commonMistake: step.commonMistake ?? "",
      scenario: step.scenario ?? "",
      practicalExercise: step.practicalExercise ?? "",
      knowledgeCheck: Array.isArray(step.knowledgeCheck) ? (step.knowledgeCheck as KCItem[]) : [],
      whereToGetHelp: step.whereToGetHelp ?? "",
    });
    setSheetOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!form.purpose.trim()) {
      toast({ title: "Purpose is required", variant: "destructive" });
      return;
    }
    if (form.navRoute && !form.navRoute.startsWith("/admin")) {
      toast({ title: "Nav route must start with /admin", variant: "destructive" });
      return;
    }

    const body = {
      track: activeTrack,
      stepNumber: editingStep?.stepNumber ?? (steps.length + 1),
      title: form.title.trim(),
      purpose: form.purpose.trim() || null,
      whereToFind: form.whereToFind.trim() || null,
      navRoute: form.navRoute.trim() || null,
      howToUse: form.howToUse.trim() || null,
      importantRules: form.importantRules.filter(Boolean),
      isHighRisk: form.isHighRisk,
      commonMistake: form.isHighRisk ? form.commonMistake.trim() || null : null,
      scenario: form.isHighRisk ? form.scenario.trim() || null : null,
      practicalExercise: form.isHighRisk ? form.practicalExercise.trim() || null : null,
      knowledgeCheck: form.knowledgeCheck.filter((kc) => kc.question.trim() && kc.answer.trim()),
      whereToGetHelp: form.whereToGetHelp.trim() || null,
    };

    if (editingStep) {
      updateMutation.mutate({ id: editingStep.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const handleToggleActive = (step: OnboardingStep) => {
    updateMutation.mutate({ id: step.id, body: { isActive: !step.isActive } });
  };

  const handleDelete = (step: OnboardingStep) => {
    if (!window.confirm(`Delete step "${step.title}"? This cannot be undone.`)) return;
    deleteMutation.mutate(step.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const current = localSteps ?? fetchedSteps ?? [];
    const oldIndex = current.findIndex((s) => s.id === active.id);
    const newIndex = current.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(current, oldIndex, newIndex).map((s, i) => ({
      ...s,
      stepNumber: i + 1,
    }));
    setLocalSteps(reordered);
    reorderMutation.mutate(reordered.map((s) => s.id));
  };

  const handleDownloadPdf = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    const a = document.createElement("a");
    a.href = `/api/onboarding/steps/export?track=${activeTrack}&format=pdf`;
    a.download = `${activeTrack}-onboarding-guide-${dateStr}.pdf`;
    a.click();
  };

  const previewStep = formToPreviewStep(form, activeTrack, editingStep?.stepNumber ?? (steps.length + 1));
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-5" data-testid="onboarding-steps-manager">
      {/* Track tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1" data-testid="tabs-tracks">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTrack(t.id); setLocalSteps(null); }}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                activeTrack === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`tab-track-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} data-testid="button-download-pdf">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download Guide as PDF
          </Button>
          <Button size="sm" onClick={openAddSheet} data-testid="button-add-step">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Step
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-md bg-muted/40 border px-3 py-2" data-testid="text-pdf-note">
        <Info className="h-3.5 w-3.5 shrink-0" />
        This PDF is always generated from the current live content. Re-download after any updates.
      </div>

      {/* Step list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm font-semibold">
            {TRACKS.find((t) => t.id === activeTrack)?.label} Track Steps
            {!isLoading && (
              <span className="ml-1.5 text-muted-foreground font-normal">({steps.length})</span>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">Drag rows to reorder</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)
          ) : steps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No steps configured for this track yet.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={openAddSheet} data-testid="button-add-step-empty">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add the first step
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {steps.map((step) => (
                  <SortableStepRow
                    key={step.id}
                    step={step}
                    onEdit={openEditSheet}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                    isToggling={updateMutation.isPending}
                    isDeleting={deleteMutation.isPending}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[92vw] lg:max-w-[78vw] xl:max-w-[72vw] p-0 flex flex-col"
          data-testid="sheet-step-form"
        >
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle>{editingStep ? "Edit Step" : "Add New Step"}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Form panel */}
            <div className="flex-1 overflow-y-auto px-6 py-5" data-testid="panel-form">
              <StepForm form={form} onChange={setForm} />

              <div className="flex gap-2 mt-6 pt-4 border-t">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  data-testid="button-save-step"
                >
                  {isSaving ? "Saving…" : editingStep ? "Save Changes" : "Create Step"}
                </Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)} data-testid="button-cancel-step">
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  className="ml-auto text-xs text-muted-foreground"
                  onClick={() => setShowPreview((p) => !p)}
                  data-testid="button-toggle-preview"
                >
                  {showPreview ? "Hide Preview" : "Show Preview"}
                </Button>
              </div>
            </div>

            {/* Live preview panel */}
            {showPreview && (
              <div className="w-[400px] shrink-0 border-l flex flex-col bg-muted/30" data-testid="panel-preview">
                <div className="px-4 py-3 border-b bg-background shrink-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Preview — this is how your step will appear
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <StepCard
                    step={previewStep}
                    stepIndex={0}
                    totalSteps={1}
                    track={activeTrack}
                    onConfirm={() => {}}
                    isSubmitting={false}
                  />
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
