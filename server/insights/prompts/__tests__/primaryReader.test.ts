import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PRIMARY_READER_CASES } from "./primaryReader.cases";
import {
  schemaValidator,
  primaryReaderValidator,
  firstPersonGuard,
  privacyGuard,
  workflowStateValidator,
} from "../../evals/deterministicEvaluators";

describe("primaryReader prompt block — deterministic tests", () => {
  for (const evalCase of PRIMARY_READER_CASES) {
    describe(`[${evalCase.id}] ${evalCase.description}`, () => {
      it("passes schema validation", () => {
        const result = schemaValidator(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `Schema validation failed: ${result.reason}`);
      });

      it("primary reader validator", () => {
        const result = primaryReaderValidator(evalCase.mockResponse, evalCase.context);
        const expectedToFail = ["pr-adversarial-01", "pr-edge-01"];
        if (expectedToFail.includes(evalCase.id)) {
          assert.equal(result.pass, false, `${evalCase.id}: multi/vague audience should fail primary reader validator`);
        } else {
          assert.ok(result.pass, `Primary reader validator failed: ${result.reason}`);
        }
      });

      it("passes first-person guard", () => {
        const result = firstPersonGuard(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `First-person guard failed: ${result.reason}`);
      });

      it("passes privacy guard (no PII in primaryAudience)", () => {
        const result = privacyGuard(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `Privacy guard failed: ${result.reason}`);
      });

      it("passes workflow state validator", () => {
        const result = workflowStateValidator(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `Workflow state validator failed: ${result.reason}`);
      });

      it("primaryAudience is non-empty", () => {
        const audience = evalCase.mockResponse?.brief?.primaryAudience;
        assert.ok(typeof audience === "string" && audience.trim().length > 0, "primaryAudience must be non-empty");
      });

      it("primaryQuestion is non-empty", () => {
        const question = evalCase.mockResponse?.brief?.primaryQuestion;
        assert.ok(typeof question === "string" && question.trim().length > 0, "primaryQuestion must be non-empty");
      });
    });
  }

  describe("case set requirements", () => {
    it("has at least 5 normal cases", () => {
      const normals = PRIMARY_READER_CASES.filter((c) => c.category === "normal");
      assert.ok(normals.length >= 5, `Expected ≥5 normal cases, got ${normals.length}`);
    });

    it("has at least 3 edge cases", () => {
      const edges = PRIMARY_READER_CASES.filter((c) => c.category === "edge");
      assert.ok(edges.length >= 3, `Expected ≥3 edge cases, got ${edges.length}`);
    });

    it("has at least 2 adversarial cases", () => {
      const adversarials = PRIMARY_READER_CASES.filter((c) => c.category === "adversarial");
      assert.ok(adversarials.length >= 2, `Expected ≥2 adversarial cases, got ${adversarials.length}`);
    });

    it("has at least 1 hold case", () => {
      const holds = PRIMARY_READER_CASES.filter((c) => c.category === "hold_case");
      assert.ok(holds.length >= 1, `Expected ≥1 hold case, got ${holds.length}`);
    });

    it("all case IDs are unique", () => {
      const ids = PRIMARY_READER_CASES.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, "Duplicate case IDs found");
    });

    it("no normal case has a multi-audience primaryAudience", () => {
      const normals = PRIMARY_READER_CASES.filter((c) => c.category === "normal");
      for (const c of normals) {
        const audience = String(c.mockResponse?.brief?.primaryAudience ?? "");
        assert.ok(
          !audience.toLowerCase().includes("employers and candidates"),
          `Case ${c.id} normal case has multi-audience field: "${audience}"`,
        );
      }
    });
  });
});
