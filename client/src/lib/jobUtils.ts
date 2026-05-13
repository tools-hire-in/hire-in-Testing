export { INDUSTRY_SPECIALTY_MAP, INDUSTRIES, getSpecialtiesForIndustry } from "@shared/industryMap";
export type { Industry } from "@shared/industryMap";

export const DUPLICATE_LABEL_RE =
  /^(job\s*title|location|employment\s*type|duration|shift|pay\s*rate|start\s*date)\s*:/i;

export function stripHtmlEntities(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function getCleanDescriptionSnippet(description: string, maxLength = 160): string {
  const cleaned = stripHtmlEntities(description);
  const lines = cleaned.split("\n");
  const filtered = lines
    .map((l) => l.trim())
    .filter((l) => l && !DUPLICATE_LABEL_RE.test(l));

  const joined = filtered.join(" ").replace(/\s+/g, " ").trim();
  if (joined.length <= maxLength) return joined;
  return joined.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}
