import { useQuery } from "@tanstack/react-query";

interface FeatureFlags {
  notifications_enabled: boolean;
  document_reminder_email_enabled: boolean;
  esign_docusign_flow: boolean;
  new_look: boolean;
  process_governance: boolean;
  [key: string]: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  notifications_enabled: false,
  document_reminder_email_enabled: false,
  esign_docusign_flow: false,
  new_look: false,
  process_governance: false,
};

export function useFeatureFlags() {
  const { data: flags, isLoading } = useQuery<FeatureFlags>({
    queryKey: ["/api/system/feature-flags"],
    staleTime: 30000,
  });

  const isEnabled = (flagName: string): boolean => {
    if (!flags) return false;
    return flags[flagName] === true;
  };

  return {
    flags: flags || DEFAULT_FLAGS,
    isLoading,
    isEnabled,
  };
}
