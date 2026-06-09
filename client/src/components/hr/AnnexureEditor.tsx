import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export interface AnnexureItem {
  title: string;
  body: string;
}

const LABELS = ["A", "B", "C", "D", "E"];
const MAX_ANNEXURES = 5;

interface AnnexureEditorProps {
  annexures: AnnexureItem[];
  onChange: (annexures: AnnexureItem[]) => void;
}

export function AnnexureEditor({ annexures, onChange }: AnnexureEditorProps) {
  function addAnnexure() {
    if (annexures.length >= MAX_ANNEXURES) return;
    onChange([...annexures, { title: "", body: "" }]);
  }

  function removeAnnexure(idx: number) {
    onChange(annexures.filter((_, i) => i !== idx));
  }

  function updateAnnexure(idx: number, field: keyof AnnexureItem, value: string) {
    const updated = annexures.map((ann, i) =>
      i === idx ? { ...ann, [field]: value } : ann
    );
    onChange(updated);
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
                  onChange={e => updateAnnexure(idx, "title", e.target.value)}
                  placeholder="e.g. 90-Day Growth Review Plan"
                  data-testid={`input-annexure-title-${idx}`}
                />
              </div>
              <div>
                <Label className="text-xs">Body *</Label>
                <Textarea
                  value={ann.body}
                  onChange={e => updateAnnexure(idx, "body", e.target.value)}
                  placeholder="Freeform content for this annexure. Line breaks are preserved."
                  rows={5}
                  data-testid={`input-annexure-body-${idx}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
