import { useCallback } from "react";

const DRAFT_PREFIX = "letter_draft_";

export interface DraftLetterState {
  templateType: string;
  employeeName?: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  performanceBand?: string;
  conductBand?: string;
  completionBand?: string;
  closingLine?: string;
  signatoryName?: string;
  signatoryDesignation?: string;
  [key: string]: unknown;
}

export function useDraftLetter(scope: string) {
  const key = `${DRAFT_PREFIX}${scope}`;

  const readDraft = useCallback((): DraftLetterState | null => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as DraftLetterState) : null;
    } catch {
      return null;
    }
  }, [key]);

  const saveDraft = useCallback((state: DraftLetterState) => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {}
  }, [key]);

  return { readDraft, saveDraft, clearDraft };
}
