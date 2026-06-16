import { createPortal } from "react-dom";

interface SchemaHeadProps {
  schema: object | object[];
}

export function SchemaHead({ schema }: SchemaHeadProps) {
  const schemas = Array.isArray(schema) ? schema : [schema];

  return createPortal(
    <>
      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>,
    document.head
  );
}

export const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://hire-in.com/#organization",
  name: "Hire'in Solutions",
  legalName: "Rayomind Software Solutions LLC",
  url: "https://hire-in.com",
  logo: "https://hire-in.com/logo.jpg",
  description:
    "Hire'in Solutions is an AI-powered staffing agency specializing in Healthcare, IT, Engineering, and Professional Services across all 50 US states.",
  foundingDate: "2014",
  areaServed: {
    "@type": "Country",
    name: "United States",
  },
  address: {
    "@type": "PostalAddress",
    streetAddress: "2621 Leigh Ave.",
    addressLocality: "San Jose",
    addressRegion: "CA",
    postalCode: "95124",
    addressCountry: "US",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: "+1-415-663-5944",
      contactType: "customer service",
      availableLanguage: "English",
    },
    {
      "@type": "ContactPoint",
      telephone: "+1-408-892-9656",
      contactType: "Healthcare Staffing",
      availableLanguage: "English",
    },
    {
      "@type": "ContactPoint",
      telephone: "+1-408-876-0779",
      contactType: "IT Staffing",
      availableLanguage: "English",
    },
  ],
  sameAs: ["https://www.linkedin.com/company/hirein-solutions"],
  knowsAbout: [
    "Healthcare Staffing",
    "IT Staffing",
    "Engineering Recruitment",
    "Professional Services Staffing",
    "Contract Staffing",
    "AI-Powered Recruitment",
  ],
};

export const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://hire-in.com/#website",
  url: "https://hire-in.com",
  name: "Hire'in Solutions",
  description:
    "AI-powered staffing agency for Healthcare, IT, Engineering, and Professional Services.",
  publisher: {
    "@id": "https://hire-in.com/#organization",
  },
  potentialAction: {
    "@type": "SearchAction",
    target: "https://hire-in.com/jobs?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};
