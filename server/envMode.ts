/**
 * Environment mode helper — single source of truth for dev/qa/production mode.
 * All cron guards and email intercept blocks read from here.
 *
 * Hard gate (production): if APP_ENV=production, always returns 'production' regardless of DB state.
 * Hard gate (non-prod):   if APP_ENV is set to any non-"production" value, returns that value
 *                         immediately — the DB cannot override it, preventing QA/dev instances
 *                         from firing real emails even if the DB row is misconfigured.
 * Otherwise reads system_settings key "env_mode" with a 1-minute TTL cache.
 */

export type EnvMode = "dev" | "qa" | "production";

let _cache: { value: EnvMode; expiresAt: number } | null = null;

export function invalidateEnvModeCache() {
  _cache = null;
}

export async function getEnvMode(): Promise<EnvMode> {
  const { config } = await import("./config");
  if (config.isProduction) return "production";

  // Non-prod hard gate: if APP_ENV is explicitly set to a non-production value,
  // return it immediately without touching the DB or cache. This prevents a
  // misconfigured DB row from overriding the process-level environment.
  if (config.appEnv !== "dev" || config.hasExplicitAppEnv) {
    return config.appEnv;
  }

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
