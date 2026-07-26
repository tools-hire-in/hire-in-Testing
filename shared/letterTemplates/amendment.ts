import type { TemplateConfig } from "../letterRenderer";

export const AMENDMENT_TEMPLATE_TYPES_LIST = [
  "salary_revision",
  "role_change",
  "combined",
  "device_allocation",
] as const;

export type AmendmentTemplateType = typeof AMENDMENT_TEMPLATE_TYPES_LIST[number];

export const amendmentConfig: TemplateConfig = {
  letterType: "amendment",
  templateTypes: [...AMENDMENT_TEMPLATE_TYPES_LIST],
  title: "Amendment Letter",
  bandOptions: {
    showPerformanceBand: false,
    showConductBand: false,
    showCompletionBand: false,
  },
};
