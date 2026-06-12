import wiproLogo from "@assets/clients/wipro.png";
import nvidiaLogo from "@assets/clients/nvidia.png";
import bankOfAmericaLogo from "@assets/clients/bank-of-america.png";
import wellsFargoLogo from "@assets/clients/wells-fargo.png";
import century22Logo from "@assets/clients/22nd-century.jpg";
import honorVetLogo from "@assets/clients/honorvet.png";
import fortunaPartnersLogo from "@assets/clients/fortuna-partners.png";
import rc4vetLogo from "@assets/clients/rc4vet.png";
import texasDirLogo from "@assets/clients/texas-dir.png";

export interface ContractEntry {
  logo: string;
  title: string;
  agency: string;
  detail: string;
}

export interface ContractGroup {
  category: string;
  entries: ContractEntry[];
}

// Contract vehicles & engagements grouped by category.
// Add a new engagement by appending an entry to the relevant group below.
export const CONTRACT_GROUPS: ContractGroup[] = [
  {
    category: "State & Government Engagements",
    entries: [
      {
        logo: texasDirLogo,
        title: "State of Texas DIR — IT Staff Augmentation Contract (ITSAC)",
        agency: "Texas Department of Information Resources",
        detail: "Subcontractor · DIR ITSAC · State Engagement",
      },
    ],
  },
];

export interface ClientEntry {
  name: string;
  logo?: string;
}

// Commercial clients shown as rotating logos with the name below each logo.
// Entries without a logo fall back to a styled wordmark.
export const COMMERCIAL_CLIENTS: ClientEntry[] = [
  { name: "22nd Century Technology & Healthcare" },
  { name: "HonorVet Technologies", logo: honorVetLogo },
  { name: "RC4VET", logo: rc4vetLogo },
  { name: "Fortuna Partners", logo: fortunaPartnersLogo },
  { name: "Wipro", logo: wiproLogo },
  { name: "Nvidia", logo: nvidiaLogo },
  { name: "Bank of America", logo: bankOfAmericaLogo },
  { name: "Wells Fargo", logo: wellsFargoLogo },
];
