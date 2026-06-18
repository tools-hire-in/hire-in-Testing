import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, CheckCircle2, AlertCircle, Check } from "lucide-react";

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
  /** When provided (DocuSign flow ON), auto-fills each initials field and enables auto-advance. */
  presetInitials?: string;
  /** Called after the final annexure is confirmed in auto-advance mode. */
  onAllConfirmed?: () => void;
}

/**
 * AnnexureInitialing — interactive, self-contained policy-annexure review +
 * initialing control. Lives at the point of acceptance so a candidate can see
 * exactly which annexures still need initialing, open each to read it, and
 * enter their initials without hunting through the document above.
 *
 * When `presetInitials` is provided (DocuSign flow), each field is auto-filled,
 * a Confirm button appears, and focus/scroll auto-advances to the next row
 * after confirmation.
 */
export function AnnexureInitialing({
  annexureKeys,
  initials,
  onInitialChange,
  presetInitials,
  onAllConfirmed,
}: AnnexureInitialingProps) {
  const [contentMap, setContentMap] = useState<Record<string, AnnexureContent>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [viewedKeys, setViewedKeys] = useState<string[]>([]);
  const [confirmedKeys, setConfirmedKeys] = useState<string[]>([]);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isDocuSignMode = !!presetInitials;

  // Auto-fill all initials when preset is provided
  useEffect(() => {
    if (!presetInitials) return;
    for (const key of annexureKeys) {
      if (!(initials[key] ?? "").trim()) {
        onInitialChange(key, presetInitials);
      }
    }
  }, [presetInitials, annexureKeys]);

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

  const handleConfirm = (key: string) => {
    if (confirmedKeys.includes(key)) return;
    // Enforce sequential order: only the current "next" annexure may be confirmed
    const expectedIdx = confirmedKeys.length;
    if (annexureKeys.indexOf(key) !== expectedIdx) return;

    const newConfirmed = [...confirmedKeys, key];
    setConfirmedKeys(newConfirmed);

    const nextKey = annexureKeys[newConfirmed.length]; // next unconfirmed key (undefined if done)

    if (nextKey) {
      setTimeout(() => {
        const nextEl = rowRefs.current[nextKey];
        if (nextEl) {
          nextEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }

    // All confirmed when every key is in the list
    if (newConfirmed.length === annexureKeys.length) {
      setTimeout(() => {
        onAllConfirmed?.();
      }, 300);
    }
  };

  const openContent = openKey ? contentMap[openKey] : null;

  const total = annexureKeys.length;
  const doneCount = isDocuSignMode
    ? confirmedKeys.length
    : annexureKeys.filter((k) => (initials[k] ?? "").trim().length > 0).length;
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
            {isDocuSignMode
              ? "Your initials have been pre-filled. Click Confirm on each annexure to proceed."
              : "Open each annexure to read it in full, then enter your initials to confirm you have reviewed it. All annexures must be initialed before you can accept."}
          </p>
        </div>
        <span
          className="text-xs font-semibold whitespace-nowrap rounded-full px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-100"
          data-testid="text-annexure-progress"
        >
          {doneCount} of {total} {isDocuSignMode ? "confirmed" : "initialed"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {annexureKeys.map((key, idx) => {
          const viewed = viewedKeys.includes(key);
          const value = initials[key] ?? "";
          const done = isDocuSignMode ? confirmedKeys.includes(key) : value.trim().length > 0;
          const canInitial = isDocuSignMode ? true : (viewed || done);
          const isNext = isDocuSignMode && !done && confirmedKeys.length === idx;

          return (
            <div
              key={key}
              ref={(el) => { rowRefs.current[key] = el; }}
              className={`flex flex-col gap-2 rounded-md border px-3 py-2 transition-all sm:flex-row sm:items-center sm:gap-3 ${
                done
                  ? "border-green-200 bg-green-50/40"
                  : isNext
                  ? "border-blue-300 bg-blue-50 shadow-sm"
                  : "border-blue-100 bg-blue-50/40"
              }`}
              data-testid={`row-accept-annexure-${key}`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" data-testid={`icon-done-annexure-${key}`} />
                ) : (
                  <span
                    className={`h-4 w-4 rounded-full border-2 shrink-0 ${isNext ? "border-blue-500" : "border-amber-400"}`}
                    data-testid={`icon-outstanding-annexure-${key}`}
                  />
                )}
                <span className="text-sm font-medium text-foreground truncate">
                  {POLICY_ANNEXURE_LABELS[key] ?? key}
                </span>
                {isNext && !isDocuSignMode && (
                  <span className="text-xs text-blue-600 font-semibold shrink-0">← Next</span>
                )}
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
                  {canInitial || isDocuSignMode ? "Re-read" : "Review"}
                </Button>
                {isDocuSignMode ? (
                  done ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-700 px-2">
                      <Check className="h-3.5 w-3.5" /> Confirmed
                    </span>
                  ) : isNext ? (
                    // Only the current sequential row gets an active Confirm button
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => handleConfirm(key)}
                      data-testid={`button-confirm-annexure-${key}`}
                    >
                      Confirm
                    </Button>
                  ) : (
                    // Rows ahead in the sequence are locked until their turn
                    <span className="flex items-center gap-1 text-xs text-muted-foreground px-2" data-testid={`text-locked-annexure-${key}`}>
                      <span className="h-3.5 w-3.5 rounded-full bg-slate-200 inline-block" />
                      Pending
                    </span>
                  )
                ) : (
                  <Input
                    value={value}
                    onChange={(e) => onInitialChange(key, e.target.value)}
                    disabled={!canInitial}
                    maxLength={8}
                    placeholder={canInitial ? "Initials" : "Review first"}
                    className="h-8 w-28 text-sm"
                    data-testid={`input-accept-annexure-initials-${key}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && value.trim()) {
                        const currentIdx = annexureKeys.indexOf(key);
                        const nextKey = annexureKeys[currentIdx + 1];
                        if (nextKey) {
                          const nextEl = rowRefs.current[nextKey];
                          if (nextEl) {
                            nextEl.scrollIntoView({ behavior: "smooth", block: "center" });
                            const input = nextEl.querySelector("input");
                            if (input) (input as HTMLInputElement).focus();
                          }
                        }
                      }
                    }}
                  />
                )}
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
          {openKey && !isDocuSignMode && (
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
          {openKey && isDocuSignMode && (
            <div className="border-t pt-4 flex justify-end">
              <Button
                onClick={() => {
                  handleConfirm(openKey);
                  setOpenKey(null);
                }}
                disabled={confirmedKeys.includes(openKey) || annexureKeys.indexOf(openKey) !== confirmedKeys.length}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid={`button-dialog-confirm-annexure-${openKey}`}
              >
                <Check className="h-4 w-4 mr-1" />
                {confirmedKeys.includes(openKey) ? "Already Confirmed" : "Confirm & Close"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
