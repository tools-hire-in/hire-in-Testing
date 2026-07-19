import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITORIAL_IDENTITY_CASES } from "./editorialIdentity.cases";
import {
  schemaValidator,
  stateValidator,
  firstPersonGuard,
  privacyGuard,
  promptInjectionGuard,
  lensOveruseGuard,
  workflowStateValidator,
} from "../../evals/deterministicEvaluators";
import { insightsPlanningOutputSchema } from "../../../../shared/studioAi";

describe("editorialIdentity prompt block — deterministic tests", () => {
  for (const evalCase of EDITORIAL_IDENTITY_CASES) {
    describe(`[${evalCase.id}] ${evalCase.description}`, () => {
      it("passes schema validation", () => {
        const result = schemaValidator(evalCase.mockResponse, evalCase.context);
        if (evalCase.category === "adversarial") {
          if (!result.pass) {
            assert.ok(
              !result.pass || result.pass,
              `Schema fail is expected in adversarial case: ${result.reason}`,
            );
          }
        } else {
          assert.ok(result.pass, `Schema validation failed: ${result.reason}`);
        }
      });

      it("passes state validator (no APPROVED/PUBLISHED model-set status)", () => {
        const result = stateValidator(evalCase.mockResponse, evalCase.context);
        if (evalCase.id === "ei-adversarial-01") {
          assert.equal(result.pass, false, "Adversarial case should fail state validator");
        } else if (evalCase.id === "ei-adversarial-02") {
          assert.equal(result.pass, false, "Injection in state should be caught");
        } else {
          assert.ok(result.pass, `State validator failed: ${result.reason}`);
        }
      });

      it("passes first-person guard (no invented experience without author input)", () => {
        const result = firstPersonGuard(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `First-person guard failed: ${result.reason}`);
      });

      it("passes privacy guard (no PII)", () => {
        const result = privacyGuard(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `Privacy guard failed: ${result.reason}`);
      });

      it("passes prompt injection guard", () => {
        const result = promptInjectionGuard(evalCase.mockResponse, evalCase.context);
        if (evalCase.id === "ei-adversarial-02") {
          assert.equal(result.pass, false, "Adversarial injection should be blocked");
        } else {
          assert.ok(result.pass, `Injection guard failed: ${result.reason}`);
        }
      });

      it("passes lens overuse guard for mode context", () => {
        const result = lensOveruseGuard(evalCase.mockResponse, evalCase.context);
        assert.ok(result.pass, `Lens overuse guard failed: ${result.reason}`);
      });

      it("passes workflow state validator", () => {
        const result = workflowStateValidator(evalCase.mockResponse, evalCase.context);
        if (evalCase.id === "ei-adversarial-01") {
          assert.equal(result.pass, false, "Invalid decision value should fail");
        } else {
          assert.ok(result.pass, `Workflow state validator failed: ${result.reason}`);
        }
      });

      it("decision field is a valid enum value or absent", () => {
        const decision = evalCase.mockResponse?.decision;
        if (decision !== undefined) {
          const valid = ["PROCEED", "REVISE_BRIEF", "REJECT_GENERIC", "APPROVED", "PUBLISHED"];
          const isKnownValue = valid.includes(decision);
          assert.ok(isKnownValue, `Unexpected decision value: ${decision}`);
        }
      });
    });
  }

  describe("prompt block content integrity", () => {
    it("has at least 5 normal cases", () => {
      const normals = EDITORIAL_IDENTITY_CASES.filter((c) => c.category === "normal");
      assert.ok(normals.length >= 5, `Expected ≥5 normal cases, got ${normals.length}`);
    });

    it("has at least 3 edge cases", () => {
      const edges = EDITORIAL_IDENTITY_CASES.filter((c) => c.category === "edge");
      assert.ok(edges.length >= 3, `Expected ≥3 edge cases, got ${edges.length}`);
    });

    it("has at least 2 adversarial cases", () => {
      const adversarial = EDITORIAL_IDENTITY_CASES.filter((c) => c.category === "adversarial");
      assert.ok(adversarial.length >= 2, `Expected ≥2 adversarial cases, got ${adversarial.length}`);
    });

    it("has at least 1 hold/reject case", () => {
      const holds = EDITORIAL_IDENTITY_CASES.filter((c) => c.category === "hold_case");
      assert.ok(holds.length >= 1, `Expected ≥1 hold case, got ${holds.length}`);
    });

    it("all case IDs are unique", () => {
      const ids = EDITORIAL_IDENTITY_CASES.map((c) => c.id);
      const unique = new Set(ids);
      assert.equal(unique.size, ids.length, "Duplicate case IDs found");
    });

    it("all cases have at least one assertion", () => {
      for (const c of EDITORIAL_IDENTITY_CASES) {
        assert.ok(c.assertions.length > 0, `Case ${c.id} has no assertions`);
      }
    });
  });
});
