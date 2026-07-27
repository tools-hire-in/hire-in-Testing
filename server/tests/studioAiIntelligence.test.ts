/**
 * Unit tests for the Content Studio AI Intelligence layer.
 *
 * Tests buildSystemPrompt() (server/services/aiDraftService.ts) and the
 * intelligence block constants (server/intelligence/marketingIntelligence.ts).
 *
 * Run: npx tsx --test server/tests/studioAiIntelligence.test.ts
 *
 * No HTTP, no DB, no real AI calls. buildSystemPrompt() is a pure function.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLAIM_FREE_BLOCK,
  AUDIENCE_BLOCKS,
  DOMAIN_BLOCKS,
  MARKET_CONTEXT_BLOCKS,
  CONTENT_GOAL_BLOCKS,
  HOOK_ARCHETYPES_BLOCK,
  BANNED_SLOP_BLOCK,
} from "../intelligence/marketingIntelligence.js";
import { buildSystemPrompt } from "../services/aiDraftService.js";
import type { StudioPromptTemplate } from "../../shared/schema.js";
import type { AiGenerationParams } from "../../shared/studioAi.js";

// ---------------------------------------------------------------------------
// Minimal template stub (cast to satisfy the typed signature without a real DB row)
// ---------------------------------------------------------------------------
const BASE_TEMPLATE: StudioPromptTemplate = {
  id: "test-template",
  projectId: null,
  contentType: "article_generator",
  version: 1,
  isActive: true,
  systemPrompt: "You are a staffing industry content writer.",
  userPromptTemplate: "Write about: {{topic}}",
  modelName: "gpt-5.4",
  modelTier: "standard",
  maxTokens: 4000,
  outputSchemaRef: "article_draft",
  createdAt: new Date("2024-01-01"),
} as unknown as StudioPromptTemplate;

function thoughtLeadershipParams(overrides: Partial<AiGenerationParams> = {}): AiGenerationParams {
  return {
    contentGoal: "THOUGHT_LEADERSHIP",
    audience: "EMPLOYER_CLIENT",
    industry: "IT_STAFFING",
    marketContext: "COMMERCIAL",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Intelligence path activation
// ---------------------------------------------------------------------------
describe("Intelligence path activation", () => {
  it("THOUGHT_LEADERSHIP prompt contains HOOK_ARCHETYPES_BLOCK", () => {
    const prompt = buildSystemPrompt(BASE_TEMPLATE, thoughtLeadershipParams());
    assert.ok(
      prompt.includes("HOOK ENGINEERING"),
      "Expected HOOK_ARCHETYPES_BLOCK marker 'HOOK ENGINEERING' in prompt",
    );
  });

  it("THOUGHT_LEADERSHIP prompt contains BANNED_SLOP_BLOCK", () => {
    const prompt = buildSystemPrompt(BASE_TEMPLATE, thoughtLeadershipParams());
    assert.ok(
      prompt.includes("BANNED -- AI-SLOP"),
      "Expected BANNED_SLOP_BLOCK marker 'BANNED -- AI-SLOP' in prompt",
    );
  });

  it("THOUGHT_LEADERSHIP prompt contains CLAIM_FREE_BLOCK", () => {
    const prompt = buildSystemPrompt(BASE_TEMPLATE, thoughtLeadershipParams());
    assert.ok(
      prompt.includes("CLAIM-FREE-BY-DEFAULT RULE"),
      "Expected CLAIM_FREE_BLOCK marker 'CLAIM-FREE-BY-DEFAULT RULE' in prompt",
    );
  });

  it("Intelligence path prompt length exceeds 2000 chars", () => {
    const prompt = buildSystemPrompt(BASE_TEMPLATE, thoughtLeadershipParams());
    assert.ok(
      prompt.length > 2000,
      `Expected prompt.length > 2000, got ${prompt.length}`,
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Standard path fallback (no contentGoal)
// ---------------------------------------------------------------------------
describe("Standard path fallback", () => {
  it("Standard path prompt does NOT contain HOOK_ARCHETYPES_BLOCK", () => {
    const prompt = buildSystemPrompt(BASE_TEMPLATE, { industry: "IT_STAFFING" });
    assert.ok(
      !prompt.includes("HOOK ENGINEERING"),
      "Standard path must not include HOOK_ARCHETYPES_BLOCK",
    );
  });

  it("Standard path prompt length is under 500 chars", () => {
    const prompt = buildSystemPrompt(BASE_TEMPLATE, { industry: undefined });
    assert.ok(
      prompt.length < 500,
      `Expected standard path prompt.length < 500, got ${prompt.length}`,
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Content-goal coverage
// ---------------------------------------------------------------------------
describe("Content-goal coverage", () => {
  const goals = ["THOUGHT_LEADERSHIP", "EDUCATIONAL", "JOB_MARKETING", "BRAND_PERSPECTIVE"] as const;

  it("CONTENT_GOAL_BLOCKS has all four required keys", () => {
    for (const g of goals) {
      assert.ok(
        typeof CONTENT_GOAL_BLOCKS[g] === "string" && CONTENT_GOAL_BLOCKS[g].length > 0,
        `Expected non-empty CONTENT_GOAL_BLOCKS entry for ${g}`,
      );
    }
  });

  it("Each content goal produces a distinct prompt", () => {
    const prompts = goals.map((g) =>
      buildSystemPrompt(BASE_TEMPLATE, { contentGoal: g, marketContext: "COMMERCIAL" }),
    );
    const unique = new Set(prompts);
    assert.equal(unique.size, goals.length, "All four content-goal prompts must be unique");
  });

  it("Each content goal prompt contains its own goal block marker", () => {
    const markers: Record<string, string> = {
      THOUGHT_LEADERSHIP: "CONTENT GOAL: Thought Leadership",
      EDUCATIONAL:         "CONTENT GOAL: Educational",
      JOB_MARKETING:       "CONTENT GOAL: Job Marketing",
      BRAND_PERSPECTIVE:   "CONTENT GOAL: Brand Perspective",
    };
    for (const g of goals) {
      const prompt = buildSystemPrompt(BASE_TEMPLATE, { contentGoal: g, marketContext: "COMMERCIAL" });
      assert.ok(
        prompt.includes(markers[g]),
        `Expected '${markers[g]}' in ${g} prompt`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Audience injection
// ---------------------------------------------------------------------------
describe("Audience injection", () => {
  const audiences = ["EMPLOYER_CLIENT", "CANDIDATE", "MSP_VMS_PARTNER", "RECRUITER_OPERATOR"] as const;

  it("All four audience blocks have distinct content", () => {
    const blocks = audiences.map((a) => AUDIENCE_BLOCKS[a]);
    const unique = new Set(blocks);
    assert.equal(unique.size, audiences.length, "All audience blocks must be distinct");
  });

  it("EMPLOYER_CLIENT and CANDIDATE produce different prompts", () => {
    const employer = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ audience: "EMPLOYER_CLIENT" }),
    );
    const candidate = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ audience: "CANDIDATE" }),
    );
    assert.notEqual(employer, candidate, "EMPLOYER_CLIENT and CANDIDATE prompts must differ");
  });

  it("EMPLOYER_CLIENT prompt contains employer audience marker", () => {
    const prompt = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ audience: "EMPLOYER_CLIENT" }),
    );
    assert.ok(
      prompt.includes("AUDIENCE: Employer"),
      "Expected employer audience block in prompt",
    );
  });

  it("CANDIDATE prompt contains candidate audience marker", () => {
    const prompt = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ audience: "CANDIDATE" }),
    );
    assert.ok(
      prompt.includes("AUDIENCE: Candidate"),
      "Expected candidate audience block in prompt",
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Domain injection
// ---------------------------------------------------------------------------
describe("Domain injection", () => {
  it("IT_STAFFING and HEALTHCARE_STAFFING produce different domain blocks", () => {
    assert.notEqual(
      DOMAIN_BLOCKS["IT_STAFFING"],
      DOMAIN_BLOCKS["HEALTHCARE_STAFFING"],
      "IT and Healthcare domain blocks must be distinct",
    );
  });

  it("IT_STAFFING and HEALTHCARE_STAFFING produce different prompts", () => {
    const it = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ industry: "IT_STAFFING" }),
    );
    const hc = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ industry: "HEALTHCARE_STAFFING" }),
    );
    assert.notEqual(it, hc, "IT and healthcare prompts must differ");
  });

  it("Healthcare prompt contains the healthcare-safe pattern marker", () => {
    const prompt = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ industry: "HEALTHCARE_STAFFING" }),
    );
    assert.ok(
      prompt.includes("healthcare-safe"),
      "Healthcare domain prompt must contain 'healthcare-safe' marker",
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Claim-free enforcement
// ---------------------------------------------------------------------------
describe("Claim-free enforcement", () => {
  it("BRAND_PERSPECTIVE prompt contains the claim-free rule text", () => {
    const prompt = buildSystemPrompt(BASE_TEMPLATE, {
      contentGoal: "BRAND_PERSPECTIVE",
      marketContext: "COMMERCIAL",
    });
    assert.ok(
      prompt.includes("CLAIM-FREE-BY-DEFAULT RULE"),
      "BRAND_PERSPECTIVE prompt must contain CLAIM_FREE_BLOCK text",
    );
  });

  it("CLAIM_FREE_BLOCK instructs AI not to output NEEDS_PROOF markers", () => {
    // Verify the block explicitly bans [NEEDS_PROOF] output in generated content
    assert.ok(
      CLAIM_FREE_BLOCK.includes("[NEEDS_PROOF]"),
      "CLAIM_FREE_BLOCK must reference [NEEDS_PROOF] to ban it",
    );
    assert.ok(
      CLAIM_FREE_BLOCK.includes("Do not output"),
      "CLAIM_FREE_BLOCK must contain 'Do not output' instruction",
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Anti-slop block presence
// ---------------------------------------------------------------------------
describe("Anti-slop block presence", () => {
  const audiences = ["EMPLOYER_CLIENT", "CANDIDATE", "MSP_VMS_PARTNER", "RECRUITER_OPERATOR"] as const;

  for (const audience of audiences) {
    it(`THOUGHT_LEADERSHIP + ${audience} prompt always contains BANNED_SLOP_BLOCK`, () => {
      const prompt = buildSystemPrompt(
        BASE_TEMPLATE,
        thoughtLeadershipParams({ audience }),
      );
      assert.ok(
        prompt.includes("BANNED -- AI-SLOP"),
        `Expected BANNED_SLOP_BLOCK in THOUGHT_LEADERSHIP + ${audience} prompt`,
      );
    });
  }

  it("BANNED_SLOP_BLOCK includes 'game-changer' ban", () => {
    assert.ok(
      BANNED_SLOP_BLOCK.includes("game-changer"),
      "BANNED_SLOP_BLOCK must list 'game-changer' as a banned phrase",
    );
  });
});

// ---------------------------------------------------------------------------
// 8. Market context routing
// ---------------------------------------------------------------------------
describe("Market context routing", () => {
  it("STATE_GOVERNMENT, FEDERAL_GOVERNMENT, and COMMERCIAL produce distinct market context blocks", () => {
    assert.ok(
      MARKET_CONTEXT_BLOCKS["STATE_GOVERNMENT"] !== undefined,
      "STATE_GOVERNMENT market context block must exist",
    );
    assert.ok(
      MARKET_CONTEXT_BLOCKS["FEDERAL_GOVERNMENT"] !== undefined,
      "FEDERAL_GOVERNMENT market context block must exist",
    );
    assert.notEqual(
      MARKET_CONTEXT_BLOCKS["STATE_GOVERNMENT"],
      MARKET_CONTEXT_BLOCKS["FEDERAL_GOVERNMENT"],
      "STATE_GOVERNMENT and FEDERAL_GOVERNMENT blocks must be distinct",
    );
    assert.notEqual(
      MARKET_CONTEXT_BLOCKS["STATE_GOVERNMENT"],
      MARKET_CONTEXT_BLOCKS["COMMERCIAL"],
      "STATE_GOVERNMENT and COMMERCIAL blocks must be distinct",
    );
  });

  it("STATE_GOVERNMENT prompt differs from COMMERCIAL prompt", () => {
    const state = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ marketContext: "STATE_GOVERNMENT" }),
    );
    const commercial = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ marketContext: "COMMERCIAL" }),
    );
    assert.notEqual(state, commercial, "STATE_GOVERNMENT and COMMERCIAL prompts must differ");
  });

  it("FEDERAL_GOVERNMENT prompt differs from COMMERCIAL prompt", () => {
    const federal = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ marketContext: "FEDERAL_GOVERNMENT" }),
    );
    const commercial = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ marketContext: "COMMERCIAL" }),
    );
    assert.notEqual(federal, commercial, "FEDERAL_GOVERNMENT and COMMERCIAL prompts must differ");
  });

  it("STATE_GOVERNMENT prompt contains state-government marker", () => {
    const prompt = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ marketContext: "STATE_GOVERNMENT" }),
    );
    assert.ok(
      prompt.includes("State Government"),
      "STATE_GOVERNMENT prompt must contain 'State Government'",
    );
  });

  it("FEDERAL_GOVERNMENT prompt contains federal-government marker", () => {
    const prompt = buildSystemPrompt(
      BASE_TEMPLATE,
      thoughtLeadershipParams({ marketContext: "FEDERAL_GOVERNMENT" }),
    );
    assert.ok(
      prompt.includes("Federal Government"),
      "FEDERAL_GOVERNMENT prompt must contain 'Federal Government'",
    );
  });
});
