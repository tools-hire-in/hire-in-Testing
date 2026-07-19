import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ADVERSARIAL_CASES } from "./adversarial.cases";
import {
  schemaValidator,
  stateValidator,
  firstPersonGuard,
  privacyGuard,
  promptInjectionGuard,
  workflowStateValidator,
  sourceRequirementGuard,
  wordBudgetValidator,
} from "../../evals/deterministicEvaluators";

const EXPECTED_SCHEMA_FAILURES: string[] = [
  "adv-03-governance-override",
  "adv-09-self-approval",
];

const EXPECTED_FAILURES: Record<string, string[]> = {
  "adv-03-governance-override": ["stateValidator", "workflowStateValidator"],
  "adv-09-self-approval": ["stateValidator", "workflowStateValidator"],
};

const EXPECTED_INJECTION: string[] = ["adv-03-governance-override"];

const EXPECTED_FIRST_PERSON: string[] = [
  "adv-01-founder-anecdote",
  "adv-06-client-name-request",
  "adv-10-artificial-humanization",
];

const EXPECTED_SOURCE_FAILURES: string[] = [
  "adv-02-false-metric",
  "adv-04-legal-certainty",
  "adv-05-conflicting-studies",
  "adv-07-false-consensus",
];

const EXPECTED_WORD_BUDGET_FAILURES: string[] = ["adv-08-word-budget-pressure"];

describe("adversarial cases (Section 23.4) — deterministic evaluator blocking tests", () => {
  for (const evalCase of ADVERSARIAL_CASES) {
    describe(`[${evalCase.id}] ${evalCase.description}`, () => {
      it("schema validation (adversarial responses may still conform to schema)", () => {
        const result = schemaValidator(evalCase.mockResponse, evalCase.context);
        if (EXPECTED_SCHEMA_FAILURES.includes(evalCase.id)) {
          assert.equal(result.pass, false, `${evalCase.id}: schema must reject invalid decision value APPROVED`);
        } else {
          assert.equal(result.pass, true, `${evalCase.id}: adversarial mock must conform to schema (attack is semantic, not structural)`);
        }
      });

      it("state validator blocks self-approval attempts", () => {
        const result = stateValidator(evalCase.mockResponse, evalCase.context);
        if (EXPECTED_FAILURES[evalCase.id]?.includes("stateValidator")) {
          assert.equal(result.pass, false, `${evalCase.id}: state validator must block this attack`);
        } else {
          assert.equal(result.pass, true, `${evalCase.id}: state validator must pass benign cases`);
        }
      });

      it("workflow state validator blocks invalid decisions", () => {
        const result = workflowStateValidator(evalCase.mockResponse, evalCase.context);
        if (EXPECTED_FAILURES[evalCase.id]?.includes("workflowStateValidator")) {
          assert.equal(result.pass, false, `${evalCase.id}: workflow state validator must block`);
        } else {
          assert.equal(result.pass, true, `${evalCase.id}: workflow state validator must pass benign cases`);
        }
      });

      it("first-person guard blocks invented-experience adversarial cases", () => {
        const result = firstPersonGuard(evalCase.mockResponse, evalCase.context);
        if (EXPECTED_FIRST_PERSON.includes(evalCase.id)) {
          assert.equal(result.pass, false, `${evalCase.id}: first-person guard must block invented experience`);
        } else {
          assert.equal(result.pass, true, `${evalCase.id}: first-person guard must pass non-first-person cases`);
        }
      });

      it("privacy guard runs without false positives on adversarial mocks", () => {
        const result = privacyGuard(evalCase.mockResponse, evalCase.context);
        assert.equal(result.pass, true, `${evalCase.id}: adversarial mocks must not contain raw PII patterns (email/phone/SSN)`);
      });

      it("prompt injection guard detects governance override attacks", () => {
        const result = promptInjectionGuard(evalCase.mockResponse, evalCase.context);
        if (EXPECTED_INJECTION.includes(evalCase.id)) {
          assert.equal(result.pass, false, `${evalCase.id}: injection guard must block this attack`);
        } else {
          assert.equal(result.pass, true, `${evalCase.id}: injection guard must pass non-injection cases`);
        }
      });

      it("source requirement guard blocks high-risk claims with empty riskFlags", () => {
        if (EXPECTED_SOURCE_FAILURES.includes(evalCase.id)) {
          const result = sourceRequirementGuard(evalCase.mockResponse, evalCase.context);
          assert.equal(result.pass, false, `${evalCase.id}: source guard must block high-risk claim with no riskFlags`);
        } else if (!evalCase.context.isHighRiskClaim) {
          const result = sourceRequirementGuard(evalCase.mockResponse, evalCase.context);
          assert.equal(result.pass, true, `${evalCase.id}: source guard must pass non-high-risk cases`);
        }
      });

      it("word budget validator blocks content-type ceiling violations", () => {
        if (EXPECTED_WORD_BUDGET_FAILURES.includes(evalCase.id)) {
          const result = wordBudgetValidator(evalCase.mockResponse, evalCase.context);
          assert.equal(result.pass, false, `${evalCase.id}: word budget validator must block ceiling violation`);
        } else {
          const result = wordBudgetValidator(evalCase.mockResponse, evalCase.context);
          assert.equal(result.pass, true, `${evalCase.id}: word budget validator must pass valid budgets`);
        }
      });
    });
  }

  describe("adversarial case set requirements", () => {
    it("has exactly 10 Section 23.4 adversarial cases", () => {
      const section234Cases = ADVERSARIAL_CASES.filter((c) => c.tags.includes("section-23.4"));
      assert.equal(section234Cases.length, 10, `Expected exactly 10 Section 23.4 adversarial cases, got ${section234Cases.length}`);
    });

    it("all case IDs are unique", () => {
      const ids = ADVERSARIAL_CASES.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, "Duplicate adversarial case IDs found");
    });

    it("all cases have category = adversarial", () => {
      for (const c of ADVERSARIAL_CASES) {
        assert.equal(c.category, "adversarial", `Case ${c.id} must have category=adversarial`);
      }
    });

    it("covers governance override attack vector", () => {
      const hasGovernanceOverride = ADVERSARIAL_CASES.some(
        (c) => c.tags.includes("governance-override") || c.tags.includes("source-injection"),
      );
      assert.ok(hasGovernanceOverride, "Must have governance override adversarial case");
    });

    it("covers self-approval attack vector", () => {
      const hasSelfApproval = ADVERSARIAL_CASES.some(
        (c) => c.tags.includes("self-approval") || c.tags.includes("state-machine"),
      );
      assert.ok(hasSelfApproval, "Must have self-approval adversarial case");
    });

    it("covers first-person invention attack vector", () => {
      const hasFirstPerson = ADVERSARIAL_CASES.some(
        (c) =>
          c.tags.includes("invented-anecdote") ||
          c.tags.includes("artificial-humanization"),
      );
      assert.ok(hasFirstPerson, "Must have first-person invention adversarial case");
    });

    it("covers false metric attack vector", () => {
      const hasFalseMetric = ADVERSARIAL_CASES.some(
        (c) => c.tags.includes("false-metric") || c.tags.includes("false-verification"),
      );
      assert.ok(hasFalseMetric, "Must have false metric adversarial case");
    });

    it("covers word budget pressure attack vector", () => {
      const hasWordBudget = ADVERSARIAL_CASES.some(
        (c) => c.tags.includes("word-budget-pressure") || c.tags.includes("ceiling-exceeded"),
      );
      assert.ok(hasWordBudget, "Must have word budget pressure adversarial case");
    });
  });
});
