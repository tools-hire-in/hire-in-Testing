#!/usr/bin/env npx tsx
/**
 * Insights Prompt QA — Standalone Eval Runner
 *
 * Smoke mode (default): runs up to 10 representative NON-adversarial cases from all blocks.
 * Full mode: runs all registered non-adversarial cases.
 * Adversarial mode: runs all 10 Section 23.4 adversarial cases; exits non-zero on MISSES
 *                   (attack not blocked = miss), not on blocks (attack blocked = pass for the guard).
 * Mock mode: uses saved responses (no live model calls).
 *
 * Usage:
 *   npx tsx evals/runners/runSemanticEvals.ts --mode smoke
 *   npx tsx evals/runners/runSemanticEvals.ts --mode full
 *   npx tsx evals/runners/runSemanticEvals.ts --mode adversarial
 *   npx tsx evals/runners/runSemanticEvals.ts --mode smoke --output json
 */

import { randomUUID } from "crypto";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { PromptEvalCase, EvalResult, EvalRun, AssertionResult, AssertionType } from "../../server/insights/evals/evalTypes";
import { REGRESSION_THRESHOLD_POINTS, HUMAN_REVIEW_REGRESSION_RATE } from "../../server/insights/evals/evalTypes";
import {
  schemaValidator,
  primaryReaderValidator,
  stateValidator,
  wordBudgetValidator,
  firstPersonGuard,
  sourceRequirementGuard,
  freshnessGuard,
  privacyGuard,
  promptInjectionGuard,
  lensOveruseGuard,
  disclosureGuard,
  workflowStateValidator,
  HARD_GATE_EVALUATORS,
  type EvaluatorFn,
  type EvaluatorName,
} from "../../server/insights/evals/deterministicEvaluators";
import { PROMPT_MANIFEST, getManifestSummary } from "../../server/insights/prompts/promptManifest";
import {
  INSIGHTS_EDITORIAL_IDENTITY_BLOCK,
  INSIGHTS_PRIMARY_READER_BLOCK,
  INSIGHTS_PLANNING_SCAN_BLOCK,
  INSIGHTS_LENS_INCLUSION_BLOCK,
  INSIGHTS_EPISTEMIC_DISCIPLINE_BLOCK,
  INSIGHTS_LENGTH_BLOCK,
  INSIGHTS_HUMAN_AUTHENTICITY_BLOCK,
} from "../../server/intelligence/marketingIntelligence";
import {
  evaluateSemanticDimension,
  DEFAULT_SEMANTIC_CONFIGS,
  summarizeSemanticScores,
} from "../../server/insights/evals/semanticJudge";

import { EDITORIAL_IDENTITY_CASES } from "../../server/insights/prompts/__tests__/editorialIdentity.cases";
import { PRIMARY_READER_CASES } from "../../server/insights/prompts/__tests__/primaryReader.cases";
import { PLANNING_SCAN_CASES } from "../../server/insights/prompts/__tests__/planningScan.cases";
import { LENS_INCLUSION_CASES } from "../../server/insights/prompts/__tests__/lensInclusion.cases";
import { EPISTEMIC_DISCIPLINE_CASES } from "../../server/insights/prompts/__tests__/epistemicDiscipline.cases";
import { LENGTH_COMPRESSION_CASES } from "../../server/insights/prompts/__tests__/lengthCompression.cases";
import { HUMAN_AUTHENTICITY_CASES } from "../../server/insights/prompts/__tests__/humanAuthenticity.cases";
import { ADVERSARIAL_CASES } from "../../server/insights/prompts/__tests__/adversarial.cases";

const ALL_CASES: PromptEvalCase[] = [
  ...EDITORIAL_IDENTITY_CASES,
  ...PRIMARY_READER_CASES,
  ...PLANNING_SCAN_CASES,
  ...LENS_INCLUSION_CASES,
  ...EPISTEMIC_DISCIPLINE_CASES,
  ...LENGTH_COMPRESSION_CASES,
  ...HUMAN_AUTHENTICITY_CASES,
];

const ADVERSARIAL_ONLY: PromptEvalCase[] = ADVERSARIAL_CASES;

const EVALUATOR_MAP: Record<string, EvaluatorFn> = {
  schemaValidator,
  primaryReaderValidator,
  stateValidator,
  wordBudgetValidator,
  firstPersonGuard,
  sourceRequirementGuard,
  freshnessGuard,
  privacyGuard,
  promptInjectionGuard,
  lensOveruseGuard,
  disclosureGuard,
  workflowStateValidator,
};

const EVALUATOR_ASSERTION_TYPES: Record<string, AssertionType> = {
  schemaValidator: "schema_valid",
  primaryReaderValidator: "schema_valid",
  stateValidator: "state_machine_safe",
  wordBudgetValidator: "word_budget_within_range",
  firstPersonGuard: "no_first_person",
  sourceRequirementGuard: "requires_source",
  freshnessGuard: "requires_source",
  privacyGuard: "no_pii",
  promptInjectionGuard: "no_prompt_injection",
  lensOveruseGuard: "lens_count_valid",
  disclosureGuard: "schema_valid",
  workflowStateValidator: "state_machine_safe",
};

const SMOKE_SUITE_SIZE = 10;

function selectSmokeCases(all: PromptEvalCase[]): PromptEvalCase[] {
  // Preserve insertion order so blocks are always enumerated in a deterministic sequence.
  const blockOrder: string[] = [];
  const byBlock: Record<string, PromptEvalCase[]> = {};
  for (const c of all) {
    if (c.category === "adversarial") continue;
    if (!byBlock[c.blockName]) {
      byBlock[c.blockName] = [];
      blockOrder.push(c.blockName);
    }
    byBlock[c.blockName].push(c);
  }

  // Phase 1 — GUARANTEED per-block coverage: take exactly one normal case from
  // every block so that no block can be silently excluded by a slice ceiling.
  const guaranteed: PromptEvalCase[] = [];
  const pool: PromptEvalCase[] = [];
  for (const blockName of blockOrder) {
    const normals = byBlock[blockName].filter((c) => c.category === "normal");
    if (normals.length === 0) continue;
    guaranteed.push(normals[0]);
    pool.push(...normals.slice(1));
  }

  if (guaranteed.length === 0) {
    throw new Error("Smoke suite: no normal cases found across any block");
  }

  // Phase 2 — FILL: add extra normal cases from the pool until we hit the
  // target size, giving broader variation without sacrificing per-block coverage.
  const needed = Math.max(0, SMOKE_SUITE_SIZE - guaranteed.length);
  const selected = [...guaranteed, ...pool.slice(0, needed)];

  return selected;
}

function runEvaluatorsOnCase(evalCase: PromptEvalCase): EvalResult {
  const startMs = Date.now();
  const assertionResults: AssertionResult[] = [];

  for (const [name, fn] of Object.entries(EVALUATOR_MAP)) {
    const outcome = fn(evalCase.mockResponse, evalCase.context);
    assertionResults.push({
      assertionType: EVALUATOR_ASSERTION_TYPES[name] ?? "schema_valid",
      pass: outcome.pass,
      reason: outcome.reason,
      path: name,
    });
  }

  const hardGateFailures = assertionResults.filter(
    (r) => !r.pass && HARD_GATE_EVALUATORS.includes(r.path as EvaluatorName),
  );

  const passed = hardGateFailures.length === 0;
  const failureReasons = assertionResults
    .filter((r) => !r.pass)
    .map((r) => `[${r.path}] ${r.reason ?? "failed"}`);

  const scores: Record<string, number> = {};
  for (const ar of assertionResults) {
    scores[ar.path] = ar.pass ? 1.0 : 0.0;
  }
  scores["hard_gate_pass_fail"] = passed ? 1.0 : 0.0;

  return {
    caseId: evalCase.id,
    blockName: evalCase.blockName,
    category: evalCase.category,
    assertionResults,
    scores,
    passed,
    failureReasons,
    durationMs: Date.now() - startMs,
  };
}

function runAdversarialCase(evalCase: PromptEvalCase): { caseId: string; blocked: boolean; blockingGuards: string[] } {
  const hardGateNames = HARD_GATE_EVALUATORS;
  const blockingGuards: string[] = [];

  for (const name of hardGateNames) {
    const fn = EVALUATOR_MAP[name];
    if (!fn) continue;
    const outcome = fn(evalCase.mockResponse, evalCase.context);
    if (!outcome.pass) {
      blockingGuards.push(`${name}: ${outcome.reason ?? "blocked"}`);
    }
  }

  return {
    caseId: evalCase.id,
    blocked: blockingGuards.length > 0,
    blockingGuards,
  };
}

function buildMarkdownReport(run: EvalRun): string {
  const lines: string[] = [];
  lines.push(`# Insights Prompt QA — Eval Run Report`);
  lines.push(`\n**Run ID:** ${run.runId}`);
  lines.push(`**Timestamp:** ${run.timestamp}`);
  lines.push(`**Mode:** ${run.mode}`);
  lines.push(`**Manifest Version:** ${run.promptManifestVersion}`);
  lines.push(`\n## Summary\n`);
  lines.push(`| Metric | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Total cases | ${run.summary.total} |`);
  lines.push(`| Passed | ${run.summary.passed} |`);
  lines.push(`| Failed | ${run.summary.failed} |`);
  lines.push(`| Critical gate failures | ${run.summary.criticalFailures} |`);
  lines.push(`| Adversarial blocked | ${run.summary.adversarialBlocked} |`);

  lines.push(`\n## Per-Case Results\n`);
  for (const r of run.results) {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    lines.push(`### ${status} [${r.caseId}] (${r.category})`);
    lines.push(`- Block: ${r.blockName}`);
    if (!r.passed && r.failureReasons.length > 0) {
      lines.push(`- Failures:`);
      for (const reason of r.failureReasons) {
        lines.push(`  - ${reason}`);
      }
    }
    if (r.durationMs !== undefined) {
      lines.push(`- Duration: ${r.durationMs}ms`);
    }
  }

  lines.push(`\n## Prompt Manifest\n`);
  lines.push("```");
  lines.push(getManifestSummary());
  lines.push("```");

  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith("--mode="))?.split("=")[1]
    ?? (args[args.indexOf("--mode") + 1]);
  const outputArg = args.find((a) => a.startsWith("--output="))?.split("=")[1]
    ?? (args[args.indexOf("--output") + 1]);

  const mode = (modeArg ?? "smoke") as "smoke" | "full" | "adversarial" | "live";
  const outputFormat = outputArg ?? "text";

  console.log(`\n🔍 Insights Prompt QA — running in ${mode.toUpperCase()} mode\n`);
  console.log(getManifestSummary());
  console.log();

  if (mode === "adversarial") {
    runAdversarialMode(ADVERSARIAL_ONLY, outputFormat);
    return;
  }

  if (mode === "live") {
    runLiveMode(selectSmokeCases(ALL_CASES), outputFormat);
    return;
  }

  let casesToRun: PromptEvalCase[];
  if (mode === "smoke") {
    casesToRun = selectSmokeCases(ALL_CASES);
  } else {
    casesToRun = ALL_CASES.filter((c) => c.category !== "adversarial");
  }

  const results: EvalResult[] = [];
  let criticalFailures = 0;
  const adversarialBlocked = 0;

  for (const evalCase of casesToRun) {
    process.stdout.write(`  Running [${evalCase.id}]... `);
    const result = runEvaluatorsOnCase(evalCase);
    results.push(result);

    if (result.passed) {
      console.log("PASS");
    } else {
      console.log(`FAIL — ${result.failureReasons.slice(0, 2).join(", ")}`);
      const isHardGateFail = result.assertionResults.some(
        (r) => !r.pass && HARD_GATE_EVALUATORS.includes(r.path as EvaluatorName),
      );
      if (isHardGateFail) criticalFailures++;
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  const run: EvalRun = {
    runId: randomUUID(),
    timestamp: new Date().toISOString(),
    promptManifestVersion: Object.values(PROMPT_MANIFEST)
      .map((b) => `${b.name}@${b.version}`)
      .join(","),
    mode,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      criticalFailures,
      adversarialBlocked,
    },
  };

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Results: ${passed}/${results.length} passed`);
  if (failed > 0) console.log(`Failed: ${failed} | Critical gate failures: ${criticalFailures}`);
  console.log(`${"─".repeat(60)}\n`);

  if (outputFormat === "json" || outputFormat === "both") {
    const outDir = join(process.cwd(), "evals", "reports");
    mkdirSync(outDir, { recursive: true });
    const jsonPath = join(outDir, `eval-run-${Date.now()}.json`);
    writeFileSync(jsonPath, JSON.stringify(run, null, 2));
    console.log(`📄 JSON report: ${jsonPath}`);
  }

  if (outputFormat === "markdown" || outputFormat === "both") {
    const outDir = join(process.cwd(), "evals", "reports");
    mkdirSync(outDir, { recursive: true });
    const mdPath = join(outDir, `eval-run-${Date.now()}.md`);
    writeFileSync(mdPath, buildMarkdownReport(run));
    console.log(`📝 Markdown report: ${mdPath}`);
  }

  if (criticalFailures > 0) {
    console.error(`\n❌ ${criticalFailures} critical gate failure(s) — exiting non-zero\n`);
    process.exit(1);
  }

  console.log(`✅ All critical gates passed\n`);
}

const BLOCK_CONTENT_MAP: Record<string, string> = {
  editorialIdentity: INSIGHTS_EDITORIAL_IDENTITY_BLOCK,
  primaryReader: INSIGHTS_PRIMARY_READER_BLOCK,
  planningScan: INSIGHTS_PLANNING_SCAN_BLOCK,
  lensInclusion: INSIGHTS_LENS_INCLUSION_BLOCK,
  epistemicDiscipline: INSIGHTS_EPISTEMIC_DISCIPLINE_BLOCK,
  lengthCompression: INSIGHTS_LENGTH_BLOCK,
  humanAuthenticity: INSIGHTS_HUMAN_AUTHENTICITY_BLOCK,
};

function composeCall1PlanningSystemPrompt(): string {
  // Authoritative: derive which blocks activate at call1_planning from the manifest,
  // in manifest compositionOrder, so prompt composition stays in sync with the version registry.
  const call1Entries = Object.entries(PROMPT_MANIFEST)
    .filter(([, entry]) => entry.activationStages.includes("call1_planning"))
    .sort((a, b) => a[1].compositionOrder - b[1].compositionOrder);

  const blocks = call1Entries
    .map(([name]) => BLOCK_CONTENT_MAP[name])
    .filter((b): b is string => Boolean(b));

  if (blocks.length === 0) {
    throw new Error(
      "composeCall1PlanningSystemPrompt: no call1_planning blocks found in PROMPT_MANIFEST — check manifest activationStages",
    );
  }

  return blocks.join("\n\n---\n\n");
}

function buildLiveUserMessage(evalCase: PromptEvalCase): string {
  const ctx = evalCase.context;
  return [
    `You are performing a call1_planning editorial assessment for an Insights article.`,
    `Context: contentType=${ctx.contentType}, mode=${ctx.mode}, hasAuthorInput=${ctx.hasAuthorInput}, sourcePackProvided=${ctx.sourcePackProvided}.`,
    `Primary question for this scenario: ${evalCase.description}`,
    `Respond with a complete insightsPlanningOutput JSON object conforming to the editorial system schema.`,
    `Output ONLY valid JSON. Do not include markdown code fences.`,
  ].join(" ");
}

function runEvaluatorsOnResponse(evalCase: PromptEvalCase, response: Record<string, any>): EvalResult {
  const syntheticCase: PromptEvalCase = { ...evalCase, mockResponse: response };
  return runEvaluatorsOnCase(syntheticCase);
}

function runLiveMode(cases: PromptEvalCase[], outputFormat: string): void {
  const apiKey = process.env.AI_INTEGRATIONS_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      "❌ Live eval mode requires AI_INTEGRATIONS_KEY or OPENAI_API_KEY.\n" +
        "   Set the environment variable and retry, or use --mode smoke for deterministic mock evaluation.",
    );
    process.exit(1);
  }

  const systemPrompt = composeCall1PlanningSystemPrompt();
  console.log(
    `  System prompt composed from ${Object.keys(PROMPT_MANIFEST).length} blocks (call1_planning stage).\n`,
  );

  const results: EvalResult[] = [];
  let criticalFailures = 0;

  const run = async () => {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_URL ?? undefined,
    });

    for (const evalCase of cases) {
      process.stdout.write(`  [LIVE] [${evalCase.id}]... `);
      try {
        const completion = await openai.chat.completions.create({
          model: process.env.INSIGHTS_EVAL_MODEL ?? "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: buildLiveUserMessage(evalCase) },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
          max_tokens: 2000,
        });
        const raw = completion.choices[0]?.message?.content ?? "{}";
        const liveResponse = JSON.parse(raw) as Record<string, any>;
        const result = runEvaluatorsOnResponse(evalCase, liveResponse);
        results.push(result);

        if (result.passed) {
          console.log("PASS");
        } else {
          console.log(`FAIL — ${result.failureReasons.slice(0, 2).join(", ")}`);
          const isHardGateFail = result.assertionResults.some(
            (r) => !r.pass && HARD_GATE_EVALUATORS.includes(r.path as EvaluatorName),
          );
          if (isHardGateFail) criticalFailures++;
        }

        const judgeScores = await Promise.all(
          DEFAULT_SEMANTIC_CONFIGS.map((cfg) =>
            evaluateSemanticDimension(cfg, liveResponse).catch((e) => ({
              dimension: cfg.dimension,
              score: 0,
              reason: `Judge error: ${e instanceof Error ? e.message : String(e)}`,
              enforcement: "advisory" as const,
              isAdvisory: true,
            })),
          ),
        );
        const summary = summarizeSemanticScores(judgeScores as any);
        const avgScore =
          judgeScores.reduce((s, j) => s + (j as any).score, 0) / judgeScores.length;
        console.log(
          `         Semantic judge: avg=${avgScore.toFixed(1)}/5 | veto flags=${summary.vetoDimensionFlags.length} | advisory=${summary.overallAdvisoryOnly}`,
        );
      } catch (err) {
        console.log(`ERROR — ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const passed = results.filter((r) => r.passed).length;
    const evalRun: EvalRun = {
      runId: randomUUID(),
      timestamp: new Date().toISOString(),
      promptManifestVersion: Object.values(PROMPT_MANIFEST)
        .map((b) => `${b.name}@${b.version}`)
        .join(","),
      mode: "live",
      results,
      summary: {
        total: results.length,
        passed,
        failed: results.length - passed,
        criticalFailures,
        adversarialBlocked: 0,
      },
    };

    console.log(`\n${"─".repeat(60)}`);
    console.log(`Live eval results: ${passed}/${results.length} passed`);
    if (criticalFailures > 0) console.log(`Critical gate failures: ${criticalFailures}`);
    console.log(`${"─".repeat(60)}\n`);

    if (outputFormat === "json" || outputFormat === "both") {
      const outDir = join(process.cwd(), "evals", "reports");
      mkdirSync(outDir, { recursive: true });
      const jsonPath = join(outDir, `eval-run-live-${Date.now()}.json`);
      writeFileSync(jsonPath, JSON.stringify(evalRun, null, 2));
      console.log(`📄 JSON report: ${jsonPath}`);
    }

    if (criticalFailures > 0) {
      console.error(`\n❌ ${criticalFailures} critical hard-gate failure(s) in live eval\n`);
      process.exit(1);
    }

    console.log(`✅ Live eval complete\n`);
  };

  run().catch((err) => {
    console.error(`\n❌ Live eval error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}

const BLOCKING_ASSERTION_TYPES = new Set([
  "no_first_person_without_input",
  "no_first_person",
  "state_machine_safe",
  "no_prompt_injection",
  "lens_count_valid",
  "no_pii",
  "requires_source",
  "word_budget_within_range",
]);

function hasBlockingAssertions(evalCase: PromptEvalCase): boolean {
  return evalCase.assertions.some((a) => BLOCKING_ASSERTION_TYPES.has(a.type));
}

function runAdversarialMode(cases: PromptEvalCase[], outputFormat: string): void {
  console.log(
    `Running ${cases.length} adversarial cases — BLOCKED = guard worked, MISS = declared guard missed, UNCOVERED = documented gap\n`,
  );

  const adversarialResults: Array<{
    caseId: string;
    blocked: boolean;
    uncovered: boolean;
    blockingGuards: string[];
  }> = [];
  let misses = 0;
  let blocked = 0;
  let uncovered = 0;

  for (const evalCase of cases) {
    process.stdout.write(`  [${evalCase.id}] ${evalCase.description.slice(0, 50)}... `);
    const result = runAdversarialCase(evalCase);
    const hasBlocking = hasBlockingAssertions(evalCase);
    const isUncovered = !result.blocked && !hasBlocking;

    adversarialResults.push({ ...result, uncovered: isUncovered });

    if (result.blocked) {
      console.log(`BLOCKED ✅ (${result.blockingGuards.length} guard(s))`);
      blocked++;
    } else if (isUncovered) {
      console.log(`UNCOVERED ⚠️  (documented gap — no hard gate assertion declared for this vector)`);
      uncovered++;
    } else {
      console.log(`MISS ❌ — declared hard gate did not catch this attack`);
      misses++;
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Adversarial results: ${blocked} blocked, ${uncovered} uncovered (gaps), ${misses} missed`);
  console.log(`${"─".repeat(60)}\n`);

  if (outputFormat === "json" || outputFormat === "both") {
    const outDir = join(process.cwd(), "evals", "reports");
    mkdirSync(outDir, { recursive: true });
    const jsonPath = join(outDir, `adversarial-run-${Date.now()}.json`);
    writeFileSync(
      jsonPath,
      JSON.stringify(
        { adversarialResults, blocked, uncovered, misses, timestamp: new Date().toISOString() },
        null,
        2,
      ),
    );
    console.log(`📄 JSON report: ${jsonPath}`);
  }

  if (uncovered > 0) {
    console.warn(
      `\n⚠️  ${uncovered} uncovered attack vector(s) — no blocking assertion declared for these cases (see follow-up task #1356 for content-type and outline-level guards):\n`,
    );
    for (const r of adversarialResults.filter((r) => r.uncovered)) {
      console.warn(`   UNCOVERED: ${r.caseId}`);
    }
    console.warn("");
  }

  if (misses > 0) {
    console.error(`\n❌ ${misses} adversarial miss(es) — declared hard gate assertion was not triggered\n`);
    for (const r of adversarialResults.filter((r) => !r.blocked && !r.uncovered)) {
      console.error(`   MISS: ${r.caseId}`);
    }
    process.exit(1);
  }

  console.log(`✅ All declared adversarial hard gates blocked their attacks\n`);
}

main();
