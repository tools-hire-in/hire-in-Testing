/**
 * Central environment configuration — the one place that reads APP_ENV and NODE_ENV.
 *
 * Evaluated once at module load. Import `config` from here instead of reading
 * process.env.APP_ENV / process.env.NODE_ENV directly anywhere in server code.
 *
 * Two distinct "production" predicates are intentionally separated:
 *
 *  isProduction        — true only when APP_ENV=production.
 *                        Used for email guard / env-mode logic (fail-closed: missing
 *                        APP_ENV stays in dev mode so no emails leak).
 *
 *  isProductionSecurity — true when NODE_ENV=production OR APP_ENV=production.
 *                        Used for security-sensitive settings (secure cookies, 2FA
 *                        enforcement, rate-limit thresholds). When APP_ENV is absent
 *                        but the runtime clearly signals production via NODE_ENV,
 *                        security hardening must remain ON.
 *
 *  hasExplicitAppEnv   — true when APP_ENV was explicitly set (any value).
 *                        Used in envMode.ts to decide whether to skip the DB lookup.
 *
 * This file intentionally has NO imports from the rest of the server to avoid
 * circular dependencies — it is safe to import from any server module.
 */

export type AppEnv = "dev" | "qa" | "production";

const rawAppEnv = process.env.APP_ENV;
const rawNodeEnv = process.env.NODE_ENV;

function resolveAppEnv(): AppEnv {
  if (rawAppEnv === "production") return "production";
  if (rawAppEnv === "qa") return "qa";
  if (rawAppEnv === "dev") return "dev";
  // APP_ENV not set — fail-closed to dev (keeps email guard closed).
  console.warn(
    "[config] APP_ENV is not set — defaulting to 'dev'. " +
    "Email guard relies on DB env_mode setting. Set APP_ENV=production in the deployment environment.",
  );
  return "dev";
}

const appEnv = resolveAppEnv();

export const config = {
  appEnv,
  nodeEnv: rawNodeEnv ?? "development",
  /** true only when APP_ENV=production — governs email/env-mode logic */
  isProduction: appEnv === "production",
  isDev: appEnv === "dev",
  isQA: appEnv === "qa",
  /** true when NODE_ENV=production OR APP_ENV=production — governs security hardening */
  isProductionSecurity: rawNodeEnv === "production" || rawAppEnv === "production",
  /** true when APP_ENV was explicitly set (any value) */
  hasExplicitAppEnv: rawAppEnv !== undefined,
} as const;
