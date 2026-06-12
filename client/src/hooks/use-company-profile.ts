import { useQuery } from "@tanstack/react-query";
import { DEFAULT_COMPANY_PROFILE, type CompanyProfile } from "@shared/companyProfile";

export function useCompanyProfile(): CompanyProfile {
  const { data } = useQuery<CompanyProfile>({
    queryKey: ["/api/company-profile"],
    placeholderData: DEFAULT_COMPANY_PROFILE,
    staleTime: 60000,
  });
  return data ?? DEFAULT_COMPANY_PROFILE;
}
