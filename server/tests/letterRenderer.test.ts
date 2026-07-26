import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderLetter,
  render,
  flattenPara,
  COMPANY_NAME,
  formatLetterDate,
  type LetterRenderData,
} from "../../shared/letterRenderer";
import { hrLetterConfig } from "../../shared/letterTemplates/hrLetter";
import { amendmentConfig } from "../../shared/letterTemplates/amendment";

const base: LetterRenderData = {
  templateType: "experience",
  employeeName: "Alice Smith",
  designation: "Software Engineer",
  department: "Engineering",
  startDate: "2023-01-15",
  endDate: "2024-06-30",
  signatoryName: "HR Manager",
  signatoryDesignation: "Head of HR",
};

describe("renderLetter — experience", () => {
  it("produces a non-empty body", () => {
    const r = renderLetter(base);
    assert.ok(r.body.length > 0, "body should have paragraphs");
  });

  it("title is EXPERIENCE LETTER", () => {
    const r = renderLetter(base);
    assert.equal(r.title, "EXPERIENCE LETTER");
  });

  it("first paragraph contains employee name as bold span", () => {
    const r = renderLetter(base);
    const para = r.body[0]!;
    const boldSpans = para.filter(s => s.b);
    assert.ok(boldSpans.some(s => s.t === "Alice Smith"), "name should be bold in first para");
  });

  it("first paragraph contains company name as bold span", () => {
    const r = renderLetter(base);
    const para = r.body[0]!;
    const boldSpans = para.filter(s => s.b);
    assert.ok(boldSpans.some(s => s.t === COMPANY_NAME), "company name should be bold");
  });

  it("first paragraph contains designation as bold span", () => {
    const r = renderLetter(base);
    const para = r.body[0]!;
    const boldSpans = para.filter(s => s.b);
    assert.ok(boldSpans.some(s => s.t === "Software Engineer"), "designation should be bold");
  });

  it("includes performance band paragraph when set", () => {
    const r = renderLetter({ ...base, performanceBand: "standard" });
    assert.ok(r.body.length > 1, "should have extra paragraph for performance band");
  });

  it("includes conduct band paragraph when set", () => {
    const r = renderLetter({ ...base, conductBand: "good" });
    assert.ok(r.body.length > 1, "should have extra paragraph for conduct band");
  });

  it("ref text says Draft when no referenceNumber", () => {
    const r = renderLetter(base);
    assert.equal(r.refText, "Draft");
  });

  it("ref text includes reference number when set", () => {
    const r = renderLetter({ ...base, referenceNumber: "REF-001" });
    assert.equal(r.refText, "Ref: REF-001");
  });
});

describe("renderLetter — internship_completion", () => {
  const internBase: LetterRenderData = {
    ...base,
    templateType: "internship_completion",
    employeeCode: "INT-001",
  };

  it("title is INTERNSHIP COMPLETION LETTER", () => {
    const r = renderLetter(internBase);
    assert.equal(r.title, "INTERNSHIP COMPLETION LETTER");
  });

  it("includes project paragraph when includeProject + projectName set", () => {
    const r = renderLetter({ ...internBase, includeProject: true, projectName: "Web App" });
    const bodyText = r.body.map(p => flattenPara(p)).join(" ");
    assert.ok(bodyText.includes("Web App"), "project name should appear in body");
  });

  it("includes record purposes line", () => {
    const r = renderLetter(internBase);
    const bodyText = r.body.map(p => flattenPara(p)).join(" ");
    assert.ok(bodyText.includes("academic/employment/record purposes"), "record purposes line should be present");
  });
});

describe("renderLetter — relieving", () => {
  const relievingBase: LetterRenderData = {
    ...base,
    templateType: "relieving",
    lastWorkingDay: "2024-06-30",
    endDate: undefined,
  };

  it("title is RELIEVING LETTER", () => {
    const r = renderLetter(relievingBase);
    assert.equal(r.title, "RELIEVING LETTER");
  });

  it("body mentions no objection", () => {
    const r = renderLetter(relievingBase);
    const bodyText = r.body.map(p => flattenPara(p)).join(" ");
    assert.ok(bodyText.includes("no objection"), "should include no objection clause");
  });
});

describe("renderLetter — internship_certificate", () => {
  it("title is INTERNSHIP CERTIFICATE", () => {
    const r = renderLetter({ ...base, templateType: "internship_certificate" });
    assert.equal(r.title, "INTERNSHIP CERTIFICATE");
  });
});

describe("renderLetter — responsibilities and seal", () => {
  it("includes responsibilities paragraph when set", () => {
    const r = renderLetter({ ...base, includeResponsibilities: true, responsibilitiesSummary: "Managed the cloud infra." });
    const text = r.body.map(p => flattenPara(p)).join(" ");
    assert.ok(text.includes("Managed the cloud infra."), "responsibilities should appear");
  });

  it("seal is true when includeSeal is true", () => {
    const r = renderLetter({ ...base, includeSeal: true });
    assert.equal(r.includeSeal, true);
  });

  it("seal is false by default", () => {
    const r = renderLetter(base);
    assert.equal(r.includeSeal, false);
  });
});

describe("flattenPara", () => {
  it("joins spans into a plain string", () => {
    const para = [{ t: "Hello " }, { t: "Alice", b: true }, { t: "." }];
    assert.equal(flattenPara(para), "Hello Alice.");
  });

  it("returns empty string for empty para", () => {
    assert.equal(flattenPara([]), "");
  });
});

describe("formatLetterDate", () => {
  it("returns em-dash for null", () => {
    assert.equal(formatLetterDate(null), "—");
  });

  it("returns em-dash for undefined", () => {
    assert.equal(formatLetterDate(undefined), "—");
  });

  it("formats a valid date string", () => {
    const formatted = formatLetterDate("2024-01-15");
    assert.ok(formatted.includes("2024"), "year should be in the formatted date");
    assert.ok(formatted.includes("January") || formatted.includes("Jan"), "month should appear");
  });
});

describe("render(config, data) — config gates bands", () => {
  it("render with hrLetterConfig produces same body as renderLetter for experience", () => {
    const r1 = render(hrLetterConfig, { ...base, performanceBand: "standard" });
    const r2 = renderLetter({ ...base, performanceBand: "standard" });
    assert.equal(r1.body.length, r2.body.length, "body lengths should match when config allows bands");
  });

  it("render with amendmentConfig strips performance band even if data has one", () => {
    const withBand = { ...base, templateType: "salary_revision", performanceBand: "standard" };
    const r = render(amendmentConfig, withBand);
    const text = r.body.map(p => flattenPara(p)).join(" ");
    assert.ok(
      !text.toLowerCase().includes("satisfactory") && !text.toLowerCase().includes("manner"),
      "performance band sentence should be suppressed by amendmentConfig"
    );
  });

  it("render with amendmentConfig strips conduct band", () => {
    const withBand = { ...base, templateType: "salary_revision", conductBand: "professional" };
    const r = render(amendmentConfig, withBand);
    assert.ok(r.body.length === 0, "amendment template with no matching body builder produces empty body");
  });

  it("render with amendmentConfig provides fallback title for unknown templateType", () => {
    const r = render(amendmentConfig, { ...base, templateType: "salary_revision" });
    assert.equal(r.title, "AMENDMENT LETTER");
  });

  it("render with hrLetterConfig uses TEMPLATE_TITLES for known types", () => {
    const r = render(hrLetterConfig, base);
    assert.equal(r.title, "EXPERIENCE LETTER");
  });
});

describe("sentencesOverride", () => {
  it("overrides performance band sentence", () => {
    const r = renderLetter({
      ...base,
      performanceBand: "standard",
      sentencesOverride: {
        performance_band: { standard: "Custom performance sentence." },
      },
    });
    const text = r.body.map(p => flattenPara(p)).join(" ");
    assert.ok(text.includes("Custom performance sentence."), "custom sentence should appear");
  });

  it("overrides closing line", () => {
    const r = renderLetter({
      ...base,
      closingLine: "wish_success",
      sentencesOverride: {
        closing_line: { wish_success: "Custom closing line." },
      },
    });
    const text = r.body.map(p => flattenPara(p)).join(" ");
    assert.ok(text.includes("Custom closing line."), "custom closing line should appear");
  });
});
