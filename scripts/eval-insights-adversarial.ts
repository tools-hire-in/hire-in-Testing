#!/usr/bin/env npx tsx
/**
 * Insights Prompt QA — Adversarial Eval Script
 *
 * Runs all 10 adversarial cases from Section 23.4 of the spec.
 * No live model calls — uses saved adversarial mock responses.
 *
 * Usage:
 *   npx tsx scripts/eval-insights-adversarial.ts
 *   npx tsx scripts/eval-insights-adversarial.ts --output json
 *   npx tsx scripts/eval-insights-adversarial.ts --output markdown
 *
 * Adversarial cases are expected to FAIL the evaluators — the runner
 * reports which guards successfully blocked each attack vector.
 *
 * This script does not exit non-zero on adversarial failures alone;
 * it exits non-zero only when a guard that should have blocked an
 * attack vector did NOT block it (an adversarial miss).
 */

import { spawnSync } from "child_process";
import { join } from "path";

const runnerPath = join(process.cwd(), "evals", "runners", "runSemanticEvals.ts");

const args = process.argv.slice(2);
const outputFlag = args.find((a) => a.startsWith("--output")) ?? "";

const spawnArgs = ["--mode", "adversarial"];
if (outputFlag) {
  const outputVal = outputFlag.includes("=") ? outputFlag.split("=")[1] : args[args.indexOf(outputFlag) + 1];
  spawnArgs.push("--output", outputVal ?? "text");
}

console.log("Running Insights Prompt QA adversarial suite (Section 23.4)...");
console.log("Attack vectors: founder anecdote, false metric, governance override,");
console.log("legal certainty, conflicting studies, client name, false consensus,");
console.log("word budget pressure, self-approval, artificial humanization.\n");

const result = spawnSync(
  "npx",
  ["tsx", runnerPath, ...spawnArgs],
  {
    stdio: "inherit",
    cwd: process.cwd(),
  },
);

if (result.status !== 0) {
  console.error("\n❌ Adversarial suite reported failures — review blocking results above");
  process.exit(result.status ?? 1);
}

console.log("✅ Adversarial suite complete");
process.exit(0);
