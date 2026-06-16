import { useQuery } from "@tanstack/react-query";

interface MyPermissions {
  role: string;
  permissions: string[];
  dbDriven: boolean;
}

/**
 * Exposes the current user's effective feature permissions (resolved from the
 * live DB matrix when DB-driven RBAC is on, otherwise the config defaults).
 *
 * `can(featureKey)` returns true while permissions are still loading so gated
 * UI never flashes hidden on first paint; once loaded it reflects the matrix.
 */
export function usePermissions() {
  const { data, isLoading } = useQuery<MyPermissions>({
    queryKey: ["/api/me/permissions"],
    staleTime: 30000,
  });

  const allowed = data?.permissions;

  const can = (featureKey: string): boolean => {
    if (!allowed) return true; // not loaded yet — avoid hiding prematurely
    return allowed.includes(featureKey);
  };

  return {
    can,
    isLoading,
    role: data?.role,
    dbDriven: data?.dbDriven ?? false,
    permissions: allowed ?? [],
  };
}
