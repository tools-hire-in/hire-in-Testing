import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

// Extracts all {{PLACEHOLDER}} tags from a DOCX buffer.
// Accepts both {{UPPER_SNAKE_CASE}} and {{lower_snake_case}} — normalised to lowercase.
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
    // Accept any alphanumeric + underscore placeholder, case-insensitive
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

// Renders a DOCX template by substituting {{placeholder}} tags with provided values.
// Keys in the values object should be lowercase (normalised); the engine also tries
// the uppercase version as a fallback so templates authored in either case work.
export function renderTemplate(buffer: Buffer, values: Record<string, string>): Buffer {
  // Build a combined values map: lowercase keys + uppercase duplicates for compat
  const normalised: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    normalised[k.toLowerCase()] = v;
    normalised[k.toUpperCase()] = v;
    normalised[k] = v;
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
