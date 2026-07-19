import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EPISTEMIC_DISCIPLINE_CASES } from "./epistemicDiscipline.cases";
import {
  schemaValidator,
  firstPersonGuard,
  sourceRequirementGuard,
  workflowStateValidator,
  privacyGuard,
} from "../../evals/deterministicEvaluators";

describe("epistemicDiscipline prompt block — deterministic tests", () => {
  for (const evalCase of EPISTEMIC_DISCIPLINE_CASES) {
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

      it("first-person guard in no-author-input context", () => {
        if (!evalCase.context.hasAuthorInput) {
          const result = firstPersonGuard(evalCase.mockResponse, evalCase.context);
          assert.ok(result.pass, `First-person guard failed without author input: ${result.reason}`);
        }
      });

      it("source requirement guard for high-risk claim cases", () => {
        if (evalCase.context.isHighRiskClaim) {
          const result = sourceRequirementGuard(evalCase.mockResponse, evalCase.context);
          if (evalCase.category === "adversarial") {
            assert.equal(result.pass, false, `${evalCase.id}: adversarial case (unsourced claim) should fail source requirement guard`);
          } else {
            assert.ok(result.pass, `Source requirement guard failed: ${result.reason}`);
          }
        }
      });

      it("researchQuestions array is present and non-empty for PROCEED cases", () => {
        const decision = evalCase.mockResponse?.decision;
        if (decision === "PROCEED") {
          const questions = evalCase.mockResponse?.researchQuestions;
          assert.ok(Array.isArray(questions) && questions.length > 0, "PROCEED case must have researchQuestions");
        }
      });
    });
  }

  describe("case set requirements", () => {
    it("has at least 5 normal cases", () => {
      const normals = EPISTEMIC_DISCIPLINE_CASES.filter((c) => c.category === "normal");
      assert.ok(normals.length >= 5, `Expected ≥5 normal cases, got ${normals.length}`);
    });

    it("has at least 1 unsupported-claim case", () => {
      const hasUnsupported = EPISTEMIC_DISCIPLINE_CASES.some(
        (c) => c.tags.includes("unsupported-claim") || c.tags.includes("false-verification") || c.tags.includes("legal-certainty"),
      );
      assert.ok(hasUnsupported, "Must have at least one unsupported-claim edge/adversarial case");
    });

    it("has at least 3 edge cases", () => {
      const edges = EPISTEMIC_DISCIPLINE_CASES.filter((c) => c.category === "edge");
      assert.ok(edges.length >= 3, `Expected ≥3 edge cases, got ${edges.length}`);
    });

    it("has at least 2 adversarial cases", () => {
      const adversarials = EPISTEMIC_DISCIPLINE_CASES.filter((c) => c.category === "adversarial");
      assert.ok(adversarials.length >= 2, `Expected ≥2 adversarial cases, got ${adversarials.length}`);
    });

    it("has at least 1 hold case", () => {
      const holds = EPISTEMIC_DISCIPLINE_CASES.filter((c) => c.category === "hold_case");
      assert.ok(holds.length >= 1, `Expected ≥1 hold case, got ${holds.length}`);
    });

    it("all case IDs are unique", () => {
      const ids = EPISTEMIC_DISCIPLINE_CASES.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, "Duplicate case IDs found");
    });
  });
});
