import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Table2, ChevronDown, ChevronUp, Target, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export interface AnnexureTable {
  col1Header: string;
  col2Header: string;
  rows: [string, string][];
}

export interface AnnexureGoalPush {
  enabled: boolean;
  dueDate: string;
  selectedRows: number[];
  // When true, all selected rows become milestones of ONE goal (goalTitle)
  // instead of each row becoming its own goal.
  asMilestones?: boolean;
  goalTitle?: string;
}

export interface GoalPushMilestone {
  title: string;
  targetDate?: string;
}

export interface GoalPushItem {
  title: string;
  description?: string;
  startDate?: string;
  targetDate?: string;
  autoProgressFromMilestones?: boolean;
  milestones?: GoalPushMilestone[];
}

// Shared helper used by every annexure goal-push flow. Maps the annexure tables'
// selected rows into either one-goal-per-row (default) or a single goal whose
// milestones are the selected rows (when goalPush.asMilestones is set).
export function buildGoalsFromAnnexures(
  annexures: AnnexureItem[],
  startDate?: string,
): GoalPushItem[] {
  const goals: GoalPushItem[] = [];
  for (const ann of annexures) {
    const gp = ann.goalPush;
    if (!ann.table || !gp?.enabled || gp.selectedRows.length === 0) continue;
    const rows = gp.selectedRows
      .map(idx => ann.table!.rows[idx])
      .filter((row): row is [string, string] => !!row && !!row[0].trim());
    if (rows.length === 0) continue;

    if (gp.asMilestones) {
      const goalTitle = (gp.goalTitle || ann.title || "Goals").trim() || "Goals";
      goals.push({
        title: goalTitle,
        startDate: startDate || undefined,
        targetDate: gp.dueDate || undefined,
        autoProgressFromMilestones: true,
        milestones: rows.map(row => ({
          title: row[0].trim(),
          targetDate: row[1]?.trim() || undefined,
        })),
      });
    } else {
      for (const row of rows) {
        goals.push({
          title: row[0].trim(),
          description: row[1]?.trim() || undefined,
          startDate: startDate || undefined,
          targetDate: gp.dueDate || undefined,
        });
      }
    }
  }
  return goals;
}

export interface AnnexureItem {
  title: string;
  body: string;
  table?: AnnexureTable;
  goalPush?: AnnexureGoalPush;
}

const LABELS = ["A", "B", "C", "D", "E"];
const MAX_ANNEXURES = 5;

interface AnnexureEditorProps {
  annexures: AnnexureItem[];
  onChange: (annexures: AnnexureItem[]) => void;
  effectiveDate?: string;
  goalPushDisabled?: boolean;
  goalPushDisabledReason?: string;
}

function defaultGoalDueDate(effectiveDate?: string): string {
  const base = effectiveDate ? new Date(effectiveDate) : new Date();
  base.setDate(base.getDate() + 90);
  return base.toISOString().split("T")[0];
}

function TableEditor({
  table,
  onChange,
  onRemove,
  annexureIdx,
  goalPush,
  onGoalPushChange,
  effectiveDate,
  goalPushDisabled,
  goalPushDisabledReason,
}: {
  table: AnnexureTable;
  onChange: (t: AnnexureTable) => void;
  onRemove: () => void;
  annexureIdx: number;
  goalPush?: AnnexureGoalPush;
  onGoalPushChange: (gp: AnnexureGoalPush | undefined) => void;
  effectiveDate?: string;
  goalPushDisabled?: boolean;
  goalPushDisabledReason?: string;
}) {
  function updateHeader(col: 1 | 2, value: string) {
    onChange({ ...table, [`col${col}Header`]: value });
  }

  function updateRow(rowIdx: number, col: 0 | 1, value: string) {
    const rows = table.rows.map((r, i) =>
      i === rowIdx ? ([col === 0 ? value : r[0], col === 1 ? value : r[1]] as [string, string]) : r
    );
    onChange({ ...table, rows });
  }

  function addRow() {
    onChange({ ...table, rows: [...table.rows, ["", ""]] });
  }

  function removeRow(rowIdx: number) {
    const newRows = table.rows.filter((_, i) => i !== rowIdx);
    onChange({ ...table, rows: newRows });
    if (goalPush) {
      const newSelected = goalPush.selectedRows
        .filter(i => i !== rowIdx)
        .map(i => (i > rowIdx ? i - 1 : i));
      onGoalPushChange({ ...goalPush, selectedRows: newSelected });
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const rawRows = text.trim().split(/\r?\n/);
    const parsed: [string, string][] = rawRows
      .map(line => {
        const cols = line.split("\t");
        return [cols[0] ?? "", cols[1] ?? ""] as [string, string];
      })
      .filter(r => r[0] || r[1]);
    if (parsed.length === 0) return;
    let newHeaders = { col1Header: table.col1Header, col2Header: table.col2Header };
    let dataRows = parsed;
    if (!table.col1Header && !table.col2Header && parsed.length > 1) {
      newHeaders = { col1Header: parsed[0][0], col2Header: parsed[0][1] };
      dataRows = parsed.slice(1);
    }
    onChange({ ...newHeaders, rows: [...table.rows, ...dataRows] });
  }

  function toggleGoalPush(enabled: boolean) {
    if (enabled) {
      onGoalPushChange({
        enabled: true,
        dueDate: defaultGoalDueDate(effectiveDate),
        selectedRows: table.rows.map((_, i) => i),
      });
    } else {
      onGoalPushChange(undefined);
    }
  }

  function toggleRowSelection(rowIdx: number, checked: boolean) {
    if (!goalPush) return;
    const newSelected = checked
      ? [...goalPush.selectedRows, rowIdx].sort((a, b) => a - b)
      : goalPush.selectedRows.filter(i => i !== rowIdx);
    onGoalPushChange({ ...goalPush, selectedRows: newSelected });
  }

  const hasRows = table.rows.length > 0;
  const rowsWithContent = table.rows.filter(r => r[0].trim());

  return (
    <div
      className="border rounded-md bg-white space-y-2 p-3"
      onPaste={handlePaste}
      data-testid={`annexure-table-${annexureIdx}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
          <Table2 className="h-3 w-3" /> Table
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground italic">Paste from Excel to auto-fill rows</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
            onClick={onRemove}
            data-testid={`btn-remove-table-${annexureIdx}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Column 1 Header</Label>
          <Input
            value={table.col1Header}
            onChange={e => updateHeader(1, e.target.value)}
            placeholder="e.g. Milestone"
            className="h-7 text-xs mt-0.5"
            data-testid={`input-table-col1-header-${annexureIdx}`}
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Column 2 Header</Label>
          <Input
            value={table.col2Header}
            onChange={e => updateHeader(2, e.target.value)}
            placeholder="e.g. Target Date"
            className="h-7 text-xs mt-0.5"
            data-testid={`input-table-col2-header-${annexureIdx}`}
          />
        </div>
      </div>

      {/* Rows */}
      {table.rows.length > 0 && (
        <div className="space-y-1">
          {table.rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex items-center gap-1" data-testid={`table-row-${annexureIdx}-${rowIdx}`}>
              {goalPush && (
                <Checkbox
                  checked={goalPush.selectedRows.includes(rowIdx)}
                  onCheckedChange={(checked) => toggleRowSelection(rowIdx, !!checked)}
                  disabled={!row[0].trim()}
                  data-testid={`checkbox-goal-row-${annexureIdx}-${rowIdx}`}
                  className="shrink-0"
                />
              )}
              <Input
                value={row[0]}
                onChange={e => updateRow(rowIdx, 0, e.target.value)}
                placeholder="Col 1"
                className="h-7 text-xs"
                data-testid={`input-row-col1-${annexureIdx}-${rowIdx}`}
              />
              <Input
                value={row[1]}
                onChange={e => updateRow(rowIdx, 1, e.target.value)}
                placeholder="Col 2"
                className="h-7 text-xs"
                data-testid={`input-row-col2-${annexureIdx}-${rowIdx}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-400 hover:text-red-600 shrink-0"
                onClick={() => removeRow(rowIdx)}
                data-testid={`btn-remove-row-${annexureIdx}-${rowIdx}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {table.rows.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic py-1">
          No rows yet — click "Add Row" or paste tab-separated content from Excel.
        </p>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={addRow}
        data-testid={`btn-add-row-${annexureIdx}`}
      >
        <Plus className="h-3 w-3 mr-1" /> Add Row
      </Button>

      {/* Push to goals toggle — only shown when rows with content exist */}
      {rowsWithContent.length > 0 && (
        <div className="border-t pt-2 mt-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className={`h-3.5 w-3.5 ${goalPushDisabled ? "text-muted-foreground" : "text-emerald-600"}`} />
              <span className={`text-xs font-medium ${goalPushDisabled ? "text-muted-foreground" : "text-emerald-800"}`}>Push rows to performance goals</span>
            </div>
            <Switch
              checked={!goalPushDisabled && !!goalPush?.enabled}
              onCheckedChange={toggleGoalPush}
              disabled={goalPushDisabled}
              data-testid={`switch-push-goals-${annexureIdx}`}
            />
          </div>

          {goalPushDisabled && (
            <p className="text-[11px] text-muted-foreground italic" data-testid={`text-goal-push-disabled-${annexureIdx}`}>
              {goalPushDisabledReason || "Select a system employee to push these rows as performance goals."}
            </p>
          )}

          {!goalPushDisabled && goalPush?.enabled && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-emerald-800 font-medium">
                  Create one goal with milestones
                </span>
                <Switch
                  checked={!!goalPush.asMilestones}
                  onCheckedChange={(checked) => onGoalPushChange({ ...goalPush, asMilestones: checked })}
                  data-testid={`switch-as-milestones-${annexureIdx}`}
                />
              </div>
              {goalPush.asMilestones ? (
                <>
                  <p className="text-[11px] text-emerald-700">
                    Each selected row becomes a milestone (Col 1 → milestone title · Col 2 → target date) of a single goal.
                  </p>
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Goal title</Label>
                    <Input
                      value={goalPush.goalTitle || ""}
                      onChange={e => onGoalPushChange({ ...goalPush, goalTitle: e.target.value })}
                      placeholder="e.g. Onboarding plan"
                      className="h-6 text-xs flex-1"
                      data-testid={`input-goal-title-${annexureIdx}`}
                    />
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-emerald-700">
                  Col 1 → goal title · Col 2 → description. Deselect rows to skip them.
                </p>
              )}
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Due date</Label>
                <Input
                  type="date"
                  value={goalPush.dueDate}
                  onChange={e => onGoalPushChange({ ...goalPush, dueDate: e.target.value })}
                  className="h-6 text-xs flex-1"
                  data-testid={`input-goal-due-date-${annexureIdx}`}
                />
              </div>
              {goalPush.selectedRows.length === 0 && (
                <p className="text-[11px] text-amber-600">No rows selected — select at least one row above.</p>
              )}
              {goalPush.selectedRows.length > 0 && (
                <p className="text-[11px] text-emerald-700 font-medium">
                  {goalPush.asMilestones
                    ? `1 goal with ${goalPush.selectedRows.length} milestone${goalPush.selectedRows.length > 1 ? "s" : ""} will be created on generation.`
                    : `${goalPush.selectedRows.length} goal${goalPush.selectedRows.length > 1 ? "s" : ""} will be created on generation.`}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PlanGoalTemplate {
  id: string;
  plan_type: string;
  role_slug: string;
  goal_title: string;
  goal_category: string;
  goal_description: string | null;
  target_metric: string | null;
  sort_order: number;
  is_active: boolean;
}

const ROLE_SLUG_LABELS: Record<string, string> = {
  associate_recruiter: "Associate Recruiter",
  senior_recruiter: "Senior Recruiter",
  foundation_to_senior: "Foundation → Senior Recruiter",
  lead_recruiter: "Lead Recruiter",
  associate_manager: "Associate Manager",
  account_manager: "Account Manager",
};

const PLAN_TYPE_LABELS: Record<string, string> = {
  probation: "Probation",
  growth: "Growth Plan",
  pip: "PIP",
};

function LoadFromTemplateDialog({
  open,
  onOpenChange,
  onLoad,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLoad: (templates: PlanGoalTemplate[]) => void;
}) {
  const [deptScope, setDeptScope] = useState("healthcare");
  const [planType, setPlanType] = useState("");
  const [roleSlug, setRoleSlug] = useState("");

  const { data: templates = [], isLoading } = useQuery<PlanGoalTemplate[]>({
    queryKey: ["/api/hr/plan-templates", deptScope, planType, roleSlug],
    queryFn: async () => {
      if (!planType && !roleSlug) return [];
      const params = new URLSearchParams();
      params.set("department_scope", deptScope);
      if (planType) params.set("plan_type", planType);
      if (roleSlug) params.set("role_slug", roleSlug);
      const res = await fetch(`/api/hr/plan-templates?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(planType || roleSlug),
  });

  function handleLoad() {
    onLoad(templates);
    onOpenChange(false);
    setPlanType("");
    setRoleSlug("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Load from Template
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a department, plan type and role to load predefined goal templates as table rows.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Department</Label>
            <Select value={deptScope} onValueChange={setDeptScope}>
              <SelectTrigger data-testid="select-template-dept-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="healthcare">Healthcare</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Plan Type</Label>
              <Select value={planType} onValueChange={setPlanType}>
                <SelectTrigger data-testid="select-template-plan-type">
                  <SelectValue placeholder="Select plan..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="probation">Probation</SelectItem>
                  <SelectItem value="growth">Growth Plan</SelectItem>
                  <SelectItem value="pip">PIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={roleSlug} onValueChange={setRoleSlug}>
                <SelectTrigger data-testid="select-template-role">
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="associate_recruiter">Associate Recruiter</SelectItem>
                  <SelectItem value="senior_recruiter">Senior Recruiter</SelectItem>
                  <SelectItem value="foundation_to_senior">Foundation → Senior Recruiter</SelectItem>
                  <SelectItem value="lead_recruiter">Lead Recruiter</SelectItem>
                  <SelectItem value="associate_manager">Associate Manager</SelectItem>
                  <SelectItem value="account_manager">Account Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading && <p className="text-xs text-muted-foreground">Loading templates…</p>}

          {!isLoading && (planType || roleSlug) && templates.length === 0 && (
            <p className="text-xs text-amber-600">No active templates found for this selection.</p>
          )}

          {templates.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {templates.length} template{templates.length !== 1 ? "s" : ""} will be loaded
              </div>
              <div className="max-h-48 overflow-y-auto divide-y">
                {templates.map((t) => (
                  <div key={t.id} className="px-3 py-2 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{t.goal_title}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {t.goal_category}
                      </Badge>
                    </div>
                    {t.target_metric && (
                      <p className="text-[11px] text-muted-foreground">Target: {t.target_metric}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleLoad}
            disabled={templates.length === 0}
            data-testid="button-load-templates"
          >
            Load {templates.length > 0 ? `${templates.length} Template${templates.length !== 1 ? "s" : ""}` : "Templates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AnnexureEditor({ annexures, onChange, effectiveDate, goalPushDisabled, goalPushDisabledReason }: AnnexureEditorProps) {
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  function addAnnexure() {
    if (annexures.length >= MAX_ANNEXURES) return;
    onChange([...annexures, { title: "", body: "" }]);
  }

  function loadFromTemplates(templates: PlanGoalTemplate[]) {
    if (templates.length === 0) return;
    const planType = templates[0]?.plan_type || "probation";
    const roleSlug = templates[0]?.role_slug || "";
    const roleLabel = ROLE_SLUG_LABELS[roleSlug] || roleSlug;
    const planLabel = PLAN_TYPE_LABELS[planType] || planType;

    const rows: [string, string][] = templates.map(t => [
      t.goal_title,
      t.target_metric || t.goal_description || "",
    ]);

    const newAnnexure = {
      title: `${planLabel} — ${roleLabel} Goals`,
      body: "",
      table: {
        col1Header: "Goal",
        col2Header: "Target / Metric",
        rows,
      },
    };

    if (annexures.length < MAX_ANNEXURES) {
      const updated = [...annexures, newAnnexure];
      onChange(updated);
      setExpandedTables(prev => new Set(prev).add(updated.length - 1));
    } else {
      // Replace the last annexure
      const updated = annexures.map((ann, i) => i === annexures.length - 1 ? newAnnexure : ann);
      onChange(updated);
      setExpandedTables(prev => new Set(prev).add(annexures.length - 1));
    }
  }

  function removeAnnexure(idx: number) {
    setExpandedTables(prev => {
      const next = new Set<number>();
      prev.forEach(i => { if (i !== idx) next.add(i > idx ? i - 1 : i); });
      return next;
    });
    onChange(annexures.filter((_, i) => i !== idx));
  }

  function updateField(idx: number, field: "title" | "body", value: string) {
    onChange(annexures.map((ann, i) => i === idx ? { ...ann, [field]: value } : ann));
  }

  function addTable(idx: number) {
    onChange(annexures.map((ann, i) =>
      i === idx ? { ...ann, table: { col1Header: "", col2Header: "", rows: [] } } : ann
    ));
    setExpandedTables(prev => new Set(prev).add(idx));
  }

  function removeTable(idx: number) {
    onChange(annexures.map((ann, i) => {
      if (i !== idx) return ann;
      const { table: _t, goalPush: _gp, ...rest } = ann;
      return rest;
    }));
    setExpandedTables(prev => { const next = new Set(prev); next.delete(idx); return next; });
  }

  function updateTable(idx: number, table: AnnexureTable) {
    onChange(annexures.map((ann, i) => i === idx ? { ...ann, table } : ann));
  }

  function updateGoalPush(idx: number, goalPush: AnnexureGoalPush | undefined) {
    onChange(annexures.map((ann, i) => {
      if (i !== idx) return ann;
      if (!goalPush) {
        const { goalPush: _gp, ...rest } = ann;
        return rest;
      }
      return { ...ann, goalPush };
    }));
  }

  function toggleTable(idx: number) {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <Separator />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Annexures</p>
          <p className="text-xs text-muted-foreground">
            Attach up to {MAX_ANNEXURES} extra sections — each appended as a new page in the document.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowTemplateDialog(true)}
            className="text-xs text-blue-600 hover:text-blue-800"
            data-testid="btn-load-from-template"
          >
            <BookOpen className="h-3 w-3 mr-1" /> Load from Template
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addAnnexure}
            disabled={annexures.length >= MAX_ANNEXURES}
            data-testid="btn-add-annexure"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Annexure
          </Button>
        </div>
      </div>

      <LoadFromTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        onLoad={loadFromTemplates}
      />

      {annexures.length > 0 && (
        <div className="space-y-3">
          {annexures.map((ann, idx) => (
            <div
              key={idx}
              className="border rounded-lg p-3 space-y-2 bg-muted/30"
              data-testid={`annexure-card-${idx}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">
                  Annexure {LABELS[idx]}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeAnnexure(idx)}
                  data-testid={`btn-remove-annexure-${idx}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              <div>
                <Label className="text-xs">Title *</Label>
                <Input
                  value={ann.title}
                  onChange={e => updateField(idx, "title", e.target.value)}
                  placeholder="e.g. 90-Day Growth Review Plan"
                  data-testid={`input-annexure-title-${idx}`}
                />
              </div>

              <div>
                <Label className="text-xs">Body text</Label>
                <Textarea
                  value={ann.body}
                  onChange={e => updateField(idx, "body", e.target.value)}
                  placeholder="Freeform content for this annexure. Line breaks are preserved."
                  rows={4}
                  data-testid={`input-annexure-body-${idx}`}
                />
              </div>

              {/* Table section */}
              {ann.table ? (
                <div className="space-y-1">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                    onClick={() => toggleTable(idx)}
                    data-testid={`btn-toggle-table-${idx}`}
                  >
                    <Table2 className="h-3 w-3" />
                    Table
                    {ann.goalPush?.enabled && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                        <Target className="h-2.5 w-2.5" />
                        {ann.goalPush.selectedRows.length} goal{ann.goalPush.selectedRows.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {expandedTables.has(idx)
                      ? <ChevronUp className="h-3 w-3" />
                      : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {expandedTables.has(idx) && (
                    <TableEditor
                      table={ann.table}
                      onChange={t => updateTable(idx, t)}
                      onRemove={() => removeTable(idx)}
                      annexureIdx={idx}
                      goalPush={ann.goalPush}
                      onGoalPushChange={gp => updateGoalPush(idx, gp)}
                      effectiveDate={effectiveDate}
                      goalPushDisabled={goalPushDisabled}
                      goalPushDisabledReason={goalPushDisabledReason}
                    />
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-dashed text-blue-600 hover:text-blue-800"
                  onClick={() => addTable(idx)}
                  data-testid={`btn-add-table-${idx}`}
                >
                  <Table2 className="h-3 w-3 mr-1" /> Add Table
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
