import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HUMAN_AUTHENTICITY_CASES } from "./humanAuthenticity.cases";
import {
  schemaValidator,
  firstPersonGuard,
  privacyGuard,
  workflowStateValidator,
  sourceRequirementGuard,
} from "../../evals/deterministicEvaluators";

describe("humanAuthenticity prompt block — deterministic tests", () => {
  for (const evalCase of HUMAN_AUTHENTICITY_CASES) {
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

      it("first-person guard — no invented experience without author input", () => {
        const result = firstPersonGuard(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `First-person guard failed: ${result.reason}`);
      });

      it("no-experience-input-but-first-person — hold cases trigger REVISE_BRIEF", () => {
        if (!evalCase.context.hasAuthorInput && evalCase.category === "hold_case") {
          const decision = evalCase.mockResponse?.decision;
          assert.equal(decision, "REVISE_BRIEF", `Hold case ${evalCase.id} should require REVISE_BRIEF`);
        }
      });

      it("source requirement for flagged cases", () => {
        if (evalCase.context.isHighRiskClaim) {
          const result = sourceRequirementGuard(evalCase.mockResponse, evalCase.context);
          assert.ok(result.pass, `Source requirement guard failed: ${result.reason}`);
        }
      });
    });
  }

  describe("case set requirements", () => {
    it("has at least 5 normal cases", () => {
      const normals = HUMAN_AUTHENTICITY_CASES.filter((c) => c.category === "normal");
      assert.ok(normals.length >= 5, `Expected ≥5 normal cases, got ${normals.length}`);
    });

    it("has at least 1 no-experience-input-but-first-person-requested case", () => {
      const hasCase = HUMAN_AUTHENTICITY_CASES.some(
        (c) =>
          !c.context.hasAuthorInput &&
          (c.tags.includes("author-experience") || c.tags.includes("personal-experience-flag")),
      );
      assert.ok(hasCase, "Must have at least one no-experience-input-but-first-person case");
    });

    it("has at least 3 edge cases", () => {
      const edges = HUMAN_AUTHENTICITY_CASES.filter((c) => c.category === "edge");
      assert.ok(edges.length >= 3, `Expected ≥3 edge cases, got ${edges.length}`);
    });

    it("has at least 2 adversarial cases", () => {
      const adversarials = HUMAN_AUTHENTICITY_CASES.filter((c) => c.category === "adversarial");
      assert.ok(adversarials.length >= 2, `Expected ≥2 adversarial cases, got ${adversarials.length}`);
    });

    it("has at least 1 hold case", () => {
      const holds = HUMAN_AUTHENTICITY_CASES.filter((c) => c.category === "hold_case");
      assert.ok(holds.length >= 1, `Expected ≥1 hold case, got ${holds.length}`);
    });

    it("all case IDs are unique", () => {
      const ids = HUMAN_AUTHENTICITY_CASES.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, "Duplicate case IDs found");
    });

    it("no normal case has invented personal anecdotes in outline", () => {
      const normals = HUMAN_AUTHENTICITY_CASES.filter((c) => c.category === "normal");
      const inventedPatterns = [
        /I spoke with/i,
        /our founder/i,
        /I remember/i,
        /I've seen/i,
      ];
      for (const c of normals) {
        const text = JSON.stringify(c.mockResponse);
        for (const pattern of inventedPatterns) {
          assert.ok(
            !pattern.test(text),
            `Case ${c.id} (normal) contains an invented personal anecdote pattern`,
          );
        }
      }
    });
  });
});
