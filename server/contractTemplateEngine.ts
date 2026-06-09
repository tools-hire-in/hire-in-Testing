import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export interface CandidateEntry {
  name: string;
  role: string;
  startDate: string;
  location: string;
  engagementType: string;
  hiresInFees?: string;
  hiresInFee?: string;
}

// Extracts all {{PLACEHOLDER}} tags from a DOCX buffer.
// Accepts both {{UPPER_SNAKE_CASE}} and {{lower_snake_case}} — normalised to lowercase.
// Loop tags like {{#candidates}}/{{/candidates}} are noted but not returned as flat placeholders.
export function extractPlaceholders(buffer: Buffer): string[] {
  try {
    const zip = new PizZip(buffer);
    new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
    });
    const xmlContent = zip.files["word/document.xml"]?.asText() || "";
    const matches = new Set<string>();
    // Accept flat placeholders — skip loop openers (#) and closers (/) and dot-path members
    const regex = /\{\{([A-Za-z0-9_]+)\}\}/g;
    let match;
    while ((match = regex.exec(xmlContent)) !== null) {
      matches.add(match[1].toLowerCase());
    }
    return Array.from(matches).sort();
  } catch (err) {
    console.error("[contractTemplateEngine] extractPlaceholders error:", err);
    return [];
  }
}

// Formats a date string or Date as "04 May 2026"
export function formatAgreementDate(value?: string | Date | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

// Renders a DOCX template by substituting {{placeholder}} tags with provided values.
// Also injects a `candidates` array for {#candidates}...{/candidates} loop blocks.
// Keys in the values object should be lowercase (normalised); the engine also tries
// the uppercase version as a fallback so templates authored in either case work.
export function renderTemplate(
  buffer: Buffer,
  values: Record<string, string>,
  candidates?: CandidateEntry[],
): Buffer {
  // Build a combined values map: lowercase keys + uppercase duplicates for compat
  const normalised: Record<string, any> = {};
  for (const [k, v] of Object.entries(values)) {
    normalised[k.toLowerCase()] = v;
    normalised[k.toUpperCase()] = v;
    normalised[k] = v;
  }

  // Inject candidates array for loop blocks
  if (candidates && candidates.length > 0) {
    normalised.candidates = candidates;
    normalised.CANDIDATES = candidates;
  } else {
    normalised.candidates = [];
    normalised.CANDIDATES = [];
  }

  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });
  doc.render(normalised);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
