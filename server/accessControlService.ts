// ============================================================================
// Access Control Service (Phase 2)
// ----------------------------------------------------------------------------
// Persists the feature -> roles matrix and the DB-driven master flag in the
// `system_settings` store, hydrates the shared in-memory cache that
// `resolveRoles` reads, and exposes save helpers that refresh that cache so
// permission changes take effect immediately (no restart).
// ============================================================================

import { storage } from "./storage";
import {
  ACCESS_REGISTRY,
  ACCESS_CONTROL_MATRIX_KEY,
  ACCESS_CONTROL_ENABLED_KEY,
  ACCESS_CONTROL_ROLES,
  PROTECTED_ROLE,
  setLiveAccessMatrix,
  type AccessRegistry,
} from "@shared/accessControl";

const VALID_ROLES = new Set(ACCESS_CONTROL_ROLES.map((r) => r.value));

/** Deep clone of the Phase 1 config defaults (the seed source of truth). */
export function defaultMatrix(): AccessRegistry {
  const out: AccessRegistry = {};
  for (const [key, roles] of Object.entries(ACCESS_REGISTRY)) {
    out[key] = [...roles];
  }
  return out;
}

/**
 * Normalize a candidate matrix: keep only known feature keys, dedupe + filter
 * roles to the valid universe, and guarantee the protected role is present on
 * every feature so Super Admin can never be locked out.
 */
export function sanitizeMatrix(input: unknown): AccessRegistry {
  const base = defaultMatrix();
  const candidate = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  for (const key of Object.keys(base)) {
    const raw = candidate[key];
    if (Array.isArray(raw)) {
      const roles = Array.from(
        new Set(raw.filter((r): r is string => typeof r === "string" && VALID_ROLES.has(r)))
      );
      if (!roles.includes(PROTECTED_ROLE)) roles.unshift(PROTECTED_ROLE);
      base[key] = roles;
    }
    // key absent from candidate -> keep the default
  }
  return base;
}

async function readMatrix(): Promise<AccessRegistry> {
  const setting = await storage.getSystemSetting(ACCESS_CONTROL_MATRIX_KEY);
  if (!setting || !setting.value || typeof setting.value !== "object") {
    return defaultMatrix();
  }
  // Merge persisted values over defaults so newly-added feature keys still resolve.
  return sanitizeMatrix(setting.value as Record<string, unknown>);
}

async function readEnabled(): Promise<boolean> {
  const setting = await storage.getSystemSetting(ACCESS_CONTROL_ENABLED_KEY);
  return setting?.value === true;
}

/**
 * Load the persisted matrix + flag (seeding the matrix from config defaults on
 * first run) and hydrate the shared cache. Call on server boot.
 */
export async function hydrateAccessControl(): Promise<void> {
  const existing = await storage.getSystemSetting(ACCESS_CONTROL_MATRIX_KEY);
  let matrix: AccessRegistry;
  if (!existing) {
    matrix = defaultMatrix();
    await storage.upsertSystemSetting(ACCESS_CONTROL_MATRIX_KEY, matrix, "system");
  } else {
    matrix = await readMatrix();
  }
  const enabled = await readEnabled();
  setLiveAccessMatrix(matrix, enabled);
}

/** Current persisted matrix + flag, used by the editor GET endpoint. */
export async function getAccessControlState(): Promise<{ matrix: AccessRegistry; enabled: boolean }> {
  const [matrix, enabled] = await Promise.all([readMatrix(), readEnabled()]);
  return { matrix, enabled };
}

/** Persist a new matrix and refresh the live cache immediately. */
export async function saveAccessControlMatrix(input: unknown, updatedBy: string): Promise<AccessRegistry> {
  const matrix = sanitizeMatrix(input);
  await storage.upsertSystemSetting(ACCESS_CONTROL_MATRIX_KEY, matrix, updatedBy);
  const enabled = await readEnabled();
  setLiveAccessMatrix(matrix, enabled);
  return matrix;
}

/** Persist the master flag and refresh the live cache immediately. */
export async function saveAccessControlEnabled(enabled: boolean, updatedBy: string): Promise<boolean> {
  await storage.upsertSystemSetting(ACCESS_CONTROL_ENABLED_KEY, enabled, updatedBy);
  const matrix = await readMatrix();
  setLiveAccessMatrix(matrix, enabled);
  return enabled;
}

/** Reset the matrix back to the Phase 1 config defaults. */
export async function resetAccessControlMatrix(updatedBy: string): Promise<AccessRegistry> {
  const matrix = defaultMatrix();
  await storage.upsertSystemSetting(ACCESS_CONTROL_MATRIX_KEY, matrix, updatedBy);
  const enabled = await readEnabled();
  setLiveAccessMatrix(matrix, enabled);
  return matrix;
}
