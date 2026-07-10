import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  articleBylineRequired,
  isValidArticleContentType,
  VALID_ARTICLE_CONTENT_TYPES,
  getPipelineContentType,
  isValidIdeaTransition,
  STUDIO_CONTENT_TYPES,
} from "../../shared/studioContent";

describe("articleBylineRequired — config-driven byline gate", () => {
  it("requires a byline for the Article pipeline type (bylineRequired=true)", () => {
    assert.equal(getPipelineContentType("article")?.bylineRequired, true);
    assert.equal(articleBylineRequired("article"), true);
  });

  it("requires a byline for every editorial read-time subtype", () => {
    for (const t of STUDIO_CONTENT_TYPES) {
      assert.equal(articleBylineRequired(t.value), true, `expected byline required for ${t.value}`);
    }
  });

  it("requires a byline when content type is unset (legacy default = article)", () => {
    assert.equal(articleBylineRequired(null), true);
    assert.equal(articleBylineRequired(undefined), true);
    assert.equal(articleBylineRequired(""), true);
  });

  it("does NOT require a byline for social-family drafts (social_post, story)", () => {
    assert.equal(getPipelineContentType("social_post")?.bylineRequired, false);
    assert.equal(getPipelineContentType("story")?.bylineRequired, false);
    assert.equal(articleBylineRequired("social_post"), false);
    assert.equal(articleBylineRequired("story"), false);
  });

  it("fails safe (byline required) for unknown content types", () => {
    assert.equal(articleBylineRequired("mystery_type"), true);
  });
});

describe("studio_articles content-type contract", () => {
  it("accepts legacy article + editorial subtypes", () => {
    assert.equal(isValidArticleContentType("article"), true);
    for (const t of STUDIO_CONTENT_TYPES) {
      assert.equal(isValidArticleContentType(t.value), true);
    }
  });

  it("accepts social-family values created by the Social Kit promote bridge", () => {
    assert.equal(isValidArticleContentType("social_post"), true);
    assert.equal(isValidArticleContentType("story"), true);
  });

  it("rejects unknown / empty values", () => {
    assert.equal(isValidArticleContentType("blog_post"), false);
    assert.equal(isValidArticleContentType(""), false);
    assert.equal(isValidArticleContentType(null), false);
  });

  it("has no duplicate entries", () => {
    assert.equal(new Set(VALID_ARTICLE_CONTENT_TYPES).size, VALID_ARTICLE_CONTENT_TYPES.length);
  });
});

describe("idea state machine — decision vs. edit transitions", () => {
  it("review decisions only exist out of in_review", () => {
    assert.equal(isValidIdeaTransition("in_review", "approved"), true);
    assert.equal(isValidIdeaTransition("in_review", "changes_requested"), true);
    assert.equal(isValidIdeaTransition("idea", "approved"), false);
    assert.equal(isValidIdeaTransition("suggested", "approved"), false);
  });

  it("approved ideas can enter production or scheduling", () => {
    assert.equal(isValidIdeaTransition("approved", "in_production"), true);
    assert.equal(isValidIdeaTransition("approved", "scheduled"), true);
    assert.equal(isValidIdeaTransition("done", "idea"), false);
  });
});
