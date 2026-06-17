export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  ready_to_export: "Ready to Export",
};

export const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  published: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  ready_to_export: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};
