import { useState, useEffect } from "react";
import { AlertCircle, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const BANNER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function makeDismissKey(employeeId: string, changeType: string, effectiveDate: string) {
  return `amendment_banner_dismissed:${employeeId}:${changeType}:${effectiveDate}`;
}

function isDismissed(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const { at } = JSON.parse(raw);
    return Date.now() - at < BANNER_TTL_MS;
  } catch {
    return false;
  }
}

function dismiss(key: string) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now() }));
  } catch {}
}

interface AmendmentSuggestionBannerProps {
  employeeId: string;
  changeType: "salary_revision" | "role_change" | "combined";
  effectiveDate: string;
  prefill?: {
    oldSalary?: number | null;
    newSalary?: number | null;
    oldDesignation?: string | null;
    newDesignation?: string | null;
  };
  onNavigateToLetterGenerator?: () => void;
}

export function AmendmentSuggestionBanner({
  employeeId,
  changeType,
  effectiveDate,
  prefill,
  onNavigateToLetterGenerator,
}: AmendmentSuggestionBannerProps) {
  const key = makeDismissKey(employeeId, changeType, effectiveDate);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!isDismissed(key));
  }, [key]);

  if (!visible) return null;

  const handleDismiss = () => {
    dismiss(key);
    setVisible(false);
  };

  const labelMap: Record<string, string> = {
    salary_revision: "Salary Revision Letter",
    role_change: "Role / Designation Change Letter",
    combined: "Combined (Salary + Role) Letter",
  };

  const fmtINR = (v: number | null | undefined) =>
    v != null ? `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : null;

  const salaryDetail =
    prefill?.oldSalary != null && prefill?.newSalary != null
      ? `${fmtINR(prefill.oldSalary)} → ${fmtINR(prefill.newSalary)}`
      : null;

  const designationDetail =
    prefill?.oldDesignation && prefill?.newDesignation
      ? `${prefill.oldDesignation} → ${prefill.newDesignation}`
      : null;

  const handleNavigate = () => {
    const params = new URLSearchParams({ tab: "letter-generator", prefillType: changeType });
    if (employeeId) params.set("prefillEmployeeId", employeeId);
    if (effectiveDate) params.set("prefillEffective", effectiveDate);
    if (prefill?.newSalary != null) params.set("prefillNewSalary", String(prefill.newSalary));
    if (prefill?.oldSalary != null) params.set("prefillOldSalary", String(prefill.oldSalary));
    if (prefill?.newDesignation) params.set("prefillNewDesignation", prefill.newDesignation);
    if (prefill?.oldDesignation) params.set("prefillOldDesignation", prefill.oldDesignation);

    try {
      sessionStorage.setItem("letter_editor_prefill", JSON.stringify({
        templateType: changeType,
        employeeId,
        effectiveDate,
        newSalary: prefill?.newSalary != null ? String(prefill.newSalary) : "",
        oldSalary: prefill?.oldSalary != null ? String(prefill.oldSalary) : "",
        newDesignation: prefill?.newDesignation || "",
        oldDesignation: prefill?.oldDesignation || "",
      }));
    } catch {}

    if (onNavigateToLetterGenerator) {
      onNavigateToLetterGenerator();
    } else {
      window.location.href = `/admin/hr/tools?${params.toString()}`;
    }
  };

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-3 text-sm"
      data-testid="banner-amendment-suggestion"
    >
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-amber-800 dark:text-amber-300">Generate an amendment letter</p>
        <p className="text-amber-700 dark:text-amber-400 mt-0.5">
          This change typically requires a <strong>{labelMap[changeType] ?? "Amendment Letter"}</strong>.
          {salaryDetail && <span className="ml-1 font-mono text-xs">({salaryDetail})</span>}
          {designationDetail && <span className="ml-1 italic text-xs">({designationDetail})</span>}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
          onClick={handleNavigate}
          data-testid="button-go-to-letter-generator"
        >
          <FileText className="h-3 w-3 mr-1" />
          Open Letter Generator
        </Button>
      </div>
      <button
        onClick={handleDismiss}
        className="text-amber-500 hover:text-amber-700 dark:text-amber-400 shrink-0"
        aria-label="Dismiss"
        data-testid="button-dismiss-amendment-banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
