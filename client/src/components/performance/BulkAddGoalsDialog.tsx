import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, ClipboardPaste, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LoadFromTemplateDialog,
  ROLE_SLUG_LABELS,
  PLAN_TYPE_LABELS,
  type PlanGoalTemplate,
} from "@/components/performance/LoadFromTemplateDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface BulkGoalMember {
  userId: string;
  firstName: string;
  lastName: string;
}

interface BulkGoalRow {
  title: string;
  description: string;
}

const emptyRow = (): BulkGoalRow => ({ title: "", description: "" });

const MAX_ROWS = 30;

export function BulkAddGoalsDialog({
  open,
  onOpenChange,
  members,
  invalidateKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, a team-member selector is shown and a member must be chosen. */
  members?: BulkGoalMember[];
  /** Query key to invalidate after a successful save. */
  invalidateKey: string;
}) {
  const { toast } = useToast();
  const isTeamMode = Array.isArray(members);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [targetDate, setTargetDate] = useState("");
  const [rows, setRows] = useState<BulkGoalRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedUserId("");
      setStartDate(new Date().toISOString().split("T")[0]);
      setTargetDate("");
      setRows([emptyRow(), emptyRow(), emptyRow()]);
      setError(null);
      setShowTemplateDialog(false);
    }
  }, [open]);

  function loadFromTemplates(templates: PlanGoalTemplate[]) {
    if (templates.length === 0) return;
    const planType = templates[0]?.plan_type || "";
    const roleSlug = templates[0]?.role_slug || "";
    const planLabel = PLAN_TYPE_LABELS[planType] || planType;
    const roleLabel = ROLE_SLUG_LABELS[roleSlug] || roleSlug;

    const templateRows: BulkGoalRow[] = templates.map((t) => ({
      title: t.goal_title,
      description: t.target_metric || t.goal_description || "",
    }));

    setRows((prev) => {
      // Keep rows the user has already typed/loaded; drop blank placeholder rows.
      const existing = prev.filter((r) => r.title.trim() || r.description.trim());
      const combined = [...existing, ...templateRows];
      const capped = combined.slice(0, MAX_ROWS);
      const loaded = Math.max(0, capped.length - existing.length);

      if (combined.length > MAX_ROWS) {
        toast({
          title: `Loaded ${loaded} of ${templateRows.length} goals`,
          description: `Row limit of ${MAX_ROWS} reached — some template goals were not added.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: `Loaded ${loaded} goal${loaded === 1 ? "" : "s"} from template`,
          description: planLabel && roleLabel ? `${planLabel} — ${roleLabel}` : undefined,
        });
      }

      return capped.length > 0 ? capped : [emptyRow()];
    });
  }

  function updateRow(index: number, field: keyof BulkGoalRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length <= 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function handlePaste(e: React.ClipboardEvent, rowIndex: number, field: keyof BulkGoalRow) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const rawRows = text.trim().split(/\r?\n/);
    const parsed: BulkGoalRow[] = rawRows
      .map((line) => {
        const cols = line.split("\t");
        return { title: cols[0]?.trim() ?? "", description: cols[1]?.trim() ?? "" };
      })
      .filter((r) => r.title || r.description);
    if (parsed.length === 0) return;

    setRows((prev) => {
      const next = [...prev];
      // Spread the pasted rows starting at the row being pasted into.
      for (let i = 0; i < parsed.length; i++) {
        const target = rowIndex + i;
        if (target < next.length) {
          next[target] = parsed[i];
        } else {
          next.push(parsed[i]);
        }
      }
      return next.filter((r, idx) => r.title || r.description || idx === next.length - 1);
    });
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const goals = rows
        .map((r) => ({ title: r.title.trim(), description: r.description.trim() || undefined }))
        .filter((r) => r.title.length > 0);
      const body: Record<string, unknown> = {
        goals,
        startDate: startDate || undefined,
        targetDate: targetDate || undefined,
      };
      if (isTeamMode) body.employeeId = selectedUserId;
      const res = await apiRequest("POST", "/api/performance/goals/batch", body);
      return res.json() as Promise<{ created: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      toast({ title: `${data.created} goal${data.created === 1 ? "" : "s"} added` });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add goals", description: err.message, variant: "destructive" });
    },
  });

  function handleSubmit() {
    setError(null);
    if (isTeamMode && !selectedUserId) {
      setError("Please select a team member");
      return;
    }
    const validRows = rows.filter((r) => r.title.trim().length > 0);
    if (validRows.length === 0) {
      setError("Add at least one goal with a title");
      return;
    }
    if (startDate && targetDate && startDate > targetDate) {
      setError("Target date must be after start date");
      return;
    }
    createMutation.mutate();
  }

  const filledCount = rows.filter((r) => r.title.trim().length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <DialogTitle data-testid="text-bulk-goals-title">Add Multiple Goals</DialogTitle>
              <DialogDescription>
                Type rows or paste two columns from a spreadsheet — column 1 becomes the goal
                title and column 2 the description.
              </DialogDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowTemplateDialog(true)}
              className="shrink-0 text-xs text-blue-600 hover:text-blue-800"
              data-testid="button-load-from-template"
            >
              <BookOpen className="h-3.5 w-3.5 mr-1" /> Load from Template
            </Button>
          </div>
        </DialogHeader>

        <LoadFromTemplateDialog
          open={showTemplateDialog}
          onOpenChange={setShowTemplateDialog}
          onLoad={loadFromTemplates}
        />

        <div className="space-y-4">
          {isTeamMode && (
            <div className="space-y-2">
              <Label>Team Member *</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger data-testid="select-bulk-team-member">
                  <SelectValue placeholder="Select a team member" />
                </SelectTrigger>
                <SelectContent>
                  {members!.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.firstName} {m.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-start-date">Start Date</Label>
              <Input
                id="bulk-start-date"
                data-testid="input-bulk-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-target-date">Target Date</Label>
              <Input
                id="bulk-target-date"
                data-testid="input-bulk-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClipboardPaste className="h-3.5 w-3.5" />
              <span>Paste tab-separated rows from Excel to auto-fill the table.</span>
            </div>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left font-medium px-3 py-2 w-[40%]">Goal Title</th>
                    <th className="text-left font-medium px-3 py-2">Description</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t" data-testid={`row-bulk-goal-${i}`}>
                      <td className="px-2 py-1.5 align-top">
                        <Input
                          data-testid={`input-bulk-title-${i}`}
                          value={row.title}
                          onChange={(e) => updateRow(i, "title", e.target.value)}
                          onPaste={(e) => handlePaste(e, i, "title")}
                          placeholder="e.g., Complete AWS Certification"
                          className="h-8"
                        />
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <Input
                          data-testid={`input-bulk-description-${i}`}
                          value={row.description}
                          onChange={(e) => updateRow(i, "description", e.target.value)}
                          onPaste={(e) => handlePaste(e, i, "description")}
                          placeholder="Optional detail or target"
                          className="h-8"
                        />
                      </td>
                      <td className="px-1 py-1.5 align-top text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeRow(i)}
                          data-testid={`button-remove-bulk-row-${i}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" onClick={addRow} data-testid="button-add-bulk-row">
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </Button>
          </div>

          {error && <p className="text-xs text-red-600" data-testid="text-bulk-error">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-bulk-goals">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            data-testid="button-save-bulk-goals"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Add {filledCount > 0 ? filledCount : ""} Goal{filledCount === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
