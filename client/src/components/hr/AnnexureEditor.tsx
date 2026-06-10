import { useState } from "react";
import { Plus, Trash2, Table2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export interface AnnexureTable {
  col1Header: string;
  col2Header: string;
  rows: [string, string][];
}

export interface AnnexureItem {
  title: string;
  body: string;
  table?: AnnexureTable;
}

const LABELS = ["A", "B", "C", "D", "E"];
const MAX_ANNEXURES = 5;

interface AnnexureEditorProps {
  annexures: AnnexureItem[];
  onChange: (annexures: AnnexureItem[]) => void;
}

function TableEditor({
  table,
  onChange,
  onRemove,
  annexureIdx,
}: {
  table: AnnexureTable;
  onChange: (t: AnnexureTable) => void;
  onRemove: () => void;
  annexureIdx: number;
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
    onChange({ ...table, rows: table.rows.filter((_, i) => i !== rowIdx) });
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
    // If the first row looks like headers (no existing headers set), use as headers
    let newHeaders = { col1Header: table.col1Header, col2Header: table.col2Header };
    let dataRows = parsed;
    if (!table.col1Header && !table.col2Header && parsed.length > 1) {
      newHeaders = { col1Header: parsed[0][0], col2Header: parsed[0][1] };
      dataRows = parsed.slice(1);
    }
    onChange({ ...newHeaders, rows: [...table.rows, ...dataRows] });
  }

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
    </div>
  );
}

export function AnnexureEditor({ annexures, onChange }: AnnexureEditorProps) {
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());

  function addAnnexure() {
    if (annexures.length >= MAX_ANNEXURES) return;
    onChange([...annexures, { title: "", body: "" }]);
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
      const { table: _t, ...rest } = ann;
      return rest;
    }));
    setExpandedTables(prev => { const next = new Set(prev); next.delete(idx); return next; });
  }

  function updateTable(idx: number, table: AnnexureTable) {
    onChange(annexures.map((ann, i) => i === idx ? { ...ann, table } : ann));
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
