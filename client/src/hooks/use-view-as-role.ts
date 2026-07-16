import { useCallback } from "react";

export type AppRole =
  | "super_admin"
  | "admin"
  | "hr"
  | "operations"
  | "manager"
  | "recruiter"
  | "employee"
  | "finance"
  | "executive";

const STORAGE_KEY = "devtools:viewAsRole";

function readViewAsRole(): AppRole | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return v ? (v as AppRole) : null;
  } catch {
    return null;
  }
}

function writeViewAsRole(role: AppRole | null): void {
  try {
    if (role === null) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, role);
    }
  } catch {}
}

export function useViewAsRole(realRole: string | undefined) {
  const canOverride = realRole === "super_admin" || realRole === "admin";

  const viewAsRole: AppRole | null = canOverride ? readViewAsRole() : null;

  const setViewAsRole = useCallback(
    (role: AppRole) => {
      if (!canOverride) return;
      writeViewAsRole(role);
    },
    [canOverride]
  );

  const clearViewAsRole = useCallback(() => {
    writeViewAsRole(null);
  }, []);

  return { viewAsRole, setViewAsRole, clearViewAsRole };
}
