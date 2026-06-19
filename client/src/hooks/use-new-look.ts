import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, type AuthUser, type UserPreferences } from "@/hooks/use-auth";

/**
 * App redesign (v2) opt-in.
 *
 * The "new look" preference is persisted per-user in the database
 * (admin_users.preferences.newLook) so it follows the user across
 * devices. Defaults to OFF — the classic layout renders unchanged
 * until a user explicitly opts in.
 */
export function useNewLook() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const enabled = user?.preferences?.newLook === true;

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
    enabled,
    setEnabled: (next: boolean) => mutation.mutate(next),
    toggle: () => mutation.mutate(!enabled),
    isPending: mutation.isPending,
  };
}
