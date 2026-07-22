/**
 * Payroll Settings — three sections:
 *  1. SalaryStructures  — configure component rules + live preview
 *  2. StateRegistrations — PT/PSDT/LWF state exposure + registration toggle
 *  3. Coverage           — EPF / ESI headcount threshold tracker
 *
 * Exported as named components so HRSettings.tsx can render them in the
 * "payroll" settings group without duplicating layout chrome.
 */
import { useState, useCallback, useEffect } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Info,
  ChevronDown, ChevronUp, Building2, Users, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { StepIndicator } from "@/components/ui/step-indicator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function fmtRupees(paise: number) {
  return (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(valuePct: number | null | undefined) {
  if (valuePct == null) return "—";
  return (valuePct / 100).toFixed(2) + "%";
}

function Toggle({
  checked, onCheckedChange, disabled, testId,
}: { checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-testid={testId}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none",
        checked ? "bg-primary" : "bg-input",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
        checked ? "translate-x-5" : "translate-x-0",
      )} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SalaryStructure {
  id: string;
  name: string;
  description: string | null;
  pfMode: "restricted" | "unrestricted";
  isActive: boolean;
  effectiveDate: string;
  ruleCount?: number;
  employeeCount?: number;
}

interface SalaryStructureRule {
  id?: string;
  componentName: string;
  ruleType: "percent_of_gross" | "percent_of_component" | "fixed" | "residual";
  valuePct?: number | null;
  valueFixed?: number | null;
  referenceComponent?: string | null;
  lopMode: "proportional" | "fixed";
  sortOrder: number;
}

interface StateDeduction {
  id: string;
  state: string;
  levyType: string;
  amountPaise: number;
  febAmountPaise: number | null;
  isFlat: boolean;
  isRegistered: boolean;
  registrationNumber: string | null;
  thresholdPaise: number | null;
  deductionMonths: number[] | null;
  employeeCount?: number;
  monthlyExposurePaise?: number;
}

interface CoverageRecord {
  id: string;
  scheme: string;
  status: "not_applicable" | "voluntary" | "mandatory";
  applicableFrom: string | null;
  isLatched: boolean;
  threshold: number;
  headcount?: number;
  registrationNumber?: string | null;
}

// ---------------------------------------------------------------------------
// Client-side live preview engine (simplified)
// ---------------------------------------------------------------------------

function previewComponents(grossRupees: number, rules: SalaryStructureRule[]): Array<{ name: string; paise: number }> {
  const grossPaise = grossRupees * 100;
  const sorted = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
  const amounts: Map<string, number> = new Map();

  // First pass: everything except residual
  for (const r of sorted) {
    if (r.ruleType === "residual") continue;
    if (r.ruleType === "percent_of_gross") {
      amounts.set(r.componentName, Math.round((grossPaise * (r.valuePct ?? 0)) / 10000));
    } else if (r.ruleType === "percent_of_component") {
      const refPaise = amounts.get(r.referenceComponent ?? "") ?? 0;
      amounts.set(r.componentName, Math.round((refPaise * (r.valuePct ?? 0)) / 10000));
    } else if (r.ruleType === "fixed") {
      amounts.set(r.componentName, r.valueFixed ?? 0);
    }
  }

  // Second pass: residual
  for (const r of sorted) {
    if (r.ruleType !== "residual") continue;
    const sumOthers = Array.from(amounts.values()).reduce((a, b) => a + b, 0);
    amounts.set(r.componentName, Math.max(0, grossPaise - sumOthers));
  }

  return sorted.map(r => ({ name: r.componentName, paise: amounts.get(r.componentName) ?? 0 }));
}

function detectDependencyCycle(rules: SalaryStructureRule[]): string | null {
  const deps: Record<string, string | null> = {};
  for (const r of rules) {
    if (r.ruleType === "percent_of_component") {
      deps[r.componentName] = r.referenceComponent ?? null;
    }
  }
  for (const start of Object.keys(deps)) {
    const visited = new Set<string>();
    let current: string | null = start;
    while (current && current in deps) {
      if (visited.has(current)) {
        return `Circular dependency detected: "${current}" creates a reference loop. Restructure the percent-of-component chain.`;
      }
      visited.add(current);
      current = deps[current];
    }
  }
  return null;
}

function validateRules(rules: SalaryStructureRule[]): string | null {
  const residuals = rules.filter(r => r.ruleType === "residual");
  if (residuals.length === 0) return "Exactly one residual component is required.";
  if (residuals.length > 1) return `Only one residual is allowed — found ${residuals.length}.`;

  const pctSum = rules.filter(r => r.ruleType === "percent_of_gross")
    .reduce((s, r) => s + (r.valuePct ?? 0), 0);
  if (pctSum > 10000) return `Sum of percent-of-gross rules is ${(pctSum / 100).toFixed(2)}% — exceeds 100%.`;

  for (const r of rules) {
    if (!r.componentName.trim()) return "All components must have a name.";
    if (r.ruleType === "percent_of_component" && !r.referenceComponent) {
      return `"${r.componentName}" uses percent-of-component but has no reference.`;
    }
    if (r.ruleType === "percent_of_component" && r.referenceComponent === r.componentName) {
      return `"${r.componentName}" references itself.`;
    }
  }

  const cycleErr = detectDependencyCycle(rules);
  if (cycleErr) return cycleErr;

  return null;
}

function basicWarning(rules: SalaryStructureRule[]): string | null {
  const basic = rules.find(r => r.componentName.toLowerCase() === "basic");
  if (!basic) return null;
  if (basic.ruleType === "percent_of_gross" && (basic.valuePct ?? 0) < 5000) {
    return `Basic salary is ${fmtPct(basic.valuePct)} of gross — PF and statutory calculations may be sub-optimal when Basic < 50%.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule builder row
// ---------------------------------------------------------------------------

const RULE_TYPE_LABELS: Record<string, string> = {
  percent_of_gross: "% of Gross",
  percent_of_component: "% of Component",
  fixed: "Fixed (₹/month)",
  residual: "Residual",
};

const LOP_MODE_LABELS: Record<string, string> = {
  proportional: "Proportional",
  fixed: "Fixed (no LOP)",
};

function RuleRow({
  rule, index, total, componentNames, onChange, onRemove, onMoveUp, onMoveDown,
}: {
  rule: SalaryStructureRule;
  index: number;
  total: number;
  componentNames: string[];
  onChange: (r: SalaryStructureRule) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="grid gap-2 p-3 border rounded-lg bg-muted/20" data-testid={`rule-row-${index}`}>
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-0.5 mt-1">
          <button type="button" onClick={onMoveUp} disabled={index === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" data-testid={`button-rule-up-${index}`}>
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" data-testid={`button-rule-down-${index}`}>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Component Name</Label>
            <Input
              value={rule.componentName}
              onChange={e => onChange({ ...rule, componentName: e.target.value })}
              placeholder="e.g. Basic, HRA"
              className="h-8 text-sm"
              data-testid={`input-rule-name-${index}`}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Rule Type</Label>
            <Select
              value={rule.ruleType}
              onValueChange={(v) => onChange({ ...rule, ruleType: v as SalaryStructureRule["ruleType"], valuePct: null, valueFixed: null, referenceComponent: null })}
            >
              <SelectTrigger className="h-8 text-sm" data-testid={`select-rule-type-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {rule.ruleType === "percent_of_gross" && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Percentage (%)</Label>
              <Input
                type="number" step="0.01" min="0" max="100"
                value={rule.valuePct != null ? (rule.valuePct / 100).toString() : ""}
                onChange={e => onChange({ ...rule, valuePct: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
                placeholder="e.g. 40"
                className="h-8 text-sm"
                data-testid={`input-rule-pct-${index}`}
              />
            </div>
          )}

          {rule.ruleType === "percent_of_component" && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Percentage (%)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={rule.valuePct != null ? (rule.valuePct / 100).toString() : ""}
                  onChange={e => onChange({ ...rule, valuePct: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
                  placeholder="e.g. 50"
                  className="h-8 text-sm"
                  data-testid={`input-rule-pct-comp-${index}`}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Reference Component</Label>
                <Select
                  value={rule.referenceComponent ?? ""}
                  onValueChange={v => onChange({ ...rule, referenceComponent: v || null })}
                >
                  <SelectTrigger className="h-8 text-sm" data-testid={`select-rule-ref-${index}`}>
                    <SelectValue placeholder="Select component…" />
                  </SelectTrigger>
                  <SelectContent>
                    {componentNames.filter(n => n !== rule.componentName).map(n => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {rule.ruleType === "fixed" && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Amount (₹/month)</Label>
              <Input
                type="number" step="1" min="0"
                value={rule.valueFixed != null ? (rule.valueFixed / 100).toString() : ""}
                onChange={e => onChange({ ...rule, valueFixed: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
                placeholder="e.g. 1600"
                className="h-8 text-sm"
                data-testid={`input-rule-fixed-${index}`}
              />
            </div>
          )}

          {rule.ruleType !== "residual" && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">LOP Mode</Label>
              <Select
                value={rule.lopMode}
                onValueChange={v => onChange({ ...rule, lopMode: v as "proportional" | "fixed" })}
              >
                <SelectTrigger className="h-8 text-sm" data-testid={`select-rule-lop-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LOP_MODE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <button type="button" onClick={onRemove} className="mt-1 text-muted-foreground hover:text-destructive" data-testid={`button-rule-remove-${index}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Salary Structures Section
// ---------------------------------------------------------------------------

const BLANK_RULE = (): SalaryStructureRule => ({
  componentName: "",
  ruleType: "percent_of_gross",
  valuePct: null,
  valueFixed: null,
  referenceComponent: null,
  lopMode: "proportional",
  sortOrder: 0,
});

export function SalaryStructuresSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can("payroll.structures.write");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [structureStep, setStructureStep] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPfMode, setFormPfMode] = useState<"restricted" | "unrestricted">("restricted");
  const [rules, setRules] = useState<SalaryStructureRule[]>([]);
  const [previewGross, setPreviewGross] = useState("22000");
  const [confirmDeactivate, setConfirmDeactivate] = useState<SalaryStructure | null>(null);

  const { data: structures, isLoading } = useQuery<SalaryStructure[]>({
    queryKey: ["/api/payroll/structures"],
    staleTime: 30000,
  });

  const { data: editingRules } = useQuery<SalaryStructureRule[]>({
    queryKey: ["/api/payroll/structures", editingId, "rules"],
    queryFn: async () => {
      if (!editingId) return [];
      const res = await fetch(`/api/payroll/structures/${editingId}/rules`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!editingId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; pfMode: string }) => {
      const res = await apiRequest("POST", "/api/payroll/structures", data);
      return res.json();
    },
    onSuccess: (newStruct) => {
      setEditingId(newStruct.id);
      qc.invalidateQueries({ queryKey: ["/api/payroll/structures"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/payroll/structures/${id}`, data);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/payroll/structures"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rulesMutation = useMutation({
    mutationFn: async ({ id, rules: r }: { id: string; rules: SalaryStructureRule[] }) => {
      const res = await apiRequest("PUT", `/api/payroll/structures/${id}/rules`, { rules: r });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to save rules");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll/structures"] });
      setDialogOpen(false);
      setEditingId(null);
      toast({ title: "Saved", description: "Salary structure and rules saved." });
    },
    onError: (e: any) => toast({ title: "Validation error", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingId(null);
    setFormName("");
    setFormDesc("");
    setFormPfMode("restricted");
    setRules([
      { componentName: "Basic", ruleType: "percent_of_gross", valuePct: 4000, valueFixed: null, referenceComponent: null, lopMode: "proportional", sortOrder: 0 },
      { componentName: "HRA", ruleType: "percent_of_component", valuePct: 5000, valueFixed: null, referenceComponent: "Basic", lopMode: "proportional", sortOrder: 1 },
      { componentName: "Special Allowance", ruleType: "residual", valuePct: null, valueFixed: null, referenceComponent: null, lopMode: "proportional", sortOrder: 2 },
    ]);
    setDialogOpen(true);
  }

  function openEdit(s: SalaryStructure) {
    setEditingId(s.id);
    setFormName(s.name);
    setFormDesc(s.description ?? "");
    setFormPfMode(s.pfMode);
    // Always start with an empty rules array — never seed from editingRules here because
    // editingRules still holds the *previous* structure's data at the moment openEdit runs
    // (React state updates + query results are async).  The useEffect below hydrates rules
    // once the correct query result for the new editingId resolves.
    setRules([]);
    setDialogOpen(true);
  }

  // Hydrate rules whenever editingRules resolves for the currently-open structure.
  // No rules.length guard: we must overwrite rules every time editingId changes so that
  // switching from Structure A → B always loads B's rule set, not a stale A copy.
  useEffect(() => {
    if (editingId && dialogOpen && editingRules) {
      setRules(editingRules.map((r, i) => ({ ...r, sortOrder: i })));
    }
  }, [editingId, dialogOpen, editingRules]);

  async function handleSave() {
    const err = validateRules(rules);
    if (err) { toast({ title: "Validation error", description: err, variant: "destructive" }); return; }

    let structId = editingId;
    if (!structId) {
      if (!formName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
      const newStruct = await createMutation.mutateAsync({ name: formName, description: formDesc, pfMode: formPfMode });
      structId = newStruct.id;
    } else {
      await updateMutation.mutateAsync({ id: structId, data: { name: formName, description: formDesc, pfMode: formPfMode } });
    }

    if (structId) {
      await rulesMutation.mutateAsync({ id: structId, rules: rules.map((r, i) => ({ ...r, sortOrder: i })) });
    }
  }

  const addRule = () => setRules(rs => [...rs, { ...BLANK_RULE(), sortOrder: rs.length }]);
  const removeRule = (i: number) => setRules(rs => rs.filter((_, idx) => idx !== i));
  const updateRule = (i: number, r: SalaryStructureRule) => setRules(rs => rs.map((row, idx) => idx === i ? r : row));
  const moveUp = (i: number) => setRules(rs => {
    if (i === 0) return rs;
    const a = [...rs];
    [a[i - 1], a[i]] = [a[i], a[i - 1]];
    return a.map((r, idx) => ({ ...r, sortOrder: idx }));
  });
  const moveDown = (i: number) => setRules(rs => {
    if (i === rs.length - 1) return rs;
    const a = [...rs];
    [a[i], a[i + 1]] = [a[i + 1], a[i]];
    return a.map((r, idx) => ({ ...r, sortOrder: idx }));
  });

  const validationError = rules.length > 0 ? validateRules(rules) : null;
  const warn = basicWarning(rules);
  const preview = previewComponents(parseFloat(previewGross) || 22000, rules);
  const componentNames = rules.map(r => r.componentName).filter(Boolean);
  const isSaving = createMutation.isPending || updateMutation.isPending || rulesMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Salary Structures</h2>
          <p className="text-sm text-muted-foreground">Define component breakdowns and rules for structured salary computation.</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openCreate} data-testid="button-add-structure">
            <Plus className="h-4 w-4 mr-1" /> New Structure
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !structures?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No salary structures yet. Create one to enable the payroll engine.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {structures.map(s => (
            <Card key={s.id} className={cn(!s.isActive && "opacity-60")} data-testid={`card-structure-${s.id}`}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{s.name}</p>
                    {!s.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    <Badge variant="outline" className="text-xs capitalize">{s.pfMode} PF</Badge>
                    {s.ruleCount != null && <span className="text-xs text-muted-foreground">{s.ruleCount} rules</span>}
                    {s.employeeCount != null && s.employeeCount > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />{s.employeeCount} employees
                      </span>
                    )}
                  </div>
                  {s.description && <p className="text-sm text-muted-foreground mt-0.5 truncate">{s.description}</p>}
                </div>
                {canWrite && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)} data-testid={`button-edit-structure-${s.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDeactivate(s)}
                      data-testid={`button-toggle-structure-${s.id}`}
                    >
                      {s.isActive ? <Trash2 className="h-4 w-4 text-muted-foreground" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditingId(null); setRules([]); setStructureStep(0); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Structure" : "New Salary Structure"}</DialogTitle>
            <DialogDescription>Configure component rules. Exactly one residual is required.</DialogDescription>
            <StepIndicator
              steps={["Details", "Components"]}
              current={structureStep}
              className="mt-3"
            />
          </DialogHeader>

          <DialogBody className="py-4">
            {structureStep === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Name *</Label>
                    <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Standard India" data-testid="input-structure-name" />
                  </div>
                  <div className="space-y-1">
                    <Label>PF Mode</Label>
                    <Select value={formPfMode} onValueChange={v => setFormPfMode(v as any)}>
                      <SelectTrigger data-testid="select-pf-mode"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="restricted">Restricted (cap at ₹15,000 wages)</SelectItem>
                        <SelectItem value="unrestricted">Unrestricted (PF on actual wages)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label>Description</Label>
                    <Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Optional description" data-testid="input-structure-desc" />
                  </div>
                </div>
              </div>
            )}

            {structureStep === 1 && (
              <div className="space-y-4">
                {/* Validation error + basic warning */}
                {validationError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    {validationError}
                  </div>
                )}
                {!validationError && warn && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3 text-sm text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    {warn}
                  </div>
                )}

                {/* Rule builder */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Component Rules</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addRule} data-testid="button-add-rule">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Component
                    </Button>
                  </div>
                  {rules.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">No components yet — add at least one residual.</p>
                  )}
                  <div className="space-y-2">
                    {rules.map((r, i) => (
                      <RuleRow
                        key={i}
                        rule={r}
                        index={i}
                        total={rules.length}
                        componentNames={componentNames}
                        onChange={nr => updateRule(i, nr)}
                        onRemove={() => removeRule(i)}
                        onMoveUp={() => moveUp(i)}
                        onMoveDown={() => moveDown(i)}
                      />
                    ))}
                  </div>
                </div>

                {/* Live preview */}
                {rules.length > 0 && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-primary" /> Live Preview
                      </p>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Sample Gross (₹)</Label>
                        <Input
                          type="number"
                          value={previewGross}
                          onChange={e => setPreviewGross(e.target.value)}
                          className="h-7 w-28 text-sm"
                          data-testid="input-preview-gross"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      {preview.map((p, i) => (
                        <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                          <span>{p.name}</span>
                          <span className="font-mono">₹ {fmtRupees(p.paise)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm py-1 font-semibold">
                        <span>Total</span>
                        <span className="font-mono">₹ {fmtRupees(preview.reduce((s, p) => s + p.paise, 0))}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); setRules([]); setStructureStep(0); }}>
              Cancel
            </Button>
            {structureStep > 0 && (
              <Button variant="ghost" onClick={() => setStructureStep(0)} data-testid="button-structure-back">← Back</Button>
            )}
            {structureStep === 0 ? (
              <Button
                onClick={() => setStructureStep(1)}
                disabled={!formName.trim()}
                data-testid="button-structure-next"
              >
                Next →
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={!formName.trim() || !!validationError || isSaving}
                data-testid="button-save-structure"
              >
                {isSaving ? "Saving…" : "Save Structure"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate/Activate confirmation */}
      <Dialog open={!!confirmDeactivate} onOpenChange={(o) => !o && setConfirmDeactivate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmDeactivate?.isActive ? "Deactivate" : "Activate"} Structure</DialogTitle>
          </DialogHeader>
          <DialogBody>
          <p className="text-sm text-muted-foreground">
            {confirmDeactivate?.isActive
              ? `Deactivating "${confirmDeactivate?.name}" prevents it from being assigned to new employees. Existing assignments remain until re-assigned.`
              : `Activating "${confirmDeactivate?.name}" makes it available for assignment again.`}
          </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>Cancel</Button>
            <Button
              variant={confirmDeactivate?.isActive ? "destructive" : "default"}
              onClick={() => {
                if (!confirmDeactivate) return;
                updateMutation.mutate({ id: confirmDeactivate.id, data: { isActive: !confirmDeactivate.isActive } }, {
                  onSuccess: () => { setConfirmDeactivate(null); toast({ title: "Updated" }); },
                });
              }}
              disabled={updateMutation.isPending}
            >
              {confirmDeactivate?.isActive ? "Deactivate" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// State Registrations Section
// ---------------------------------------------------------------------------

export function StateRegistrationsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editState, setEditState] = useState<StateDeduction | null>(null);
  const [formRegistered, setFormRegistered] = useState(false);
  const [formRegNo, setFormRegNo] = useState("");
  const [formAuditReason, setFormAuditReason] = useState("");

  const { data: states, isLoading } = useQuery<StateDeduction[]>({
    queryKey: ["/api/payroll/state-deductions"],
    staleTime: 60000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/payroll/state-deductions/${id}`, data);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll/state-deductions"] });
      setEditState(null);
      setFormAuditReason("");
      toast({ title: "Saved", description: "State registration updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Only show exposure banner for states that actually have employees and are unregistered
  const unregistered = (states ?? []).filter(s => !s.isRegistered && (s.employeeCount ?? 0) > 0);

  function openEdit(s: StateDeduction) {
    setEditState(s);
    setFormRegistered(s.isRegistered);
    setFormRegNo(s.registrationNumber ?? "");
    setFormAuditReason("");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">State Registrations</h2>
        <p className="text-sm text-muted-foreground">Mark which states are registered for PT / PSDT / LWF and record registration numbers.</p>
      </div>

      {/* Exposure banner */}
      {unregistered.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4" data-testid="banner-unregistered">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm text-amber-800 dark:text-amber-200">
              {unregistered.length} state{unregistered.length > 1 ? "s" : ""} with employees not yet registered
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              {unregistered.map(s => `${s.state} (${s.employeeCount} employee${s.employeeCount !== 1 ? "s" : ""}${(s.monthlyExposurePaise ?? 0) > 0 ? `, ~₹${fmtRupees(s.monthlyExposurePaise!)}/mo` : ""})`).join(", ")} — register to enable correct PT/PSDT deductions.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !states?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No state deduction configurations seeded yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">State</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Levy</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Rate (₹)</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Employees</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Exposure/mo</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Registered</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Reg. No.</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {(states ?? []).map(s => (
                  <tr key={s.id} className="border-b last:border-0" data-testid={`row-state-${s.state}`}>
                    <td className="py-3 px-4 font-medium">{s.state}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs uppercase">{s.levyType}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs">
                      {s.thresholdPaise ? `>₹${fmtRupees(s.thresholdPaise)}→` : ""}
                      ₹{fmtRupees(s.amountPaise)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {(s.employeeCount ?? 0) > 0 ? (
                        <span className="text-amber-700 dark:text-amber-300 font-medium">{s.employeeCount}</span>
                      ) : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs">
                      {(s.monthlyExposurePaise ?? 0) > 0 ? (
                        <span className="font-medium">₹{fmtRupees(s.monthlyExposurePaise!)}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {s.isRegistered ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {s.registrationNumber ?? "—"}
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)} data-testid={`button-edit-state-${s.state}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!editState} onOpenChange={(o) => !o && setEditState(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registration — {editState?.state} {editState?.levyType.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <DialogBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Registered</p>
                <p className="text-xs text-muted-foreground">Enable deduction for this levy</p>
              </div>
              <Toggle
                checked={formRegistered}
                onCheckedChange={setFormRegistered}
                testId="toggle-state-registered"
              />
            </div>
            {formRegistered && (
              <div className="space-y-1">
                <Label>Registration Number</Label>
                <Input
                  value={formRegNo}
                  onChange={e => setFormRegNo(e.target.value)}
                  placeholder="Enter registration number…"
                  data-testid="input-state-reg-no"
                />
              </div>
            )}
            {(editState?.employeeCount ?? 0) > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-700 dark:text-amber-300">
                <strong>{editState!.employeeCount} employee{editState!.employeeCount !== 1 ? "s" : ""}</strong> in {editState!.state} —
                monthly liability ₹{fmtRupees(editState!.monthlyExposurePaise ?? 0)}.
              </div>
            )}
            <div className="space-y-1">
              <Label>Reason for change *</Label>
              <Textarea
                value={formAuditReason}
                onChange={e => setFormAuditReason(e.target.value)}
                placeholder="Why are you updating this state registration?"
                data-testid="input-state-audit-reason"
                rows={2}
              />
            </div>
          </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditState(null); setFormAuditReason(""); }}>Cancel</Button>
            <Button
              onClick={() => editState && updateMutation.mutate({ id: editState.id, data: { isRegistered: formRegistered, registrationNumber: formRegNo || null, auditReason: formAuditReason } })}
              disabled={updateMutation.isPending || !formAuditReason.trim()}
              data-testid="button-save-state-registration"
            >
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coverage Section
// ---------------------------------------------------------------------------

const SCHEME_LABELS: Record<string, { label: string; law: string; threshold: number }> = {
  EPF: { label: "Employees' Provident Fund", law: "EPF & MP Act, 1952", threshold: 20 },
  ESI: { label: "Employees' State Insurance", law: "ESI Act, 1948", threshold: 10 },
};

const STATUS_LABELS: Record<string, string> = {
  not_applicable: "Not Applicable",
  voluntary: "Voluntary",
  mandatory: "Mandatory",
};

const STATUS_COLORS: Record<string, string> = {
  not_applicable: "bg-secondary text-secondary-foreground",
  voluntary: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  mandatory: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

// Helper: find all headcount history periods where count crossed a given threshold.
// API returns `total_count` (matches headcount_history column name).
function getCrossingDates(history: Array<{ period: string; total_count?: number; count?: number }>, threshold: number): string[] {
  return history
    .filter(h => ((h.total_count ?? h.count ?? 0) as number) >= threshold)
    .map(h => h.period)
    .sort();
}

export function CoverageSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can("payroll.coverage.write");
  const [editScheme, setEditScheme] = useState<CoverageRecord | null>(null);
  const [formStatus, setFormStatus] = useState<"not_applicable" | "voluntary" | "mandatory">("not_applicable");
  const [formApplicableFrom, setFormApplicableFrom] = useState("");
  const [formHeadcount, setFormHeadcount] = useState("");
  const [showHeadcountForm, setShowHeadcountForm] = useState(false);
  const [mandatoryConfirmOpen, setMandatoryConfirmOpen] = useState(false);
  const [pendingMandatoryScheme, setPendingMandatoryScheme] = useState<{ scheme: string; status: string; applicableFrom: string } | null>(null);
  // Threshold crossing: auto-triggered blocking dialog
  const [crossingDialog, setCrossingDialog] = useState<{ scheme: string; threshold: number; crossingDates: string[] } | null>(null);
  const [crossApplicableFrom, setCrossApplicableFrom] = useState("");

  const { data: coverage, isLoading } = useQuery<CoverageRecord[]>({
    queryKey: ["/api/payroll/coverage"],
    staleTime: 30000,
  });

  const { data: headcountData } = useQuery<{ current: number; history: any[] }>({
    queryKey: ["/api/payroll/headcount"],
    staleTime: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ scheme, data }: { scheme: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/payroll/coverage/${scheme}`, data);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll/coverage"] });
      setEditScheme(null);
      toast({ title: "Coverage updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const headcountMutation = useMutation({
    mutationFn: async (data: { count: number; period: string }) => {
      const res = await apiRequest("POST", "/api/payroll/headcount", data);
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll/headcount"] });
      qc.invalidateQueries({ queryKey: ["/api/payroll/coverage"] });
      setShowHeadcountForm(false);
      setFormHeadcount("");
      toast({ title: "Headcount recorded" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const currentHeadcount = headcountData?.current ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">EPF & ESI Coverage</h2>
          <p className="text-sm text-muted-foreground">Track establishment headcount and mandatory coverage thresholds.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHeadcountForm(v => !v)} data-testid="button-record-headcount">
          <Users className="h-4 w-4 mr-1" /> Update Headcount
        </Button>
      </div>

      {/* Headcount input */}
      {showHeadcountForm && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label>Current Employee Count</Label>
                <Input
                  type="number"
                  min="0"
                  value={formHeadcount}
                  onChange={e => setFormHeadcount(e.target.value)}
                  placeholder={String(currentHeadcount || "e.g. 24")}
                  data-testid="input-headcount"
                />
              </div>
              <Button
                onClick={() => {
                  const count = parseInt(formHeadcount);
                  if (!count || count < 0) { toast({ title: "Invalid count", variant: "destructive" }); return; }
                  const today = new Date();
                  const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
                  headcountMutation.mutate({ count, period });
                }}
                disabled={headcountMutation.isPending || !formHeadcount}
                data-testid="button-save-headcount"
              >
                {headcountMutation.isPending ? "Saving…" : "Record"}
              </Button>
            </div>
            {currentHeadcount > 0 && (
              <p className="text-xs text-muted-foreground mt-2">Last recorded: {currentHeadcount} employees</p>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {["EPF", "ESI"].map(scheme => {
            const rec = coverage?.find(c => c.scheme === scheme);
            const info = SCHEME_LABELS[scheme];
            const threshold = rec?.threshold ?? info.threshold;
            const pct = threshold > 0 ? Math.min(100, Math.round((currentHeadcount / threshold) * 100)) : 0;
            const isNear = pct >= 80 && pct < 100;
            const isOver = pct >= 100;

            return (
              <Card key={scheme} data-testid={`card-coverage-${scheme}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{scheme}</CardTitle>
                      <p className="text-xs text-muted-foreground">{info.law}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-xs", rec ? STATUS_COLORS[rec.status] : STATUS_COLORS.not_applicable)}>
                        {rec ? STATUS_LABELS[rec.status] : "Not Configured"}
                      </Badge>
                      {rec?.isLatched && (
                        <Badge variant="secondary" className="text-xs">Latched</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Headcount progress */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Headcount: <strong>{currentHeadcount}</strong> / {threshold} threshold</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", isOver ? "bg-red-500" : isNear ? "bg-amber-500" : "bg-primary")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {isNear && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Approaching threshold — review coverage status
                      </p>
                    )}
                    {isOver && (!rec || rec.status !== "mandatory") && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Threshold exceeded — mandatory registration required
                      </p>
                    )}
                  </div>

                  {rec?.applicableFrom && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" /> Applicable from: {new Date(rec.applicableFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}

                  {rec?.registrationNumber && (
                    <p className="text-xs text-muted-foreground">Reg. No.: {rec.registrationNumber}</p>
                  )}

                  {/* When threshold is crossed and not yet mandatory: show blocking action button */}
                  {isOver && (!rec || rec.status !== "mandatory") && canWrite ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const crossingDates = getCrossingDates(headcountData?.history ?? [], threshold);
                        setCrossingDialog({ scheme, threshold, crossingDates });
                        setCrossApplicableFrom(crossingDates[0] ?? "");
                      }}
                      data-testid={`button-review-coverage-${scheme}`}
                    >
                      <AlertTriangle className="h-4 w-4 mr-1" /> Coverage Action Required
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setEditScheme(rec ?? { id: "", scheme, status: "not_applicable", applicableFrom: null, isLatched: false, threshold });
                        setFormStatus(rec?.status ?? "not_applicable");
                        setFormApplicableFrom(rec?.applicableFrom ?? "");
                      }}
                      disabled={!canWrite && !(rec?.isLatched && rec.status === "mandatory")}
                      data-testid={`button-edit-coverage-${scheme}`}
                    >
                      {rec?.isLatched && rec.status === "mandatory" ? "View Coverage (Latched)" : "Edit Coverage"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit coverage dialog */}
      <Dialog open={!!editScheme} onOpenChange={(o) => !o && setEditScheme(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Coverage — {editScheme?.scheme}</DialogTitle>
            <DialogDescription>
              {editScheme?.isLatched && editScheme.status === "mandatory"
                ? "This scheme is latched as mandatory and cannot be turned off."
                : "Update the establishment coverage status for this scheme."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          <div className="space-y-4">
            {editScheme?.isLatched && editScheme.status === "mandatory" ? (
              <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-300 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{editScheme.scheme} is Mandatory (Latched)</p>
                  {editScheme.applicableFrom && (
                    <p className="text-xs mt-0.5">Effective from: {new Date(editScheme.applicableFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select
                    value={formStatus}
                    onValueChange={v => setFormStatus(v as any)}
                  >
                    <SelectTrigger data-testid="select-coverage-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_applicable">Not Applicable</SelectItem>
                      <SelectItem value="voluntary">Voluntary</SelectItem>
                      <SelectItem value="mandatory">Mandatory (Irreversible)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(formStatus === "voluntary" || formStatus === "mandatory") && (
                  <div className="space-y-1">
                    <Label>Applicable From *</Label>
                    <Input
                      type="date"
                      value={formApplicableFrom}
                      onChange={e => setFormApplicableFrom(e.target.value)}
                      data-testid="input-coverage-date"
                    />
                    <p className="text-xs text-muted-foreground">
                      Can be backdated to match the month headcount first crossed the threshold.
                    </p>
                  </div>
                )}
                {formStatus === "mandatory" && (
                  <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">This action is irreversible.</p>
                      <p className="mt-0.5">Once set to Mandatory, this scheme cannot be turned off. All employees covered by {editScheme?.scheme} will have statutory deductions applied from the effective date. This cannot be undone.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditScheme(null)}>Cancel</Button>
            {!(editScheme?.isLatched && editScheme?.status === "mandatory") && (
              <Button
                onClick={() => {
                  if (!editScheme) return;
                  if (formStatus === "mandatory" && !editScheme.isLatched) {
                    setPendingMandatoryScheme({ scheme: editScheme.scheme, status: formStatus, applicableFrom: formApplicableFrom });
                    setMandatoryConfirmOpen(true);
                  } else {
                    updateMutation.mutate({ scheme: editScheme.scheme, data: { status: formStatus, applicableFrom: formApplicableFrom || null } });
                  }
                }}
                disabled={updateMutation.isPending || ((formStatus === "voluntary" || formStatus === "mandatory") && !formApplicableFrom)}
                variant={formStatus === "mandatory" ? "destructive" : "default"}
                data-testid="button-save-coverage"
              >
                {updateMutation.isPending ? "Saving…" : formStatus === "mandatory" ? "Set Mandatory…" : "Save"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mandatory latch confirmation — separate blocking dialog */}
      <Dialog open={mandatoryConfirmOpen} onOpenChange={(o) => !o && setMandatoryConfirmOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Mandatory Coverage — {pendingMandatoryScheme?.scheme}</DialogTitle>
            <DialogDescription>
              This will permanently latch {pendingMandatoryScheme?.scheme} as mandatory. You cannot undo this.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          <div className="space-y-3">
            <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300 space-y-2">
              <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 shrink-0" /> Irreversible Action</p>
              <p>Confirming will:</p>
              <ul className="list-disc pl-4 space-y-1 text-xs">
                <li>Lock {pendingMandatoryScheme?.scheme} as mandatory for this establishment</li>
                <li>Enable statutory deductions from <strong>{pendingMandatoryScheme?.applicableFrom ? new Date(pendingMandatoryScheme.applicableFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</strong></li>
                <li>This status <strong>can never be reverted</strong> in the system</li>
              </ul>
            </div>
          </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMandatoryConfirmOpen(false)}>Go Back</Button>
            <Button
              variant="destructive"
              disabled={updateMutation.isPending}
              onClick={() => {
                if (!pendingMandatoryScheme) return;
                updateMutation.mutate(
                  { scheme: pendingMandatoryScheme.scheme, data: { status: pendingMandatoryScheme.status, applicableFrom: pendingMandatoryScheme.applicableFrom || null } },
                  {
                    onSuccess: () => {
                      setMandatoryConfirmOpen(false);
                      setEditScheme(null);
                      setPendingMandatoryScheme(null);
                    },
                  }
                );
              }}
              data-testid="button-confirm-mandatory"
            >
              {updateMutation.isPending ? "Confirming…" : "I understand — Set Mandatory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Threshold crossing — blocking mandatory latch dialog sourced from headcount history */}
      <Dialog open={!!crossingDialog} onOpenChange={(o) => { if (!o) { setCrossingDialog(null); setCrossApplicableFrom(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {crossingDialog?.scheme} — Mandatory Coverage Required
            </DialogTitle>
            <DialogDescription>
              Your establishment has <strong>{currentHeadcount}</strong> employees, exceeding the{" "}
              <strong>{crossingDialog?.threshold}</strong>-employee {crossingDialog?.scheme} threshold.
              Mandatory registration is legally required under Indian labour law.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          <div className="space-y-4">
            <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
              <p className="font-semibold flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Irreversible Action
              </p>
              <ul className="list-disc pl-4 space-y-1 text-xs">
                <li>Permanently locks {crossingDialog?.scheme} as mandatory for this establishment</li>
                <li>Enables statutory deductions from the selected effective month</li>
                <li>This status <strong>can never be reverted</strong> in the system</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <Label>Effective Month (when threshold was first crossed) *</Label>
              {crossingDialog?.crossingDates && crossingDialog.crossingDates.length > 0 ? (
                <>
                  <Select value={crossApplicableFrom} onValueChange={setCrossApplicableFrom}>
                    <SelectTrigger data-testid="select-crossing-date">
                      <SelectValue placeholder="Select month from headcount history" />
                    </SelectTrigger>
                    <SelectContent>
                      {crossingDialog.crossingDates.map(d => (
                        <SelectItem key={d} value={d}>
                          {new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                          {d === crossingDialog.crossingDates[0] ? " (earliest crossing)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Dates sourced from recorded headcount history where count ≥ {crossingDialog.threshold} employees.
                  </p>
                </>
              ) : (
                <>
                  <Input
                    type="date"
                    value={crossApplicableFrom}
                    onChange={e => setCrossApplicableFrom(e.target.value)}
                    data-testid="input-crossing-date"
                  />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No headcount history on record. Enter the month the threshold was first crossed.
                  </p>
                </>
              )}
            </div>
          </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCrossingDialog(null); setCrossApplicableFrom(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!crossApplicableFrom || updateMutation.isPending}
              onClick={() => {
                if (!crossingDialog || !crossApplicableFrom) return;
                updateMutation.mutate(
                  { scheme: crossingDialog.scheme, data: { status: "mandatory", applicableFrom: crossApplicableFrom } },
                  {
                    onSuccess: () => {
                      setCrossingDialog(null);
                      setCrossApplicableFrom("");
                    },
                  }
                );
              }}
              data-testid="button-confirm-crossing-mandatory"
            >
              {updateMutation.isPending ? "Confirming…" : "I understand — Set Mandatory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
