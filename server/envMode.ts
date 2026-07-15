/**
 * Environment mode helper — single source of truth for dev/qa/production mode.
 * All cron guards and email intercept blocks read from here.
 *
 * Hard gate: if APP_ENV=production, always returns 'production' regardless of DB state.
 * Otherwise reads system_settings key "env_mode" with a 1-minute TTL cache.
 */

export type EnvMode = "dev" | "qa" | "production";

let _cache: { value: EnvMode; expiresAt: number } | null = null;

export function invalidateEnvModeCache() {
  _cache = null;
}

export async function getEnvMode(): Promise<EnvMode> {
  if (process.env.APP_ENV === "production") return "production";

  const now = Date.now();
  if (_cache && now < _cache.expiresAt) return _cache.value;

  try {
    const { storage } = await import("./storage");
    const setting = await storage.getSystemSetting("env_mode");
    const raw = (setting?.value as string) ?? "dev";
    const value: EnvMode = raw === "qa" ? "qa" : raw === "production" ? "production" : "dev";
    _cache = { value, expiresAt: now + 60_000 };
    return value;
  } catch {
    return "dev";
  }
}
