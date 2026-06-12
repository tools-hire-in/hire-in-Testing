import { z } from "zod";

// ==========================================
// COMPANY PROFILE — single source of truth for company identity
// and federal government-contracting credentials.
//
// Stored in the database under the system_settings key "company_profile".
// The DEFAULT_COMPANY_PROFILE below mirrors the seed values in
// client/src/lib/constants.ts (COMPANY / CONTACT) and is used as the
// fallback whenever no DB record exists, so the site never shows blanks.
// ==========================================

export const naicsCodeSchema = z.object({
  code: z.string().min(1, "NAICS code is required"),
  label: z.string().default(""),
});

export const certificationSchema = z.object({
  name: z.string().min(1, "Certification name is required"),
  issuingBody: z.string().default(""),
});

export const companyAddressSchema = z.object({
  street: z.string().default(""),
  city: z.string().default(""),
  state: z.string().default(""),
  zip: z.string().default(""),
  country: z.string().default(""),
});

export const samStatusSchema = z.object({
  active: z.boolean().default(false),
  expirationDate: z.string().default(""),
});

export const companyContactSchema = z.object({
  main: z.string().default(""),
  healthcare: z.string().default(""),
  it: z.string().default(""),
});

export const companyEmailsSchema = z.object({
  general: z.string().default(""),
  careers: z.string().default(""),
});

export const companyProfileSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  legalName: z.string().default(""),
  established: z.string().default(""),
  brandLine: z.string().default(""),
  uei: z.string().default(""),
  cage: z.string().default(""),
  naicsCodes: z.array(naicsCodeSchema).default([]),
  samStatus: samStatusSchema.default({ active: false, expirationDate: "" }),
  certifications: z.array(certificationSchema).default([]),
  addressUS: companyAddressSchema.default({ street: "", city: "", state: "", zip: "", country: "" }),
  addressIndia: companyAddressSchema.default({ street: "", city: "", state: "", zip: "", country: "" }),
  phones: companyContactSchema.default({ main: "", healthcare: "", it: "" }),
  emails: companyEmailsSchema.default({ general: "", careers: "" }),
});

export type NaicsCode = z.infer<typeof naicsCodeSchema>;
export type Certification = z.infer<typeof certificationSchema>;
export type CompanyAddress = z.infer<typeof companyAddressSchema>;
export type CompanyProfile = z.infer<typeof companyProfileSchema>;

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: "Hire'in Solutions",
  legalName: "Rayomind Software Solutions LLC",
  established: "2014",
  brandLine: "A RAYOMIND COMPANY | EST. 2014",
  uei: "J36BQRPL2WN3",
  cage: "206Q6",
  naicsCodes: [
    { code: "561320", label: "Temporary Help Services" },
    { code: "561311", label: "Employment Placement Agencies" },
    { code: "561312", label: "Executive Search Services" },
    { code: "541512", label: "Computer Systems Design Services" },
    { code: "541612", label: "Human Resources Consulting Services" },
  ],
  samStatus: { active: true, expirationDate: "" },
  certifications: [],
  addressUS: {
    street: "2621 Leigh Ave.",
    city: "San Jose",
    state: "CA",
    zip: "95124",
    country: "United States",
  },
  addressIndia: {
    street: "Suite No-101, Pocket-6, Sector-2",
    city: "Rohini, New Delhi",
    state: "",
    zip: "110085",
    country: "India",
  },
  phones: {
    main: "+1 (415) 663-5944",
    healthcare: "+1 (408) 892-9656",
    it: "+1 (408) 876-0779",
  },
  emails: {
    general: "contact@hire-in.com",
    careers: "careers@hire-in.com",
  },
};

// Compose a one-line address string ("123 Main St., City, ST-12345, Country").
export function formatCompanyAddress(addr: CompanyAddress): string {
  const cityState = [addr.city, addr.state && addr.zip ? `${addr.state}-${addr.zip}` : addr.state || addr.zip]
    .filter(Boolean)
    .join(", ");
  return [addr.street, cityState, addr.country].filter(Boolean).join(", ");
}

// Merge a raw DB value over the defaults so partial/missing fields never
// render blank. Falls back entirely to defaults when the value is invalid.
export function mergeCompanyProfile(value: unknown): CompanyProfile {
  if (!value || typeof value !== "object") return DEFAULT_COMPANY_PROFILE;
  const v = value as Record<string, any>;
  const merged = {
    ...DEFAULT_COMPANY_PROFILE,
    ...v,
    samStatus: { ...DEFAULT_COMPANY_PROFILE.samStatus, ...(v.samStatus || {}) },
    phones: { ...DEFAULT_COMPANY_PROFILE.phones, ...(v.phones || {}) },
    emails: { ...DEFAULT_COMPANY_PROFILE.emails, ...(v.emails || {}) },
    addressUS: { ...DEFAULT_COMPANY_PROFILE.addressUS, ...(v.addressUS || {}) },
    addressIndia: { ...DEFAULT_COMPANY_PROFILE.addressIndia, ...(v.addressIndia || {}) },
    naicsCodes: Array.isArray(v.naicsCodes) ? v.naicsCodes : DEFAULT_COMPANY_PROFILE.naicsCodes,
    certifications: Array.isArray(v.certifications) ? v.certifications : DEFAULT_COMPANY_PROFILE.certifications,
  };
  const parsed = companyProfileSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_COMPANY_PROFILE;
}
