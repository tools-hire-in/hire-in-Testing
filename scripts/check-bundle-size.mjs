#!/usr/bin/env node
/**
 * Bundle size budget check.
 * Fails if any single JS chunk in dist/public/assets exceeds MAX_CHUNK_BYTES.
 * Run after `npm run build` to enforce the public entry budget.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, "../dist/public/assets");

const MAX_CHUNK_BYTES = 2 * 1024 * 1024; // 2 MB — Googlebot rendering cap
const WARN_CHUNK_BYTES = 1.5 * 1024 * 1024; // 1.5 MB — soft warning

if (!fs.existsSync(ASSETS_DIR)) {
  console.error(`[bundle-check] Assets directory not found: ${ASSETS_DIR}`);
  console.error("[bundle-check] Run `npm run build` first.");
  process.exit(1);
}

const files = fs.readdirSync(ASSETS_DIR).filter((f) => f.endsWith(".js"));
if (files.length === 0) {
  console.error("[bundle-check] No JS files found in assets directory.");
  process.exit(1);
}

let hasError = false;

files
  .map((f) => ({ name: f, size: fs.statSync(path.join(ASSETS_DIR, f)).size }))
  .sort((a, b) => b.size - a.size)
  .forEach(({ name, size }) => {
    const kb = (size / 1024).toFixed(1);
    const mb = (size / 1024 / 1024).toFixed(2);
    if (size > MAX_CHUNK_BYTES) {
      console.error(`[bundle-check] ❌ OVER BUDGET: ${name} — ${mb} MB (>${(MAX_CHUNK_BYTES / 1024 / 1024).toFixed(0)} MB limit)`);
      hasError = true;
    } else if (size > WARN_CHUNK_BYTES) {
      console.warn(`[bundle-check] ⚠️  WARNING: ${name} — ${mb} MB (approaching limit)`);
    } else {
      console.log(`[bundle-check] ✅ ${name} — ${kb} KB`);
    }
  });

const totalSize = files.reduce(
  (sum, f) => sum + fs.statSync(path.join(ASSETS_DIR, f)).size,
  0
);
console.log(`\n[bundle-check] Total JS: ${(totalSize / 1024 / 1024).toFixed(2)} MB across ${files.length} chunks`);

if (hasError) {
  console.error("\n[bundle-check] Build failed: one or more chunks exceed the 2 MB Googlebot budget.");
  console.error("Fix: add more React.lazy() splits or move large deps to manualChunks.");
  process.exit(1);
} else {
  console.log("\n[bundle-check] All chunks within budget. ✓");
}
