/**
 * Centralized notification gateway (Studio T3, Task #908).
 *
 * Promotes the T1 Studio stub into the platform-wide notifyUser() funnel.
 * Every notification flows through here so per-user, per-type channel
 * preferences are enforced in ONE place:
 *
 *   - Preference rows live in notification_preferences keyed by the
 *     *preference key* (see shared/notificationTypes.ts — raw type strings
 *     collapse into a small curated list).
 *   - Default is opt-in: NO row = both channels enabled (COALESCE semantics:
 *     `COALESCE(in_app_enabled, true)` / `COALESCE(email_enabled, true)`).
 *   - In-app writes go through storage.createNotification().
 *   - Emails go through dispatchAutomatedEmail() (which already honours the
 *     admin-level communication configuration) — the user-level preference is
 *     checked here first.
 *
 * Never throws into the caller: a failed notification must not fail the
 * workflow action that triggered it.
 */
import { storage } from "./storage";
import { preferenceKeyForType } from "@shared/notificationTypes";

export interface NotifyUserParams {
  userId: string;
  /** Raw notification type string, e.g. "studio_idea_assigned", "hird_approved". */
  type: string;
  title: string;
  message: string;
  /** Stored in the notification metadata (deep link etc). */
  metadata?: Record<string, unknown>;
  /**
   * Optional email delivery. Only sent when the user's email preference for
   * this type is enabled (default on). `to` defaults to the user's email.
   */
  email?: {
    subject: string;
    html?: string;
    text?: string;
    /** communication_config type key; defaults to the notification type. */
    configType?: string;
    sourceJob?: string;
  };
}

export interface ChannelPreferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  preferenceKey: string;
}

/** Resolve a user's channel preferences for a raw type. No row = all on. */
export async function getChannelPreferences(
  userId: string,
  rawType: string,
): Promise<ChannelPreferences> {
  const preferenceKey = preferenceKeyForType(rawType);
  try {
    const row = await storage.getNotificationPreference(userId, preferenceKey);
    return {
      preferenceKey,
      // COALESCE(pref, true): missing row (or column) means enabled.
      inAppEnabled: row?.inAppEnabled ?? true,
      emailEnabled: row?.emailEnabled ?? true,
    };
  } catch (err) {
    console.error(`[notifications] preference lookup failed for ${userId}/${preferenceKey}:`, err);
    // Fail open: preference infrastructure problems must not silence events.
    return { preferenceKey, inAppEnabled: true, emailEnabled: true };
  }
}

/**
 * notifyUser() — the single platform gateway. Fire-and-forget safe.
 * Returns which channels were actually delivered (for logging/tests).
 */
export async function notifyUser(
  params: NotifyUserParams,
): Promise<{ inApp: boolean; email: boolean }> {
  const delivered = { inApp: false, email: false };
  let prefs: ChannelPreferences;
  try {
    prefs = await getChannelPreferences(params.userId, params.type);
  } catch {
    prefs = { preferenceKey: "system_general", inAppEnabled: true, emailEnabled: true };
  }

  if (prefs.inAppEnabled) {
    try {
      await storage.createNotification({
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        isRead: false,
        metadata: params.metadata ?? null,
      });
      delivered.inApp = true;
    } catch (err) {
      console.error(`[notifications] in-app write failed (${params.type}):`, err);
    }
  }

  if (params.email && prefs.emailEnabled) {
    try {
      const user = await storage.getAdminUser(params.userId);
      if (user?.email) {
        const { dispatchAutomatedEmail } = await import("./email");
        const result = await dispatchAutomatedEmail(
          params.email.configType ?? params.type,
          params.email.sourceJob ?? "notification_gateway",
          {
            to: user.email,
            subject: params.email.subject,
            html: params.email.html,
            text: params.email.text,
          },
        );
        delivered.email = !!result.success && !result.disabled;
      }
    } catch (err) {
      console.error(`[notifications] email dispatch failed (${params.type}):`, err);
    }
  }

  return delivered;
}
