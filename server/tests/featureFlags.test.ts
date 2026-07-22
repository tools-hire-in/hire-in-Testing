/**
 * Feature Flags — cache behaviour, semantics, and invalidation
 *
 * Run: npx tsx --test server/tests/featureFlags.test.ts
 *
 * These are the risks that matter after the consolidation refactor:
 *
 *  1. Semantics: getFeatureFlag() uses === true (fail-closed / default-off).
 *     Old inline reads used !== false (default-on). Any flag not explicitly
 *     seeded true will now return false. All tests verify this contract.
 *
 *  2. Cache: reads within the 2-min TTL must NOT hit the DB again. Writes to
 *     the DB while the cache is warm must NOT be visible until invalidation.
 *
 *  3. Invalidation: invalidateFeatureFlagsCache() must make the very next read
 *     go to DB and pick up the new value.
 *
 *  4. Error fallback: when the DB is unreachable, getAllFeatureFlags() must
 *     return the last-good stale cache (or {} on cold start). It must NOT throw.
 *
 *  5. API write path: PATCH /api/system/feature-flags must call invalidation
 *     so the next getFeatureFlag() call reflects the new value without waiting
 *     for the TTL to expire.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  getFeatureFlag,
  getAllFeatureFlags,
  invalidateFeatureFlagsCache,
} from "../featureFlags.js";
import { storage } from "../storage.js";

// ── helpers ────────────────────────────────────────────────────────────────────

const TEST_FLAG_KEY = "__test_flag_featureFlags_ts__";

async function setFlags(flags: Record<string, boolean>) {
  await storage.upsertSystemSetting("feature_flags", flags, "test-runner");
  invalidateFeatureFlagsCache();
}

async function getStoredFlags(): Promise<Record<string, boolean>> {
  const row = await storage.getSystemSetting("feature_flags");
  return (row?.value as Record<string, boolean>) ?? {};
}

// ── suite ──────────────────────────────────────────────────────────────────────

describe("featureFlags — cache and semantics", async () => {
  let originalFlags: Record<string, boolean> = {};

  before(async () => {
    originalFlags = await getStoredFlags();
  });

  after(async () => {
    await storage.upsertSystemSetting("feature_flags", originalFlags, "test-runner");
    invalidateFeatureFlagsCache();
  });

  beforeEach(() => {
    invalidateFeatureFlagsCache();
  });

  // ── 1. Core semantics ────────────────────────────────────────────────────────

  it("returns true for a flag explicitly set to true", async () => {
    await setFlags({ [TEST_FLAG_KEY]: true });
    const result = await getFeatureFlag(TEST_FLAG_KEY);
    assert.equal(result, true, "expected true for flag set to true");
  });

  it("returns false for a flag explicitly set to false", async () => {
    await setFlags({ [TEST_FLAG_KEY]: false });
    const result = await getFeatureFlag(TEST_FLAG_KEY);
    assert.equal(result, false, "expected false for flag set to false");
  });

  it("returns false for a flag that does not exist in the DB row (fail-closed)", async () => {
    await setFlags({});
    const result = await getFeatureFlag("flag_that_does_not_exist");
    assert.equal(result, false, "missing flag must default to false, not true");
  });

  it("getAllFeatureFlags returns the full object", async () => {
    await setFlags({ alpha: true, beta: false });
    const flags = await getAllFeatureFlags();
    assert.equal(flags.alpha, true);
    assert.equal(flags.beta, false);
  });

  // ── 2. Cache serves repeat reads without going to DB ────────────────────────

  it("a second call within TTL returns the cached value even if DB changes", async () => {
    await setFlags({ [TEST_FLAG_KEY]: true });

    const first = await getFeatureFlag(TEST_FLAG_KEY);
    assert.equal(first, true, "first read must be true");

    // Write directly to DB, bypassing cache invalidation
    await storage.upsertSystemSetting(
      "feature_flags",
      { [TEST_FLAG_KEY]: false },
      "test-runner",
    );

    // Cache is still warm — must NOT reflect the DB change
    const cached = await getFeatureFlag(TEST_FLAG_KEY);
    assert.equal(cached, true, "cached read must still return true (DB write bypassed cache)");
  });

  // ── 3. invalidateFeatureFlagsCache makes the next read go to DB ─────────────

  it("invalidateFeatureFlagsCache causes the next read to reflect the current DB value", async () => {
    await setFlags({ [TEST_FLAG_KEY]: true });
    assert.equal(await getFeatureFlag(TEST_FLAG_KEY), true, "pre-condition: true");

    // Write new value directly to DB (no cache invalidation)
    await storage.upsertSystemSetting(
      "feature_flags",
      { [TEST_FLAG_KEY]: false },
      "test-runner",
    );

    // Without invalidation, still cached as true
    assert.equal(await getFeatureFlag(TEST_FLAG_KEY), true, "still cached");

    // Invalidate — next read must hit DB
    invalidateFeatureFlagsCache();
    assert.equal(await getFeatureFlag(TEST_FLAG_KEY), false, "after invalidation must return new DB value");
  });

  it("invalidateFeatureFlagsCache is idempotent (calling twice is safe)", async () => {
    await setFlags({ [TEST_FLAG_KEY]: true });
    invalidateFeatureFlagsCache();
    invalidateFeatureFlagsCache();
    const result = await getFeatureFlag(TEST_FLAG_KEY);
    assert.equal(result, true, "flag must still be readable after double invalidation");
  });

  // ── 4. Error fallback ────────────────────────────────────────────────────────

  it("getAllFeatureFlags returns stale cache when storage throws (no throw propagated)", async () => {
    await setFlags({ [TEST_FLAG_KEY]: true });

    // Warm the cache
    const warm = await getAllFeatureFlags();
    assert.equal(warm[TEST_FLAG_KEY], true, "cache is warm");

    // Temporarily break storage by monkey-patching
    const original = storage.getSystemSetting.bind(storage);
    (storage as any).getSystemSetting = async () => {
      throw new Error("simulated DB failure");
    };

    try {
      // Cache is still valid — should return stale value, not throw
      const stale = await getAllFeatureFlags();
      assert.equal(stale[TEST_FLAG_KEY], true, "must return stale cache on DB error");
    } finally {
      (storage as any).getSystemSetting = original;
      invalidateFeatureFlagsCache();
    }
  });

  it("getAllFeatureFlags returns {} on cold-start DB error (no throw, no crash)", async () => {
    // Cold cache
    invalidateFeatureFlagsCache();

    const original = storage.getSystemSetting.bind(storage);
    (storage as any).getSystemSetting = async () => {
      throw new Error("simulated DB failure");
    };

    try {
      const result = await getAllFeatureFlags();
      assert.equal(typeof result, "object", "must return an object, not throw");
      assert.equal(Object.keys(result).length, 0, "cold-start DB error → empty object");
    } finally {
      (storage as any).getSystemSetting = original;
      invalidateFeatureFlagsCache();
    }
  });

  // ── 5. Semantics regression guard: default-off contract ─────────────────────

  it("getFeatureFlag never returns true for a flag not explicitly set (guards against !== false regression)", async () => {
    await setFlags({ notifications_enabled: true });

    // Verify the flag that IS set
    assert.equal(await getFeatureFlag("notifications_enabled"), true);

    // Verify a flag that was NOT set — must be false, not true
    // (Old inline reads used `flag !== false` which would return true here)
    assert.equal(
      await getFeatureFlag("document_reminder_email_enabled"),
      false,
      "unset flag must be false — guards against !== false default-on regression",
    );
  });
});
