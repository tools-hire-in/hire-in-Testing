import type { TemplateConfig } from "../letterRenderer";

export const offerLetterConfig: TemplateConfig = {
  letterType: "offer_letter",
  templateTypes: ["offer_letter"],
  title: "Offer Letter",
  bandOptions: {
    showPerformanceBand: false,
    showConductBand: false,
    showCompletionBand: false,
  },
};
