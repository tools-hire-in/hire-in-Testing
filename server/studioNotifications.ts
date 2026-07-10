/**
 * Studio T1 notification stub (Task #906).
 *
 * Central funnel for every Studio pipeline event (assignment, review request,
 * decision, comment, deadline reminder). T3 promotes this stub into the
 * preference-checking notification gateway (channel prefs + digest); until
 * then it writes an in-app notification via the existing createNotification()
 * storage path. All deep links MUST be built with studioUrl() so they follow
 * the STUDIO_BASE convention (portal base + /studio path).
 */
import { storage } from "./storage";
import { getPortalBaseUrl } from "./portalUrl";

/** Client-side base path for the standalone Studio shell. */
export const STUDIO_BASE = "/studio";

/** Absolute deep link into the Studio shell (for emails / notifications). */
export function studioUrl(path = ""): string {
  const suffix = path.startsWith("/") ? path : path ? `/${path}` : "";
  return `${getPortalBaseUrl()}${STUDIO_BASE}${suffix}`;
}

export type StudioNotificationEvent =
  | "idea_assigned"
  | "idea_review_requested"
  | "idea_approved"
  | "idea_rejected"
  | "idea_changes_requested"
  | "idea_comment"
  | "idea_due_soon"
  | "idea_promoted"
  | "campaign_contributor_added"
  | "campaign_plan_proposed"
  | "campaign_plan_approved"
  | "campaign_overdue";

const EVENT_TITLES: Record<StudioNotificationEvent, string> = {
  idea_assigned: "Content idea assigned to you",
  idea_review_requested: "Content idea ready for review",
  idea_approved: "Content idea approved",
  idea_rejected: "Content idea rejected",
  idea_changes_requested: "Changes requested on a content idea",
  idea_comment: "New comment on a content idea",
  idea_due_soon: "Content idea due tomorrow",
  idea_promoted: "Idea promoted to article",
  campaign_contributor_added: "You were added to a campaign",
  campaign_plan_proposed: "AI campaign plan proposed",
  campaign_plan_approved: "Campaign plan approved",
  campaign_overdue: "Campaign content overdue",
};

/**
 * Publish sync-back (Task #906): when a linked article goes live, its parent
 * content idea auto-transitions to `done`. Safe no-op when no idea is linked.
 * Never throws — a sync failure must not fail the publish.
 */
export async function syncIdeaDoneForPublishedArticle(articleId: string): Promise<void> {
  try {
    const idea = await storage.getStudioContentIdeaByArticle(articleId);
    if (!idea || idea.status === "done" || idea.archivedAt) return;
    await storage.updateStudioContentIdea(idea.id, { status: "done" });
  } catch (err) {
    console.error("[studioNotifications] idea publish sync-back failed:", err);
  }
}

/**
 * notifyUser() — T1 stub. Fire-and-forget; never throws into the caller
 * (a failed notification must not fail the workflow action).
 */
export async function notifyUser(params: {
  userId: string;
  event: StudioNotificationEvent;
  message: string;
  /** Studio-relative path, e.g. `/calendar?idea=<id>` — never a full URL. */
  linkPath?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await storage.createNotification({
      userId: params.userId,
      type: `studio_${params.event}`,
      title: EVENT_TITLES[params.event] ?? "Studio update",
      message: params.message,
      isRead: false,
      metadata: {
        ...params.metadata,
        link: params.linkPath ? `${STUDIO_BASE}${params.linkPath}` : STUDIO_BASE,
        url: params.linkPath ? studioUrl(params.linkPath) : studioUrl(),
      },
    });
  } catch (err) {
    console.error(`[studioNotifications] notifyUser(${params.event}) failed:`, err);
  }
}
