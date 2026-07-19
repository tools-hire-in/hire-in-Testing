#!/usr/bin/env npx tsx
/**
 * Insights Prompt QA — Baseline Comparison Runner
 *
 * Compares a candidate eval run against a frozen baseline and reports:
 * - Cases improved
 * - Cases regressed (score drop > REGRESSION_THRESHOLD_POINTS on any veto-sensitive dimension)
 * - Critical behavior changes
 * - Median score delta
 * - Distribution of differences
 * - Whether human review is required (>10% regression rate by unique case count)
 *
 * Usage:
 *   npx tsx evals/runners/compareBaselines.ts \
 *     --baseline evals/baselines/prompt-v1/baseline.json \
 *     --candidate evals/reports/eval-run-<timestamp>.json
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import type { RegressionComparison, EvalRun, ScoreDeltaDistribution } from "../../server/insights/evals/evalTypes";
import {
  REGRESSION_THRESHOLD_POINTS,
  HUMAN_REVIEW_REGRESSION_RATE,
} from "../../server/insights/evals/evalTypes";
import { isVetoSensitiveDimension } from "../../server/insights/evals/semanticJudge";

interface BaselineCase {
  caseId: string;
  blockName: string;
  passed: boolean;
  scores?: Record<string, number>;
  failureReasons?: string[];
}

interface BaselineFile {
  version: string;
  timestamp: string;
  promptManifestVersion: string;
  cases: BaselineCase[];
}

function loadBaseline(path: string): BaselineFile {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.version || !parsed.cases) {
    throw new Error(`Invalid baseline file at ${path}: missing version or cases`);
  }
  return parsed as BaselineFile;
}

function loadCandidateRun(path: string): EvalRun {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as EvalRun;
}

function buildCandidateSummary(run: EvalRun): Record<string, BaselineCase> {
  const map: Record<string, BaselineCase> = {};
  for (const r of run.results) {
    const scores: Record<string, number> = {};
    if ((r as any).scores) {
      Object.assign(scores, (r as any).scores);
    } else {
      for (const ar of r.assertionResults) {
        scores[ar.path] = ar.pass ? 1.0 : 0.0;
      }
    }
    map[r.caseId] = {
      caseId: r.caseId,
      blockName: r.blockName,
      passed: r.passed,
      scores,
      failureReasons: r.failureReasons,
    };
  }
  return map;
}

function buildBaselineSummary(baseline: BaselineFile): Record<string, BaselineCase> {
  const map: Record<string, BaselineCase> = {};
  for (const c of baseline.cases) {
    map[c.caseId] = c;
  }
  return map;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function computeDistribution(deltas: number[]): ScoreDeltaDistribution {
  const dist: ScoreDeltaDistribution = {
    improvement: 0,
    noChange: 0,
    minorRegression: 0,
    moderateRegression: 0,
    severeRegression: 0,
    totalObservations: deltas.length,
  };
  for (const d of deltas) {
    if (d > 0) dist.improvement++;
    else if (d === 0) dist.noChange++;
    else if (d > -0.1) dist.minorRegression++;
    else if (d > -0.3) dist.moderateRegression++;
    else dist.severeRegression++;
  }
  return dist;
}

function compareRuns(
  baseline: BaselineFile,
  candidate: EvalRun,
): RegressionComparison {
  const baselineMap = buildBaselineSummary(baseline);
  const candidateMap = buildCandidateSummary(candidate);

  const casesImproved: string[] = [];
  const casesRegressed: RegressionComparison["casesRegressed"] = [];
  const criticalBehaviorChanges: string[] = [];
  const deltas: number[] = [];
  const regressedCaseIds = new Set<string>();

  const allCaseIds = new Set([
    ...Object.keys(baselineMap),
    ...Object.keys(candidateMap),
  ]);

  for (const caseId of allCaseIds) {
    const base = baselineMap[caseId];
    const cand = candidateMap[caseId];

    if (!base) {
      criticalBehaviorChanges.push(`NEW CASE [${caseId}]: not present in baseline`);
      continue;
    }

    if (!cand) {
      criticalBehaviorChanges.push(`REMOVED CASE [${caseId}]: present in baseline but missing from candidate`);
      continue;
    }

    const basePassed = base.passed ? 1 : 0;
    const candPassed = cand.passed ? 1 : 0;
    const delta = candPassed - basePassed;
    deltas.push(delta);

    if (!base.passed && cand.passed) {
      casesImproved.push(caseId);
    } else if (base.passed && !cand.passed) {
      regressedCaseIds.add(caseId);
      casesRegressed.push({
        caseId,
        dimension: "hard_gate_pass_fail",
        baselineScore: 1,
        candidateScore: 0,
        delta: -1,
      });
    }

    if (base.scores && cand.scores) {
      for (const dimension of Object.keys(base.scores)) {
        const baseScore = base.scores[dimension] ?? 0;
        const candScore = cand.scores[dimension] ?? 0;
        const dimDelta = candScore - baseScore;
        deltas.push(dimDelta);

        if (dimDelta > 0) {
          casesImproved.push(`${caseId}:${dimension}`);
        } else if (dimDelta < -REGRESSION_THRESHOLD_POINTS) {
          regressedCaseIds.add(caseId);
          casesRegressed.push({
            caseId,
            dimension,
            baselineScore: baseScore,
            candidateScore: candScore,
            delta: dimDelta,
          });

          if (isVetoSensitiveDimension(dimension)) {
            criticalBehaviorChanges.push(
              `VETO-SENSITIVE REGRESSION [${caseId}] dimension=${dimension} delta=${dimDelta.toFixed(2)} (threshold=${REGRESSION_THRESHOLD_POINTS})`,
            );
          }
        }
      }
    }

    if (base.passed !== cand.passed && !cand.passed) {
      criticalBehaviorChanges.push(
        `GATE STATUS CHANGE [${caseId}]: was PASS, now FAIL — ${(cand.failureReasons ?? []).slice(0, 2).join("; ")}`,
      );
    }
  }

  const medianScoreDelta = computeMedian(deltas);
  const totalTrackedCases = Math.max(Object.keys(baselineMap).length, 1);
  const regressionRate = regressedCaseIds.size / totalTrackedCases;
  const requiresHumanReview = regressionRate > HUMAN_REVIEW_REGRESSION_RATE;
  const scoreDeltaDistribution = computeDistribution(deltas);

  return {
    baselineVersion: baseline.version,
    candidateVersion: candidate.promptManifestVersion,
    timestamp: new Date().toISOString(),
    casesImproved: [...new Set(casesImproved)],
    casesRegressed,
    criticalBehaviorChanges,
    medianScoreDelta,
    regressionRate,
    requiresHumanReview,
    humanReviewReason: requiresHumanReview
      ? `${regressedCaseIds.size} unique case(s) regressed — ${(regressionRate * 100).toFixed(1)}% of benchmark (threshold: ${(HUMAN_REVIEW_REGRESSION_RATE * 100).toFixed(0)}%)`
      : undefined,
    scoreDeltaDistribution,
  };
}

function renderComparisonReport(comparison: RegressionComparison): string {
  const lines: string[] = [];
  lines.push("# Insights Prompt QA — Baseline Comparison Report");
  lines.push(`\n**Baseline Version:** ${comparison.baselineVersion}`);
  lines.push(`**Candidate Version:** ${comparison.candidateVersion}`);
  lines.push(`**Timestamp:** ${comparison.timestamp}`);

  lines.push(`\n## Summary\n`);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Cases Improved | ${comparison.casesImproved.length} |`);
  lines.push(`| Cases Regressed (unique) | ${new Set(comparison.casesRegressed.map(r => r.caseId)).size} |`);
  lines.push(`| Regression Entries | ${comparison.casesRegressed.length} |`);
  lines.push(`| Critical Behavior Changes | ${comparison.criticalBehaviorChanges.length} |`);
  lines.push(`| Median Score Delta | ${comparison.medianScoreDelta.toFixed(3)} |`);
  lines.push(`| Regression Rate | ${(comparison.regressionRate * 100).toFixed(1)}% |`);
  lines.push(`| Requires Human Review | ${comparison.requiresHumanReview ? "⚠️ YES" : "✅ NO"} |`);

  if (comparison.requiresHumanReview) {
    lines.push(`\n> ⚠️ **Human Review Required:** ${comparison.humanReviewReason}`);
  }

  const dist = comparison.scoreDeltaDistribution;
  lines.push(`\n## Score Delta Distribution (n=${dist.totalObservations})\n`);
  lines.push(`| Bucket | Count | Bar |`);
  lines.push(`|---|---|---|`);
  const maxCount = Math.max(dist.improvement, dist.noChange, dist.minorRegression, dist.moderateRegression, dist.severeRegression, 1);
  const bar = (n: number) => "█".repeat(Math.round((n / maxCount) * 20));
  lines.push(`| ✅ Improvement (>0)           | ${dist.improvement}  | ${bar(dist.improvement)} |`);
  lines.push(`| ➡️  No Change (=0)             | ${dist.noChange}    | ${bar(dist.noChange)} |`);
  lines.push(`| 🟡 Minor Regression (-0.1–0)  | ${dist.minorRegression} | ${bar(dist.minorRegression)} |`);
  lines.push(`| 🟠 Moderate (-0.3–-0.1)       | ${dist.moderateRegression} | ${bar(dist.moderateRegression)} |`);
  lines.push(`| 🔴 Severe (≤ -0.3)            | ${dist.severeRegression}   | ${bar(dist.severeRegression)} |`);


  if (comparison.criticalBehaviorChanges.length > 0) {
    lines.push(`\n## Critical Behavior Changes\n`);
    for (const change of comparison.criticalBehaviorChanges) {
      lines.push(`- ${change}`);
    }
  }

  if (comparison.casesRegressed.length > 0) {
    lines.push(`\n## Regressed Cases (score drop > ${REGRESSION_THRESHOLD_POINTS})\n`);
    lines.push(`| Case ID | Dimension | Baseline | Candidate | Delta |`);
    lines.push(`|---|---|---|---|---|`);
    for (const r of comparison.casesRegressed) {
      lines.push(`| ${r.caseId} | ${r.dimension} | ${r.baselineScore} | ${r.candidateScore} | ${r.delta.toFixed(2)} |`);
    }
  }

  if (comparison.casesImproved.length > 0) {
    lines.push(`\n## Improved Cases\n`);
    for (const id of comparison.casesImproved) {
      lines.push(`- ${id}`);
    }
  }

  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);

  const getArg = (flag: string): string | undefined => {
    const idx = args.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
    if (idx === -1) return undefined;
    if (args[idx].includes("=")) return args[idx].split("=").slice(1).join("=");
    return args[idx + 1];
  };

  const baselinePath = getArg("--baseline") ?? join(process.cwd(), "evals/baselines/prompt-v1/baseline.json");
  const candidatePath = getArg("--candidate");
  const outputFormat = getArg("--output") ?? "text";

  if (!candidatePath) {
    const reportsDir = join(process.cwd(), "evals/reports");
    let runs: string[] = [];
    try {
      runs = readdirSync(reportsDir)
        .filter((f) => f.startsWith("eval-run-") && f.endsWith(".json"))
        .sort()
        .reverse();
    } catch {
    }
    if (runs.length === 0) {
      console.error("No candidate run file specified and no reports found. Run eval:insights:smoke first.");
      process.exit(1);
    }
    console.log(`Using most recent report: ${runs[0]}`);
    comparePaths(baselinePath, join(reportsDir, runs[0]), outputFormat);
    return;
  }

  comparePaths(baselinePath, candidatePath, outputFormat);
}

function comparePaths(baselinePath: string, candidatePath: string, outputFormat: string): void {
  console.log(`\n🔍 Comparing baseline: ${baselinePath}`);
  console.log(`   Against candidate:  ${candidatePath}\n`);

  const baseline = loadBaseline(baselinePath);
  const candidate = loadCandidateRun(candidatePath);
  const comparison = compareRuns(baseline, candidate);
  const uniqueRegressed = new Set(comparison.casesRegressed.map((r) => r.caseId)).size;

  console.log(`Cases improved:       ${comparison.casesImproved.length}`);
  console.log(`Cases regressed:      ${uniqueRegressed} unique (${comparison.casesRegressed.length} dimension entries)`);
  console.log(`Critical changes:     ${comparison.criticalBehaviorChanges.length}`);
  console.log(`Regression rate:      ${(comparison.regressionRate * 100).toFixed(1)}%`);
  console.log(`Median score delta:   ${comparison.medianScoreDelta.toFixed(3)}`);
  console.log(`Human review needed:  ${comparison.requiresHumanReview ? "YES ⚠️" : "NO ✅"}`);

  if (outputFormat === "json" || outputFormat === "both") {
    const outDir = join(process.cwd(), "evals", "reports");
    mkdirSync(outDir, { recursive: true });
    const jsonPath = join(outDir, `comparison-${Date.now()}.json`);
    writeFileSync(jsonPath, JSON.stringify(comparison, null, 2));
    console.log(`\n📄 JSON comparison: ${jsonPath}`);
  }

  if (outputFormat === "markdown" || outputFormat === "both") {
    const outDir = join(process.cwd(), "evals", "reports");
    mkdirSync(outDir, { recursive: true });
    const mdPath = join(outDir, `comparison-${Date.now()}.md`);
    writeFileSync(mdPath, renderComparisonReport(comparison));
    console.log(`📝 Markdown comparison: ${mdPath}`);
  }

  if (comparison.requiresHumanReview) {
    console.warn(`\n⚠️  Human review required: ${comparison.humanReviewReason}\n`);
  }

  if (comparison.criticalBehaviorChanges.length > 0) {
    console.error(`\n❌ Critical behavior changes detected — review before releasing\n`);
    for (const change of comparison.criticalBehaviorChanges) {
      console.error(`   ${change}`);
    }
    process.exit(1);
  }

  console.log("\n✅ Comparison complete\n");
}

main();
