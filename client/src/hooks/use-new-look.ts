import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, type AuthUser, type UserPreferences } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

/**
 * App redesign (v2) opt-in — two-tier rollout gate.
 *
 * Tier 1 (admin master switch): the global `new_look` feature flag controls
 * whether the new look is *available* in this environment at all. Admins flip
 * it from HR Settings. When OFF, nobody can opt in and everyone sees classic
 * — this also acts as an instant kill-switch for prod.
 *
 * Tier 2 (per-user opt-in): the per-user preference
 * (admin_users.preferences.newLook) lets each user opt in for themselves, and
 * follows them across devices. The "Try the new look" control is only shown
 * once the admin master switch is ON.
 *
 * `enabled` (master ON AND user opted in) is the single signal every v2
 * surface should gate on. Defaults to OFF — the classic layout renders
 * unchanged until the rollout is enabled and a user opts in.
 */
export function useNewLook() {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const queryClient = useQueryClient();

  const available = isEnabled("new_look");
  const optedIn = user?.preferences?.newLook === true;
  const enabled = available && optedIn;

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await apiRequest("PATCH", "/api/auth/me/preferences", {
        newLook: next,
      });
      return (await res.json()) as { preferences: UserPreferences | null };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<AuthUser | null>(["/api/auth/me"], (prev) =>
        prev ? { ...prev, preferences: data.preferences } : prev,
      );
    },
  });

  return {
    available,
    optedIn,
    enabled,
    setEnabled: (next: boolean) => mutation.mutate(next),
    toggle: () => mutation.mutate(!enabled),
    isPending: mutation.isPending,
  };
}
