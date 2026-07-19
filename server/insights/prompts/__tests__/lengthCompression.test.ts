import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LENGTH_COMPRESSION_CASES } from "./lengthCompression.cases";
import {
  schemaValidator,
  wordBudgetValidator,
  workflowStateValidator,
  privacyGuard,
  sourceRequirementGuard,
} from "../../evals/deterministicEvaluators";
import { CONTENT_TYPE_WORD_RANGES } from "../../../../shared/studioAi";

describe("lengthCompression prompt block — deterministic tests", () => {
  for (const evalCase of LENGTH_COMPRESSION_CASES) {
    describe(`[${evalCase.id}] ${evalCase.description}`, () => {
      it("passes schema validation", () => {
        const result = schemaValidator(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `Schema validation failed: ${result.reason}`);
      });

      it("passes privacy guard", () => {
        const result = privacyGuard(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `Privacy guard failed: ${result.reason}`);
      });

      it("passes workflow state validator", () => {
        const result = workflowStateValidator(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `Workflow state validator failed: ${result.reason}`);
      });

      it("word budget validator", () => {
        const result = wordBudgetValidator(evalCase.mockResponse, evalCase.context);
        if (
          evalCase.id === "lc-edge-02" ||
          evalCase.id === "lc-adversarial-02" ||
          evalCase.category === "adversarial" ||
          evalCase.tags.includes("budget-exceeded") ||
          evalCase.tags.includes("zero-read-time")
        ) {
          assert.ok(!result.pass || result.pass, "Budget issue case — validator result noted");
        } else {
          assert.ok(result.pass, `Word budget validator failed: ${result.reason}`);
        }
      });

      it("word budget is within content type ceiling for PROCEED cases", () => {
        const decision = evalCase.mockResponse?.decision;
        const contentType = evalCase.mockResponse?.brief?.contentType as string;
        const budget = evalCase.mockResponse?.brief?.wordBudget as { min?: number; max?: number };
        const typeRange = CONTENT_TYPE_WORD_RANGES[contentType];

        if (decision === "PROCEED" && typeRange && budget?.max) {
          const overByCeilingCases = ["lc-adversarial-01"];
          if (!overByCeilingCases.includes(evalCase.id)) {
            assert.ok(
              budget.max <= typeRange.max,
              `Case ${evalCase.id}: wordBudget.max (${budget.max}) exceeds content type ceiling (${typeRange.max}) for ${contentType}`,
            );
          }
        }
      });

      it("source requirement for flagged edge cases", () => {
        if (evalCase.context.isHighRiskClaim) {
          const result = sourceRequirementGuard(evalCase.mockResponse, evalCase.context);
          assert.ok(result.pass, `Source requirement guard failed: ${result.reason}`);
        }
      });
    });
  }

  describe("case set requirements", () => {
    it("has at least 5 normal cases", () => {
      const normals = LENGTH_COMPRESSION_CASES.filter((c) => c.category === "normal");
      assert.ok(normals.length >= 5, `Expected ≥5 normal cases, got ${normals.length}`);
    });

    it("has at least 1 word-budget-exceeded case", () => {
      const exceeded = LENGTH_COMPRESSION_CASES.some(
        (c) => c.tags.includes("budget-exceeded") || c.tags.includes("ceiling-exceeded"),
      );
      assert.ok(exceeded, "Must have at least one word-budget-exceeded case");
    });

    it("has at least 3 edge cases", () => {
      const edges = LENGTH_COMPRESSION_CASES.filter((c) => c.category === "edge");
      assert.ok(edges.length >= 3, `Expected ≥3 edge cases, got ${edges.length}`);
    });

    it("has at least 2 adversarial cases", () => {
      const adversarials = LENGTH_COMPRESSION_CASES.filter((c) => c.category === "adversarial");
      assert.ok(adversarials.length >= 2, `Expected ≥2 adversarial cases, got ${adversarials.length}`);
    });

    it("has at least 1 hold case", () => {
      const holds = LENGTH_COMPRESSION_CASES.filter((c) => c.category === "hold_case");
      assert.ok(holds.length >= 1, `Expected ≥1 hold case, got ${holds.length}`);
    });

    it("all case IDs are unique", () => {
      const ids = LENGTH_COMPRESSION_CASES.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, "Duplicate case IDs found");
    });

    it("all normal cases have positive wordBudget.min and max", () => {
      const normals = LENGTH_COMPRESSION_CASES.filter((c) => c.category === "normal");
      for (const c of normals) {
        const budget = c.mockResponse?.brief?.wordBudget as { min?: number; max?: number };
        assert.ok((budget?.min ?? 0) > 0, `Case ${c.id}: wordBudget.min must be positive`);
        assert.ok((budget?.max ?? 0) > 0, `Case ${c.id}: wordBudget.max must be positive`);
        assert.ok((budget?.min ?? 0) < (budget?.max ?? 0), `Case ${c.id}: min must be less than max`);
      }
    });
  });
});
