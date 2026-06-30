import { useQuery } from "@tanstack/react-query";

/**
 * Process Governance Center access — two-tier rollout gate (Task #660).
 *
 * Tier 1 (master switch): the global `process_governance` feature flag controls
 * whether the SOP / Process Governance Center is available in this environment
 * at all. Admins flip it from HR Settings. When OFF, nobody sees it.
 *
 * Tier 2 (rollout scope): `process_governance_rollout` =
 * { mode: 'pilot'|'all', roles[], userIds[] } scopes who gets access while the
 * master switch is ON. super_admin/admin always have access.
 *
 * The server resolves both tiers and returns the effective decision so the
 * client never has to re-implement the gate. `enabled` is the single signal
 * every SOP surface gates on; `canManage` additionally requires a management
 * role for create/edit affordances.
 */
export interface SopRolloutScope {
  mode: "pilot" | "all";
  roles: string[];
  userIds: string[];
}

export interface SopAccess {
  masterOn: boolean;
  enabled: boolean;
  canManage: boolean;
  rollout: SopRolloutScope;
}

export function useSopAccess() {
  const { data, isLoading } = useQuery<SopAccess>({
    queryKey: ["/api/sops/access"],
    staleTime: 30000,
  });

  return {
    masterOn: data?.masterOn ?? false,
    enabled: data?.enabled ?? false,
    canManage: data?.canManage ?? false,
    rollout: data?.rollout ?? { mode: "pilot", roles: [], userIds: [] },
    isLoading,
  };
}
