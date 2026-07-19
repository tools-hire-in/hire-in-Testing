export const STATUS_LABELS: Record<string, string> = {
  planning_review: "Awaiting Editorial Direction",
  draft: "Draft",
  needs_revision: "Needs revision",
  in_review: "In Review",
  pending_cm_review: "CM Review",
  pending_author: "Author Sign-Off",
  author_approved: "Author Approved",
  pending_marketing: "Pending Marketing",
  pending_final_approval: "Final Sign-Off",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
  ready_to_export: "Ready to Export",
  rejected: "Rejected",
};

export const STATUS_BADGE_CLASS: Record<string, string> = {
  planning_review: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  needs_revision: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  in_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  pending_cm_review: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  pending_author: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  author_approved: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  pending_marketing: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  pending_final_approval: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  published: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  archived: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  ready_to_export: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export const STATUS_ORDER = [
  "planning_review",
  "draft",
  "in_review",
  "pending_cm_review",
  "pending_author",
  "author_approved",
  "pending_marketing",
  "pending_final_approval",
  "approved",
  "scheduled",
  "published",
  "archived",
  "ready_to_export",
];

export function nextBulkStatus(current: string): string | null {
  switch (current) {
    case "planning_review": return null;
    case "draft": return "in_review";
    case "in_review": return "pending_cm_review";
    case "pending_cm_review": return "pending_author";
    case "pending_author": return "author_approved";
    case "author_approved": return "pending_marketing";
    case "pending_marketing": return "pending_final_approval";
    default: return null;
  }
}
