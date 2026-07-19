#!/usr/bin/env npx tsx
/**
 * Insights Prompt QA — Smoke Eval Script
 *
 * Runs the 10-case smoke suite against the prompt manifest.
 * No live model calls — uses saved mock responses.
 *
 * Usage:
 *   npx tsx scripts/eval-insights-smoke.ts
 *   npx tsx scripts/eval-insights-smoke.ts --output json
 *   npx tsx scripts/eval-insights-smoke.ts --output markdown
 *
 * This script is part of the pre-release gate. It exits non-zero
 * when any critical (hard gate) evaluator fails.
 */

import { spawnSync } from "child_process";
import { join } from "path";

const runnerPath = join(process.cwd(), "evals", "runners", "runSemanticEvals.ts");

const args = process.argv.slice(2);
const outputFlag = args.find((a) => a.startsWith("--output")) ?? "";

const spawnArgs = ["--mode", "smoke"];
if (outputFlag) {
  const outputVal = outputFlag.includes("=") ? outputFlag.split("=")[1] : args[args.indexOf(outputFlag) + 1];
  spawnArgs.push("--output", outputVal ?? "text");
}

console.log("Running Insights Prompt QA smoke suite...\n");

const result = spawnSync(
  "npx",
  ["tsx", runnerPath, ...spawnArgs],
  {
    stdio: "inherit",
    cwd: process.cwd(),
  },
);

if (result.status !== 0) {
  console.error("\n❌ Smoke suite FAILED — check evaluator output above");
  process.exit(result.status ?? 1);
}

console.log("✅ Smoke suite PASSED");
process.exit(0);
