import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

export type SaveState = "idle" | "saving" | "saved" | "error";

const LS_KEY = "hr_letter_draft_id";
const DEBOUNCE_MS = 800;

function readDraftIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("draftId");
}

function writeDraftIdToUrl(draftId: string | null) {
  const url = new URL(window.location.href);
  if (draftId) {
    url.searchParams.set("draftId", draftId);
  } else {
    url.searchParams.delete("draftId");
  }
  window.history.replaceState({}, "", url.toString());
}

export interface RehydratedLetter {
  id: string;
  templateType: string;
  status: string;
  revisionReason: string | null;
  draftData: Record<string, unknown> | null;
}

export function useDraft() {
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [rehydratedLetter, setRehydratedLetter] = useState<RehydratedLetter | null>(null);
  const [isRehydrating, setIsRehydrating] = useState(false);

  const draftIdRef = useRef<string | null>(null);
  const pendingCreate = useRef<Promise<string> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync so async callbacks always see latest draftId
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  // On mount, check URL + localStorage for an existing draft to restore
  useEffect(() => {
    const urlId = readDraftIdFromUrl();
    const lsId = localStorage.getItem(LS_KEY);
    const id = urlId || lsId;
    if (!id) return;

    setIsRehydrating(true);
    fetch(`/api/hr/letters/${id}`, { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((letter: RehydratedLetter) => {
        if (["issued", "reissued", "revoked"].includes(letter.status)) {
          clearDraftState();
          return;
        }
        draftIdRef.current = letter.id;
        setDraftId(letter.id);
        writeDraftIdToUrl(letter.id);
        localStorage.setItem(LS_KEY, letter.id);
        setRehydratedLetter(letter);
      })
      .catch(() => {
        clearDraftState();
      })
      .finally(() => setIsRehydrating(false));
  }, []);

  function clearDraftState() {
    localStorage.removeItem(LS_KEY);
    writeDraftIdToUrl(null);
    draftIdRef.current = null;
    setDraftId(null);
    setRehydratedLetter(null);
  }

  async function ensureDraftId(templateType: string): Promise<string> {
    const current = draftIdRef.current;
    if (current) return current;

    if (pendingCreate.current) {
      return pendingCreate.current;
    }

    pendingCreate.current = apiRequest("POST", "/api/hr/letters/new-draft", { templateType })
      .then(r => r.json())
      .then((data: { id: string }) => {
        const id = data.id;
        draftIdRef.current = id;
        setDraftId(id);
        writeDraftIdToUrl(id);
        localStorage.setItem(LS_KEY, id);
        pendingCreate.current = null;
        return id;
      })
      .catch(err => {
        pendingCreate.current = null;
        throw err;
      });

    return pendingCreate.current;
  }

  // Use a ref for saveDraft so callers always get the latest without stale closures
  const saveDraftRef = useRef<(templateType: string, data: Record<string, unknown>, step: number) => void>();

  saveDraftRef.current = (templateType: string, data: Record<string, unknown>, step: number) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        const id = await ensureDraftId(templateType);
        await apiRequest("PATCH", `/api/hr/letters/${id}/draft`, { ...data, _step: step });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      } catch {
        setSaveState("error");
      }
    }, DEBOUNCE_MS);
  };

  const saveDraft = useCallback((templateType: string, data: Record<string, unknown>, step: number) => {
    saveDraftRef.current?.(templateType, data, step);
  }, []);

  const discardDraft = useCallback(async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const id = draftIdRef.current;
    clearDraftState();
    if (id) {
      try {
        await apiRequest("DELETE", `/api/hr/letters/${id}`, undefined);
      } catch {
        // silently ignore — local state is already cleared
      }
    }
  }, []);

  const clearDraft = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    clearDraftState();
  }, []);

  return {
    draftId,
    saveState,
    rehydratedLetter,
    isRehydrating,
    saveDraft,
    discardDraft,
    clearDraft,
  };
}
