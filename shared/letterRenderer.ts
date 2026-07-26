import {
  PERFORMANCE_BAND_SENTENCES as DEFAULT_PERFORMANCE_SENTENCES,
  CONDUCT_BAND_SENTENCES as DEFAULT_CONDUCT_SENTENCES,
  COMPLETION_BAND_SENTENCES as DEFAULT_COMPLETION_PHRASES,
  CLOSING_LINE_SENTENCES as DEFAULT_CLOSING_SENTENCES,
} from "./hrLetterConstants";

export const COMPANY_NAME = "Rayomind Solutions LLP";
export const COMPANY_ADDRESS = "Suite No-101, Pocket-6, Sector-2, Rohini, New Delhi – 110085, India";

export interface Span {
  t: string;
  b?: boolean;
}

export type Para = Span[];

export interface RenderedLetter {
  title: string;
  refText: string;
  dateText: string;
  greeting: string;
  body: Para[];
  signatoryName: string;
  signatoryDesignation: string;
  includeSeal: boolean;
  referenceNumber?: string | null;
  authCode?: string | null;
}

export interface TemplateConfig {
  letterType: "hr_letter" | "offer_letter" | "amendment";
  templateTypes: string[];
  title?: string;
  bandOptions?: {
    showPerformanceBand?: boolean;
    showConductBand?: boolean;
    showCompletionBand?: boolean;
  };
}

export interface LetterRenderData {
  templateType: string;
  employeeName: string;
  employeeCode?: string | null;
  designation: string;
  department?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  lastWorkingDay?: string | null;
  performanceBand?: string | null;
  conductBand?: string | null;
  completionBand?: string | null;
  closingLine?: string | null;
  includeResponsibilities?: boolean | null;
  responsibilitiesSummary?: string | null;
  includeProject?: boolean | null;
  projectName?: string | null;
  customOverrideText?: string | null;
  signatoryName?: string | null;
  signatoryDesignation?: string | null;
  issueDate?: string | null;
  referenceNumber?: string | null;
  authCode?: string | null;
  includeSeal?: boolean | null;
  sentencesOverride?: {
    performance_band?: Record<string, string>;
    conduct_band?: Record<string, string>;
    completion_band?: Record<string, string>;
    closing_line?: Record<string, string>;
  };
}

export const TEMPLATE_TITLES: Record<string, string> = {
  experience: "EXPERIENCE LETTER",
  internship_completion: "INTERNSHIP COMPLETION LETTER",
  internship_certificate: "INTERNSHIP CERTIFICATE",
  relieving: "RELIEVING LETTER",
};

export function formatLetterDate(dateStr?: string | null): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function t(text: string): Span { return { t: text }; }
function b(text: string): Span { return { t: text, b: true }; }
function para(...spans: Span[]): Para { return spans; }
function simplePara(text: string): Para { return [t(text)]; }

function interpolateSpans(
  template: string,
  data: { employeeName?: string; designation?: string; department?: string | null },
): Para {
  const name = data.employeeName || "\u2014";
  const role = data.designation || "\u2014";
  const dept = data.department || "the assigned";
  const result = template
    .replace(/\[Name\]/g, `__NAME__`)
    .replace(/\[Company\]/g, `__COMPANY__`)
    .replace(/\[Role\]/g, `__ROLE__`)
    .replace(/\[Department\]/g, `__DEPT__`);

  const tokens = result.split(/(__)/).filter(Boolean);
  const spans: Span[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i] === "__") {
      i++;
      const key = tokens[i] ?? "";
      i++;
      const end = tokens[i] ?? "";
      if (end === "__") {
        i++;
        if (key === "NAME") spans.push(b(name));
        else if (key === "COMPANY") spans.push(b(COMPANY_NAME));
        else if (key === "ROLE") spans.push(b(role));
        else if (key === "DEPT") spans.push(b(dept));
        else spans.push(t(`__${key}__`));
      } else {
        spans.push(t(`__${key}`));
      }
    } else {
      spans.push(t(tokens[i]!));
      i++;
    }
  }
  return spans;
}

function applyInterpolation(sentence: string, data: LetterRenderData): Para {
  return interpolateSpans(sentence, {
    employeeName: data.employeeName,
    designation: data.designation,
    department: data.department,
  });
}

/**
 * Core renderer — produces the canonical RenderedLetter from raw data.
 * Both LetterPreview (React) and hrLetterPdf (Node/PDFKit) call this function
 * so the two surfaces always share the same template logic.
 */
export function renderLetter(data: LetterRenderData): RenderedLetter {
  const PERFORMANCE_SENTENCES = {
    ...DEFAULT_PERFORMANCE_SENTENCES,
    ...(data.sentencesOverride?.performance_band || {}),
  };
  const CONDUCT_SENTENCES = {
    ...DEFAULT_CONDUCT_SENTENCES,
    ...(data.sentencesOverride?.conduct_band || {}),
  };
  const COMPLETION_PHRASES = {
    ...DEFAULT_COMPLETION_PHRASES,
    ...(data.sentencesOverride?.completion_band || {}),
  };
  const CLOSING_SENTENCES = {
    ...DEFAULT_CLOSING_SENTENCES,
    ...(data.sentencesOverride?.closing_line || {}),
  };

  const title = TEMPLATE_TITLES[data.templateType] || "HR LETTER";
  const refText = data.referenceNumber ? `Ref: ${data.referenceNumber}` : "Draft";
  const dateText = `Date: ${formatLetterDate(data.issueDate)}`;
  const greeting = "To Whom It May Concern,";

  const body: Para[] = [];

  if (data.templateType === "experience") {
    body.push(
      para(
        t("This is to certify that "),
        b(data.employeeName),
        ...(data.employeeCode ? [t(` (Employee ID: ${data.employeeCode})`)] : []),
        t(" was employed with "),
        b(COMPANY_NAME),
        t(" as "),
        b(data.designation),
        ...(data.department ? [t(` in the ${data.department} department`)] : []),
        t(" from "),
        b(formatLetterDate(data.startDate)),
        t(" to "),
        b(formatLetterDate(data.endDate)),
        t("."),
      ),
    );
    if (data.performanceBand && PERFORMANCE_SENTENCES[data.performanceBand]) {
      body.push(applyInterpolation(PERFORMANCE_SENTENCES[data.performanceBand]!, data));
    }
    if (data.conductBand && CONDUCT_SENTENCES[data.conductBand]) {
      body.push(applyInterpolation(CONDUCT_SENTENCES[data.conductBand]!, data));
    }
  } else if (data.templateType === "internship_completion") {
    const completionPhrase = data.completionBand
      ? COMPLETION_PHRASES[data.completionBand] || "completed"
      : "completed";
    body.push(
      para(
        t("This is to certify that "),
        b(data.employeeName),
        ...(data.employeeCode ? [t(` (Intern ID: ${data.employeeCode})`)] : []),
        t(` has ${completionPhrase} an internship with `),
        b(COMPANY_NAME),
        ...(data.department ? [t(` in the ${data.department} department`)] : []),
        t(" from "),
        b(formatLetterDate(data.startDate)),
        t(" to "),
        b(formatLetterDate(data.endDate)),
        t("."),
      ),
    );
    if (data.includeProject && data.projectName) {
      body.push(
        para(
          t("During the internship, the intern worked on the project: "),
          b(data.projectName),
          t("."),
        ),
      );
    }
    if (data.performanceBand && PERFORMANCE_SENTENCES[data.performanceBand]) {
      body.push(applyInterpolation(PERFORMANCE_SENTENCES[data.performanceBand]!, data));
    }
    body.push(simplePara("This letter is issued for academic/employment/record purposes."));
  } else if (data.templateType === "internship_certificate") {
    const completionPhrase = data.completionBand
      ? COMPLETION_PHRASES[data.completionBand] || "completed"
      : "completed";
    body.push(
      para(
        t("This is to certify that "),
        b(data.employeeName),
        t(` has ${completionPhrase} an internship with `),
        b(COMPANY_NAME),
        ...(data.department ? [t(` in the ${data.department} department`)] : []),
        t(" as "),
        b(data.designation),
        t(" from "),
        b(formatLetterDate(data.startDate)),
        t(" to "),
        b(formatLetterDate(data.endDate)),
        t("."),
      ),
    );
  } else if (data.templateType === "relieving") {
    body.push(
      para(
        t("This is to confirm that "),
        b(data.employeeName),
        ...(data.employeeCode ? [t(` (Employee ID: ${data.employeeCode})`)] : []),
        t(" was employed with "),
        b(COMPANY_NAME),
        t(" as "),
        b(data.designation),
        ...(data.department ? [t(` in the ${data.department} department`)] : []),
        t(" from "),
        b(formatLetterDate(data.startDate)),
        t("."),
      ),
    );
    body.push(
      para(
        t("The resignation submitted has been accepted and "),
        b(data.employeeName),
        t(
          " has duly served the notice period and has been relieved from duties effective ",
        ),
        b(formatLetterDate(data.lastWorkingDay || data.endDate)),
        t("."),
      ),
    );
    body.push(
      simplePara(
        "All company dues have been settled and all company property has been returned.",
      ),
    );
    body.push(
      para(
        t("The company has no objection to "),
        b(data.employeeName),
        t(" seeking employment elsewhere."),
      ),
    );
    body.push(
      simplePara(
        "This letter is issued at the request of the employee for record and employment/background verification purposes.",
      ),
    );
  }

  if (data.includeResponsibilities && data.responsibilitiesSummary) {
    body.push(simplePara(data.responsibilitiesSummary));
  }

  if (data.customOverrideText) {
    body.push(simplePara(data.customOverrideText));
  }

  if (data.closingLine && CLOSING_SENTENCES[data.closingLine]) {
    body.push(applyInterpolation(CLOSING_SENTENCES[data.closingLine]!, data));
  }

  return {
    title,
    refText,
    dateText,
    greeting,
    body,
    signatoryName: data.signatoryName || "Authorized Signatory",
    signatoryDesignation: data.signatoryDesignation || "Authorized Signatory",
    includeSeal: !!data.includeSeal,
    referenceNumber: data.referenceNumber,
    authCode: data.authCode,
  };
}

/**
 * Config-driven render — preferred API when a TemplateConfig is available.
 *
 * The config gates band paragraphs (performance / conduct / completion) so
 * amendment or offer-letter configs can suppress them without touching data.
 * It also provides a title fallback for template types not listed in
 * TEMPLATE_TITLES (e.g. future custom types).
 */
export function render(config: TemplateConfig, data: LetterRenderData): RenderedLetter {
  const bands = config.bandOptions ?? {};
  const gated: LetterRenderData = {
    ...data,
    performanceBand: bands.showPerformanceBand === false ? null : data.performanceBand,
    conductBand:     bands.showConductBand     === false ? null : data.conductBand,
    completionBand:  bands.showCompletionBand  === false ? null : data.completionBand,
  };

  const result = renderLetter(gated);

  const overrideTitle =
    !TEMPLATE_TITLES[data.templateType] && config.title
      ? config.title.toUpperCase()
      : result.title;

  return { ...result, title: overrideTitle };
}

export function flattenPara(para: Para): string {
  return para.map((s) => s.t).join("");
}
