---
name: Notification gateway & preferences
description: How in-app/email notifications are routed and preference-gated; where to plug new notification types.
---

- All new notifications must go through the central gateway (`notifyUser` in `server/notifications.ts`), never write to the notifications table or send email directly. The gateway checks per-user channel preferences (in-app + email) with COALESCE-on defaults — a missing preference row means ON.
- Notification types live in a registry (`shared/notificationTypes.ts`) with category/label/default flags; adding a type there is what makes it appear in the Profile > Notifications preference switches automatically.
- **Why:** two independent send paths (direct insert + gateway) would let opted-out users still get notified, silently breaking the preference contract.
- **How to apply:** any new feature that alerts users adds a type to the registry and calls `notifyUser`; scheduled digests must skip users whose digest content is empty (never send blank emails).
- Weekly studio digest cron runs Mondays 08:00 IST; pref key `studio_weekly_digest`.
