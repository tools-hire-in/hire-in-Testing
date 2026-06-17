import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, CheckCircle2, AlertCircle } from "lucide-react";

interface AnnexureContent {
  key: string;
  label: string;
  title: string;
  body: string;
}

const POLICY_ANNEXURE_LABELS: Record<string, string> = {
  leave_policy: "Annexure A — Leave Policy",
  attendance_policy: "Annexure B — Attendance & Regularization Policy",
  code_of_conduct: "Annexure C — Code of Conduct",
  nda: "Annexure D — Confidentiality & Non-Disclosure Agreement",
};

export interface AnnexureInitialingProps {
  annexureKeys: string[];
  initials: Record<string, string>;
  onInitialChange: (key: string, value: string) => void;
}

/**
 * AnnexureInitialing — interactive, self-contained policy-annexure review +
 * initialing control. Lives at the point of acceptance so a candidate can see
 * exactly which annexures still need initialing, open each to read it, and
 * enter their initials without hunting through the document above.
 */
export function AnnexureInitialing({ annexureKeys, initials, onInitialChange }: AnnexureInitialingProps) {
  const [contentMap, setContentMap] = useState<Record<string, AnnexureContent>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [viewedKeys, setViewedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (annexureKeys.length === 0) return;
    fetch("/api/annexure-content")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: AnnexureContent[]) => {
        const map: Record<string, AnnexureContent> = {};
        for (const item of data) map[item.key] = item;
        setContentMap(map);
      })
      .catch(() => {});
  }, [annexureKeys.length]);

  const openAnnexure = (key: string) => {
    setOpenKey(key);
    setViewedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const openContent = openKey ? contentMap[openKey] : null;

  const total = annexureKeys.length;
  const doneCount = annexureKeys.filter((k) => (initials[k] ?? "").trim().length > 0).length;
  const allDone = doneCount === total;

  return (
    <div
      className="rounded-lg border border-blue-200 bg-white p-4 space-y-3"
      data-testid="section-annexure-initialing"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-900 flex items-center gap-2">
            {allDone ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            )}
            Review &amp; Initial Each Policy Annexure
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Open each annexure to read it in full, then enter your initials to confirm you have
            reviewed it. All annexures must be initialed before you can accept.
          </p>
        </div>
        <span
          className="text-xs font-semibold whitespace-nowrap rounded-full px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-100"
          data-testid="text-annexure-progress"
        >
          {doneCount} of {total} initialed
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {annexureKeys.map((key) => {
          const viewed = viewedKeys.includes(key);
          const value = initials[key] ?? "";
          const done = value.trim().length > 0;
          const canInitial = viewed || done;
          return (
            <div
              key={key}
              className="flex flex-col gap-2 rounded-md border border-blue-100 bg-blue-50/40 px-3 py-2 sm:flex-row sm:items-center sm:gap-3"
              data-testid={`row-accept-annexure-${key}`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" data-testid={`icon-done-annexure-${key}`} />
                ) : (
                  <span
                    className="h-4 w-4 rounded-full border-2 border-amber-400 shrink-0"
                    data-testid={`icon-outstanding-annexure-${key}`}
                  />
                )}
                <span className="text-sm font-medium text-foreground truncate">
                  {POLICY_ANNEXURE_LABELS[key] ?? key}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => openAnnexure(key)}
                  data-testid={`button-review-annexure-${key}`}
                >
                  <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                  {canInitial ? "Re-read" : "Review"}
                </Button>
                <Input
                  value={value}
                  onChange={(e) => onInitialChange(key, e.target.value)}
                  disabled={!canInitial}
                  maxLength={8}
                  placeholder={canInitial ? "Initials" : "Review first"}
                  className="h-8 w-28 text-sm"
                  data-testid={`input-accept-annexure-initials-${key}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={openKey !== null} onOpenChange={(o) => { if (!o) setOpenKey(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-accept-annexure-content">
          <DialogHeader>
            <DialogTitle data-testid="text-accept-annexure-dialog-title">
              {openContent?.title ?? (openKey ? POLICY_ANNEXURE_LABELS[openKey] ?? "Policy Annexure" : "")}
            </DialogTitle>
          </DialogHeader>
          {openContent ? (
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed" data-testid="text-accept-annexure-dialog-body">
              {openContent.body}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {openKey && (
            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-sm font-medium text-foreground" htmlFor={`dialog-initials-${openKey}`}>
                Enter your initials to confirm you have read this annexure
              </label>
              <Input
                id={`dialog-initials-${openKey}`}
                value={initials[openKey] ?? ""}
                onChange={(e) => onInitialChange(openKey, e.target.value)}
                maxLength={8}
                placeholder="Initials"
                className="h-9 w-32 text-sm"
                data-testid={`input-dialog-annexure-initials-${openKey}`}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
