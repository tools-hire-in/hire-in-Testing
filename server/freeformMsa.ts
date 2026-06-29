import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
} from "docx";
import type { MsaClause } from "@shared/msaClauses";

export interface FreeformMsaParty {
  name: string;
  ein?: string;
  address?: string;
  signatoryName?: string;
  signatoryTitle?: string;
}

export interface FreeformMsaData {
  client: FreeformMsaParty;
  provider: FreeformMsaParty;
  establishment: { city?: string; state?: string; country?: string };
  agreementDate?: string; // formatted, e.g. "04 May 2026"
  clauses: MsaClause[];
  additionalTerms?: string;
}

const BRAND = "1F3A6E";

function p(text: string, opts?: {
  bold?: boolean;
  size?: number;
  color?: string;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  spacingBefore?: number;
  spacingAfter?: number;
}): Paragraph {
  return new Paragraph({
    alignment: opts?.alignment ?? AlignmentType.LEFT,
    spacing: { before: opts?.spacingBefore ?? 0, after: opts?.spacingAfter ?? 120 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold ?? false,
        size: opts?.size ?? 22,
        color: opts?.color ?? "222222",
      }),
    ],
  });
}

// Render multi-line free text into separate paragraphs (preserving blank lines).
function multiline(text: string): Paragraph[] {
  const lines = (text || "").split(/\r?\n/);
  return lines.map(line => (line.trim() === "" ? p("") : p(line)));
}

function partyBlock(label: string, party: FreeformMsaParty): Paragraph[] {
  const out: Paragraph[] = [
    p(label, { bold: true, color: BRAND, size: 22, spacingBefore: 160, spacingAfter: 60 }),
    p(party.name || "—", { bold: true }),
  ];
  if (party.ein?.trim()) out.push(p(`EIN: ${party.ein.trim()}`));
  if (party.address?.trim()) out.push(...multiline(party.address.trim()));
  if (party.signatoryName?.trim()) {
    const title = party.signatoryTitle?.trim() ? `, ${party.signatoryTitle.trim()}` : "";
    out.push(p(`Authorized Signatory: ${party.signatoryName.trim()}${title}`));
  }
  return out;
}

function signatureBlock(label: string, party: FreeformMsaParty): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 400, after: 120 },
      children: [new TextRun({ text: label, bold: true, size: 22, color: BRAND })],
    }),
    p("Signature: ___________________________"),
    p(`Name: ${party.signatoryName?.trim() || "___________________________"}`),
    p(`Title: ${party.signatoryTitle?.trim() || "___________________________"}`),
    p("Date: ___________________________"),
  ];
}

export async function buildFreeformMsaDocx(data: FreeformMsaData): Promise<Buffer> {
  const { client, provider, establishment, agreementDate, clauses, additionalTerms } = data;

  const jurisdictionParts = [establishment?.city, establishment?.state, establishment?.country]
    .map(x => (x || "").trim())
    .filter(Boolean);
  const jurisdiction = jurisdictionParts.join(", ");

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: "MASTER SERVICES AGREEMENT", bold: true, size: 32, color: BRAND })],
    }),
  );
  if (agreementDate?.trim()) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: `Dated: ${agreementDate.trim()}`, italics: true, size: 20, color: "555555" })],
      }),
    );
  } else {
    children.push(p("", { spacingAfter: 160 }));
  }

  // Preamble
  const preambleBits: string[] = [];
  preambleBits.push("This Master Services Agreement (the \"Agreement\")");
  if (agreementDate?.trim()) preambleBits.push(`is made and entered into as of ${agreementDate.trim()}`);
  if (jurisdiction) preambleBits.push(`and is established under the laws of ${jurisdiction}`);
  preambleBits.push("by and between the parties identified below.");
  children.push(p(preambleBits.join(" ")));

  // Parties
  children.push(p("PARTIES", { bold: true, color: BRAND, size: 24, spacingBefore: 240, spacingAfter: 60 }));
  children.push(...partyBlock("Service Provider", provider));
  children.push(...partyBlock("Client", client));

  // Establishment / jurisdiction
  if (jurisdiction) {
    children.push(p("ESTABLISHMENT & JURISDICTION", { bold: true, color: BRAND, size: 24, spacingBefore: 240, spacingAfter: 60 }));
    children.push(p(`This Agreement is established and shall be interpreted under the laws and jurisdiction of ${jurisdiction}.`));
  }

  // Clauses
  children.push(p("TERMS & CONDITIONS", { bold: true, color: BRAND, size: 24, spacingBefore: 240, spacingAfter: 120 }));
  for (const clause of clauses || []) {
    if (!clause || (!clause.title?.trim() && !clause.body?.trim())) continue;
    if (clause.title?.trim()) {
      children.push(p(clause.title.trim(), { bold: true, color: BRAND, size: 22, spacingBefore: 200, spacingAfter: 80 }));
    }
    if (clause.body?.trim()) children.push(...multiline(clause.body.trim()));
  }

  // Additional freeform terms
  if (additionalTerms?.trim()) {
    children.push(p("ADDITIONAL TERMS", { bold: true, color: BRAND, size: 22, spacingBefore: 240, spacingAfter: 80 }));
    children.push(...multiline(additionalTerms.trim()));
  }

  // Signatures
  children.push(p("IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.", { spacingBefore: 360 }));
  children.push(...signatureBlock(`FOR SERVICE PROVIDER (${provider.name || "Service Provider"}):`, provider));
  children.push(...signatureBlock(`FOR CLIENT (${client.name || "Client"}):`, client));

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
