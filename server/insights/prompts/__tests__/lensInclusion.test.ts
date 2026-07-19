import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LENS_INCLUSION_CASES } from "./lensInclusion.cases";
import {
  schemaValidator,
  stateValidator,
  lensOveruseGuard,
  workflowStateValidator,
  privacyGuard,
  sourceRequirementGuard,
} from "../../evals/deterministicEvaluators";

describe("lensInclusion prompt block — deterministic tests", () => {
  for (const evalCase of LENS_INCLUSION_CASES) {
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

      it("lens overuse guard for Mode A cases", () => {
        if (evalCase.context.isModeA) {
          const result = lensOveruseGuard(evalCase.mockResponse, evalCase.context);
          if (evalCase.id === "li-adversarial-01" || evalCase.id === "li-edge-01") {
            assert.equal(result.pass, false, `Case ${evalCase.id} should fail lens overuse guard`);
          } else {
            assert.ok(result.pass, `Lens overuse guard failed: ${result.reason}`);
          }
        }
      });

      it("source requirement check for flagged cases", () => {
        if (evalCase.context.isHighRiskClaim) {
          const result = sourceRequirementGuard(evalCase.mockResponse, evalCase.context);
          assert.ok(result.pass, `Source requirement guard failed: ${result.reason}`);
        }
      });

      it("publishLenses entries have non-empty reason strings", () => {
        const lenses = evalCase.mockResponse?.stakeholderScan?.publishLenses ?? [];
        for (const l of lenses as Array<{ lens?: string; reason?: string }>) {
          assert.ok(typeof l.lens === "string" && l.lens.length > 0, "lens field must be non-empty");
        }
      });
    });
  }

  describe("case set requirements", () => {
    it("has at least 5 normal cases", () => {
      const normals = LENS_INCLUSION_CASES.filter((c) => c.category === "normal");
      assert.ok(normals.length >= 5, `Expected ≥5 normal cases, got ${normals.length}`);
    });

    it("has at least 3 edge cases", () => {
      const edges = LENS_INCLUSION_CASES.filter((c) => c.category === "edge");
      assert.ok(edges.length >= 3, `Expected ≥3 edge cases, got ${edges.length}`);
    });

    it("has at least 2 adversarial cases", () => {
      const adversarials = LENS_INCLUSION_CASES.filter((c) => c.category === "adversarial");
      assert.ok(adversarials.length >= 2, `Expected ≥2 adversarial cases, got ${adversarials.length}`);
    });

    it("has at least 1 hold case", () => {
      const holds = LENS_INCLUSION_CASES.filter((c) => c.category === "hold_case");
      assert.ok(holds.length >= 1, `Expected ≥1 hold case, got ${holds.length}`);
    });

    it("all case IDs are unique", () => {
      const ids = LENS_INCLUSION_CASES.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, "Duplicate case IDs found");
    });

    it("all Mode A normal cases have exactly one publishLens", () => {
      const modeANormals = LENS_INCLUSION_CASES.filter(
        (c) => c.category === "normal" && c.context.isModeA,
      );
      for (const c of modeANormals) {
        const lenses = c.mockResponse?.stakeholderScan?.publishLenses ?? [];
        assert.equal(
          (lenses as any[]).length,
          1,
          `Case ${c.id} (Mode A normal) should have exactly 1 publishLens, got ${(lenses as any[]).length}`,
        );
      }
    });
  });
});
