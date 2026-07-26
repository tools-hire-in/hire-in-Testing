import type { TemplateConfig } from "../letterRenderer";

export const HR_LETTER_TEMPLATE_TYPES = [
  "experience",
  "internship_completion",
  "internship_certificate",
  "relieving",
] as const;

export type HrLetterTemplateType = typeof HR_LETTER_TEMPLATE_TYPES[number];

export const hrLetterConfig: TemplateConfig = {
  letterType: "hr_letter",
  templateTypes: [...HR_LETTER_TEMPLATE_TYPES],
  title: "HR Letter",
  bandOptions: {
    showPerformanceBand: true,
    showConductBand: true,
    showCompletionBand: true,
  },
};

export const HR_LETTER_BAND_VISIBILITY: Record<
  HrLetterTemplateType,
  { performance: boolean; conduct: boolean; completion: boolean; project: boolean; lastWorkingDay: boolean }
> = {
  experience: { performance: true, conduct: true, completion: false, project: false, lastWorkingDay: false },
  internship_completion: { performance: true, conduct: false, completion: true, project: true, lastWorkingDay: false },
  internship_certificate: { performance: false, conduct: false, completion: true, project: false, lastWorkingDay: false },
  relieving: { performance: false, conduct: false, completion: false, project: false, lastWorkingDay: true },
};
