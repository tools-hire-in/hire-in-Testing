/**
 * Safe calendar-date formatting utilities.
 *
 * YYYY-MM-DD strings are date-only values (joining dates, effective dates, holiday
 * dates, leave dates, goal target dates).  Parsing them with `new Date(dateStr)`
 * treats the string as UTC midnight, which shifts the displayed day backward by
 * one for any browser running in a timezone behind UTC (e.g. US).
 *
 * These helpers parse date-only strings using the LOCAL Date constructor so no
 * UTC offset is applied, guaranteeing the same calendar day in every timezone.
 */

/**
 * Parse a YYYY-MM-DD string into a local Date with no timezone offset applied.
 * Also accepts ISO strings — only the date part is used.
 * Returns null for null/undefined/invalid input.
 */
export function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const datePart = dateStr.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month - 1, day);
}

/**
 * Format a YYYY-MM-DD string for display without UTC offset shift.
 *
 * @param dateStr  A YYYY-MM-DD (or ISO) string, null, or undefined.
 * @param locale   BCP 47 locale tag — defaults to "en-US".
 * @param options  Intl.DateTimeFormatOptions — defaults to { year: "numeric", month: "short", day: "numeric" }.
 * @returns        Formatted date string, or "—" for null/undefined/invalid input.
 */
export function formatLocalDate(
  dateStr: string | null | undefined,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseLocalDate(dateStr);
  if (!date) return "—";
  return date.toLocaleDateString(
    locale ?? "en-US",
    options ?? { year: "numeric", month: "short", day: "numeric" }
  );
}
