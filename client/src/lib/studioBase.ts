/**
 * Studio T1 (Task #906): single source for the standalone Studio base path.
 * Every internal Studio link and every notification/email deep link must be
 * built from this constant so the shell can move without breaking links.
 */
export const STUDIO_BASE = "/studio";

/** Build an absolute in-app path inside the Studio shell. */
export function studioPath(subPath = ""): string {
  if (!subPath) return STUDIO_BASE;
  return `${STUDIO_BASE}${subPath.startsWith("/") ? "" : "/"}${subPath}`;
}

/** Map a legacy /admin/studio/* location to its /studio/* equivalent. */
export function legacyToStudioPath(location: string): string {
  return location.replace(/^\/admin\/studio/, STUDIO_BASE) || STUDIO_BASE;
}
