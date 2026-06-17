import crypto from "crypto";
import { storage } from "./storage";
import { sendNewsletterNotificationEmail } from "./email";
import type { StudioArticle } from "@shared/schema";

const PUBLIC_BASE_URL = "https://hire-in.com";

// Feature flag (system_settings key) that gates new-content notifications.
export const NEWSLETTER_FLAG_KEY = "newsletter_notifications";

// Batch sizing for rate-limited sends so a large list never floods SendGrid.
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set — required for unsubscribe tokens");
  return s;
}

/**
 * Stable, non-expiring signed unsubscribe token. Embeds the subscriber id and
 * is HMAC-signed with the existing session secret so old emails keep working.
 * Format: base64url(id) + "." + base64url(hmac).
 */
export function makeUnsubscribeToken(subscriberId: string): string {
  const payload = Buffer.from(subscriberId, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function unsubscribeUrlFor(subscriberId: string, baseUrl = PUBLIC_BASE_URL): string {
  return `${baseUrl}/api/newsletter/unsubscribe/${makeUnsubscribeToken(subscriberId)}`;
}

export function insightsUrl(baseUrl = PUBLIC_BASE_URL): string {
  return `${baseUrl}/insights`;
}

async function isNewsletterEnabled(): Promise<boolean> {
  const setting = await storage.getSystemSetting(NEWSLETTER_FLAG_KEY);
  const v = setting?.value as any;
  if (typeof v === "boolean") return v;
  if (v && typeof v === "object" && typeof v.enabled === "boolean") return v.enabled;
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fire-and-forget new-content notification for a freshly published article.
 *
 * Guards:
 *  - feature flag must be on
 *  - article must publish to /insights (project.publishesToInsights)
 *  - article must have a slug
 *  - notifiedAt must be null (claimed immediately to prevent double-send)
 *
 * Sends to active subscribers (non-unsubscribed AND non-suppressed) in
 * rate-limited batches, then leaves notifiedAt set. Safe to call from any
 * publish path; never throws.
 */
export async function notifyNewContentSubscribers(
  articleId: string,
  baseUrl = PUBLIC_BASE_URL,
): Promise<void> {
  try {
    if (!(await isNewsletterEnabled())) return;

    const article = await storage.getStudioArticle(articleId);
    if (!article) return;
    if (article.status !== "published") return;
    if (article.notifiedAt) return;
    if (!article.slug) return;

    const project = await storage.getStudioProject(article.projectId);
    if (!project?.publishesToInsights) return;

    // Claim immediately so concurrent publish paths can't double-send.
    const claimed = await storage.updateStudioArticle(articleId, {
      notifiedAt: new Date(),
    } as Partial<StudioArticle> as any);
    if (!claimed) return;

    const subscribers = await storage.getActiveNewsletterSubscribers();
    if (subscribers.length === 0) return;

    const articleUrl = `${baseUrl}/insights/${article.slug}`;
    const imageUrl = article.ogImageUrl || article.coverImageUrl || null;

    let sent = 0;
    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (sub) => {
          const result = await sendNewsletterNotificationEmail({
            to: sub.email,
            unsubscribeUrl: unsubscribeUrlFor(sub.id, baseUrl),
            articleTitle: article.title,
            articleExcerpt: article.excerpt,
            articleImageUrl: imageUrl,
            articleUrl,
          });
          if (result.success) sent++;
        }),
      );
      if (i + BATCH_SIZE < subscribers.length) await sleep(BATCH_DELAY_MS);
    }
    console.log(
      `[newsletter] Notified ${sent}/${subscribers.length} subscribers about "${article.title}".`,
    );
  } catch (err) {
    console.error("[newsletter] notifyNewContentSubscribers failed:", err);
  }
}
