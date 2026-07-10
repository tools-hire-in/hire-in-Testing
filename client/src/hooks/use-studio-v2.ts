import { useFeatureFlags } from "@/hooks/use-feature-flags";

/**
 * Studio v2 gate (Task #906): the standalone /studio shell and the planning
 * pipeline ship behind the `studio_v2_enabled` feature flag. Flag OFF means
 * the classic /admin/studio experience is completely unchanged.
 */
export function useStudioV2() {
  const { isEnabled, isLoading } = useFeatureFlags();
  return {
    enabled: isEnabled("studio_v2_enabled"),
    isLoading,
  };
}
