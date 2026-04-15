export const PERFORMANCE_BAND_SENTENCES: Record<string, string> = {
  factual_only: "During the above period, [Name] was associated with [Company] as [Role].",
  standard: "During the tenure, [Name] carried out assigned responsibilities in the [Department] function.",
  good: "During the tenure, [Name] demonstrated diligence and responsibility in assigned work.",
  very_good: "During the tenure, [Name] demonstrated professionalism, commitment, and good execution of assigned responsibilities.",
  excellent: "During the tenure, [Name] demonstrated a high level of professionalism, ownership, and effectiveness in assigned responsibilities.",
};

export const CONDUCT_BAND_SENTENCES: Record<string, string> = {
  standard: "Professional conduct was satisfactory.",
  good: "Professional conduct was good.",
  very_good: "Professional conduct was very good.",
};

export const COMPLETION_BAND_SENTENCES: Record<string, string> = {
  successfully_completed: "successfully completed",
  completed: "completed",
  served_during_period: "served during the period",
};

export const CLOSING_LINE_SENTENCES: Record<string, string> = {
  wish_success: "We wish him/her all the best in future endeavours.",
  wish_career: "We wish him/her continued success in their career.",
  wish_professional: "We wish him/her the very best in all future professional pursuits.",
};

export const PERFORMANCE_BANDS = [
  { value: "factual_only", label: "Factual Only" },
  { value: "standard", label: "Standard" },
  { value: "good", label: "Good" },
  { value: "very_good", label: "Very Good" },
  { value: "excellent", label: "Excellent" },
];

export const CONDUCT_BANDS = [
  { value: "standard", label: "Standard" },
  { value: "good", label: "Good" },
  { value: "very_good", label: "Very Good" },
];

export const COMPLETION_BANDS = [
  { value: "successfully_completed", label: "Successfully Completed" },
  { value: "completed", label: "Completed" },
  { value: "served_during_period", label: "Served During the Period" },
];

export const CLOSING_LINES = [
  { value: "wish_success", label: "We wish him/her all the best in future endeavours." },
  { value: "wish_career", label: "We wish him/her continued success in their career." },
  { value: "wish_professional", label: "We wish him/her the very best in all future professional pursuits." },
];

export const TEMPLATE_PREFIX_MAP: Record<string, string> = {
  experience: "EXP",
  internship_completion: "INT",
  internship_certificate: "CRT",
  relieving: "REL",
};

export const TEMPLATE_LABELS: Record<string, string> = {
  experience: "Employee Experience Letter",
  internship_completion: "Internship Completion Letter",
  internship_certificate: "Internship Certificate",
  relieving: "Relieving Letter",
};
