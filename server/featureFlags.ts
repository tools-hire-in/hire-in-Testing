/**
 * Server-side feature flag helper — the server twin of client/src/hooks/use-feature-flags.ts.
 *
 * Reads the `feature_flags` JSON from the same DB row that the GET /api/system/feature-flags
 * endpoint serves to the client, with a 2-minute in-memory TTL so repeated calls within a
 * request fan-out cost zero extra DB round-trips.
 *
 * Cache invalidation: call invalidateFeatureFlagsCache() immediately after any PATCH that
 * writes a new flags object — the PATCH route in routes.ts does this automatically.
 *
 * ⚠️  SINGLE-PROCESS CACHE — this in-memory cache is NOT shared across Node.js workers.
 * In a PM2-cluster or multi-process deployment, each worker holds its own copy.
 * Toggling a flag via the admin UI invalidates only the worker that handled the request;
 * other workers keep the stale value for up to CACHE_TTL_MS (2 minutes).
 * Resolution when running multi-process: either (a) accept the 2-min drift and keep TTL
 * short, or (b) route all flag writes through a pub/sub invalidation (Redis, pg LISTEN/NOTIFY).
 * Today the app runs as a single process, so this is not an active problem.
 *
 * This file must NOT import from routes.ts, scheduler.ts, or any file that imports from
 * here at module-initialization time, to prevent circular dependencies. It only imports
 * from storage lazily (dynamic import inside the async function).
 */

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * The canonical list of boolean feature flags this application knows about.
 * Any flag in this list that is missing from the DB row is a seeding gap —
 * validateFeatureFlags() will warn about it at startup, and the health endpoint
 * will surface it for staging/restore verification.
 *
 * Keep this in sync with:
 *  - The FLAG_DEFAULTS seed block in server/index.ts
 *  - The BOOLEAN_FLAGS list in the PATCH /api/system/feature-flags route
 *  - The flagDefs array in client/src/pages/admin/hr/HRSettings.tsx
 */
export const KNOWN_FLAGS = [
  "notifications_enabled",
  "document_reminder_email_enabled",
  "esign_docusign_flow",
  "new_look",
  "probation_framework_db",
  "process_governance",
  "studio_v2_enabled",
  "enforce_probation_leave_gate",
  "attendance_deficit_pool_enabled",
] as const;

export type KnownFlag = (typeof KNOWN_FLAGS)[number];

let _cache: { flags: Record<string, boolean>; expiresAt: number } | null = null;

export function invalidateFeatureFlagsCache(): void {
  _cache = null;
}

export async function getAllFeatureFlags(): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (_cache && now < _cache.expiresAt) return _cache.flags;

  try {
    const { storage } = await import("./storage");
    const setting = await storage.getSystemSetting("feature_flags");
    const flags = (setting?.value as Record<string, boolean>) ?? {};
    _cache = { flags, expiresAt: now + CACHE_TTL_MS };
    return flags;
  } catch {
    return _cache?.flags ?? {};
  }
}

export async function getFeatureFlag(name: string): Promise<boolean> {
  const flags = await getAllFeatureFlags();
  return flags[name] === true;
}

/**
 * Validates that every KNOWN_FLAG is present in the DB row and returns any that are missing.
 *
 * Call this at startup after the flag-defaults seed to confirm the seed worked.
 * Missing flags are logged as [featureFlags] WARN entries — they won't crash the server
 * but mean those features will silently be off until the seed row is repaired.
 *
 * Also exposed via GET /api/system/feature-flags/health for post-restore verification
 * in staging/production.
 */
export async function validateFeatureFlags(): Promise<{ healthy: boolean; missingFlags: string[] }> {
  invalidateFeatureFlagsCache();
  const flags = await getAllFeatureFlags();
  const missingFlags = KNOWN_FLAGS.filter((k) => !(k in flags));
  if (missingFlags.length > 0) {
    console.warn(
      `[featureFlags] WARN — ${missingFlags.length} known flag(s) missing from the DB row. ` +
      `Affected features will be silently OFF. Missing: ${missingFlags.join(", ")}. ` +
      "Run the startup seed or manually upsert the system_settings 'feature_flags' row to fix.",
    );
  }
  return { healthy: missingFlags.length === 0, missingFlags };
}
