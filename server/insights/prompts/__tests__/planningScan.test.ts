import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLANNING_SCAN_CASES } from "./planningScan.cases";
import {
  schemaValidator,
  stateValidator,
  sourceRequirementGuard,
  privacyGuard,
  workflowStateValidator,
  lensOveruseGuard,
} from "../../evals/deterministicEvaluators";

describe("planningScan prompt block — deterministic tests", () => {
  for (const evalCase of PLANNING_SCAN_CASES) {
    describe(`[${evalCase.id}] ${evalCase.description}`, () => {
      it("passes schema validation", () => {
        const result = schemaValidator(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `Schema validation failed: ${result.reason}`);
      });

      it("passes state validator", () => {
        const result = stateValidator(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `State validator failed: ${result.reason}`);
      });

      it("passes privacy guard", () => {
        const result = privacyGuard(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `Privacy guard failed: ${result.reason}`);
      });

      it("passes workflow state validator", () => {
        const result = workflowStateValidator(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `Workflow state validator failed: ${result.reason}`);
      });

      it("source requirement guard (high-risk contexts must flag sources)", () => {
        if (evalCase.context.isHighRiskClaim) {
          const result = sourceRequirementGuard(evalCase.mockResponse, evalCase.context);
          assert.ok(result.pass, `Source requirement guard failed for high-risk case: ${result.reason}`);
        }
      });

      it("stakeholderScan has all required fields", () => {
        const scan = evalCase.mockResponse?.stakeholderScan;
        assert.ok(scan, "stakeholderScan must be present");
        if (evalCase.category !== "adversarial") {
          assert.ok(typeof scan.employerImpact === "string" && scan.employerImpact.length > 0, "employerImpact must be non-empty");
          assert.ok(typeof scan.employeeCandidateImpact === "string" && scan.employeeCandidateImpact.length > 0, "employeeCandidateImpact must be non-empty");
          assert.ok(typeof scan.staffingMspImpact === "string" && scan.staffingMspImpact.length > 0, "staffingMspImpact must be non-empty");
        }
      });

      it("publishLenses has at least one entry", () => {
        const lenses = evalCase.mockResponse?.stakeholderScan?.publishLenses;
        assert.ok(Array.isArray(lenses) && lenses.length > 0, "publishLenses must have at least one entry");
      });

      it("lens overuse guard for Mode A cases", () => {
        if (evalCase.context.isModeA) {
          const result = lensOveruseGuard(evalCase.mockResponse, evalCase.context);
          if (evalCase.id === "ps-adversarial-02") {
            assert.equal(result.pass, false, "Mode C forced on single-lens topic should fail");
          } else {
            assert.ok(result.pass, `Lens overuse guard failed: ${result.reason}`);
          }
        }
      });
    });
  }

  describe("case set requirements", () => {
    it("has at least 5 normal cases", () => {
      const normals = PLANNING_SCAN_CASES.filter((c) => c.category === "normal");
      assert.ok(normals.length >= 5, `Expected ≥5 normal cases, got ${normals.length}`);
    });

    it("has at least 3 edge cases", () => {
      const edges = PLANNING_SCAN_CASES.filter((c) => c.category === "edge");
      assert.ok(edges.length >= 3, `Expected ≥3 edge cases, got ${edges.length}`);
    });

    it("has at least 2 adversarial cases", () => {
      const adversarials = PLANNING_SCAN_CASES.filter((c) => c.category === "adversarial");
      assert.ok(adversarials.length >= 2, `Expected ≥2 adversarial cases, got ${adversarials.length}`);
    });

    it("has at least 1 hold case", () => {
      const holds = PLANNING_SCAN_CASES.filter((c) => c.category === "hold_case");
      assert.ok(holds.length >= 1, `Expected ≥1 hold case, got ${holds.length}`);
    });

    it("all case IDs are unique", () => {
      const ids = PLANNING_SCAN_CASES.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, "Duplicate case IDs found");
    });

    it("all normal cases have a non-empty materialTradeoffs field", () => {
      const normals = PLANNING_SCAN_CASES.filter((c) => c.category === "normal");
      for (const c of normals) {
        const tradeoffs = c.mockResponse?.stakeholderScan?.materialTradeoffs;
        assert.ok(typeof tradeoffs === "string" && tradeoffs.length > 0, `Case ${c.id} missing materialTradeoffs`);
      }
    });
  });
});
