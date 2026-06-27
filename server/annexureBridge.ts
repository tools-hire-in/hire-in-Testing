import { db } from "./db";
import {
  offerLetters,
  adminUsers,
  learningTracks,
  trackAssignments,
  trackCompletions,
  onboardingAuditEvents,
} from "@shared/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";

/**
 * Annexure → policy-track bridge.
 *
 * During offer acceptance a candidate initials the policy annexures attached to
 * their offer (e.g. Annexure A — Leave Policy, Annexure B — Attendance &
 * Regularization Policy). Those same policies also exist as signable policy
 * tracks in the portal ("Break & Leave Policy", "Attendance Regularization
 * Policy"). Without bridging, a freshly onboarded employee would be asked to
 * sign them a second time.
 *
 * This module marks the matching policy tracks as completed for the user,
 * carrying over the annexure signature, so PolicyGate / the onboarding checklist
 * no longer surfaces them. Idempotent and resilient — safe to call lazily.
 */

interface SignedAnnexure {
  key: string;
  initials: string;
  initialedAt: string | null;
}

/**
 * Returns the set of annexure keys this user signed at offer acceptance, keyed
 * by annexure key. Matches the offer by resultingUserId first, then falls back
 * to email (hireInEmail / candidatePersonalEmail) so already-onboarded users are
 * covered even if resultingUserId was never linked.
 */
export async function getSignedAnnexureKeysForUser(
  userId: string,
): Promise<Map<string, SignedAnnexure>> {
  const result = new Map<string, SignedAnnexure>();

  const [user] = await db
    .select({ email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.id, userId));

  const email = user?.email?.toLowerCase() ?? null;

  const letters = await db
    .select({
      annexureInitials: offerLetters.annexureInitials,
      acceptedAt: offerLetters.acceptedAt,
    })
    .from(offerLetters)
    .where(
      and(
        isNotNull(offerLetters.annexureInitials),
        email
          ? sql`(${offerLetters.resultingUserId} = ${userId}
              OR lower(${offerLetters.hireInEmail}) = ${email}
              OR lower(${offerLetters.candidatePersonalEmail}) = ${email})`
          : eq(offerLetters.resultingUserId, userId),
      ),
    );

  for (const letter of letters) {
    const initials = Array.isArray(letter.annexureInitials)
      ? (letter.annexureInitials as any[])
      : [];
    for (const entry of initials) {
      if (
        entry &&
        typeof entry.key === "string" &&
        typeof entry.initials === "string" &&
        entry.initials.trim()
      ) {
        // Keep the earliest signature if the key appears across multiple offers.
        if (!result.has(entry.key)) {
          result.set(entry.key, {
            key: entry.key,
            initials: entry.initials.trim(),
            initialedAt:
              typeof entry.initialedAt === "string" ? entry.initialedAt : null,
          });
        }
      }
    }
  }

  return result;
}

/**
 * For every published policy track whose `policyKey` matches an annexure the
 * user already signed, mark the track completed (creating the assignment if
 * needed). Idempotent: skips tracks already completed at the current version.
 *
 * Returns the list of track titles that were freshly bridged.
 */
export async function bridgeAnnexuresForUser(userId: string): Promise<string[]> {
  const bridged: string[] = [];
  try {
    const signed = await getSignedAnnexureKeysForUser(userId);
    if (signed.size === 0) return bridged;

    const signedKeys = Array.from(signed.keys());

    // Published policy tracks that correspond to a signed annexure.
    const tracks = await db
      .select()
      .from(learningTracks)
      .where(
        and(
          eq(learningTracks.isPolicyTrack, true),
          eq(learningTracks.status, "published"),
          isNotNull(learningTracks.policyKey),
        ),
      );

    for (const track of tracks) {
      if (!track.policyKey || !signedKeys.includes(track.policyKey)) continue;
      const annex = signed.get(track.policyKey)!;

      // Ensure an assignment exists.
      let [assignment] = await db
        .select()
        .from(trackAssignments)
        .where(
          and(
            eq(trackAssignments.trackId, track.id),
            eq(trackAssignments.userId, userId),
          ),
        );

      if (!assignment) {
        [assignment] = await db
          .insert(trackAssignments)
          .values({
            trackId: track.id,
            userId,
            assignedBy: userId,
            status: "completed",
            completedAt: new Date(),
            signedVersion: track.versionNumber,
          })
          .returning();
      }

      // Already completed at the current version? Skip (idempotent).
      const [completion] = await db
        .select()
        .from(trackCompletions)
        .where(eq(trackCompletions.assignmentId, assignment.id));

      if (
        assignment.status === "completed" &&
        completion?.signedVersion === track.versionNumber
      ) {
        continue;
      }

      const receiptData = {
        bridgedFromAnnexure: track.policyKey,
        annexureInitials: annex.initials,
        annexureInitialedAt: annex.initialedAt,
        trackId: track.id,
        userId,
        versionNumber: track.versionNumber,
        bridgedAt: new Date().toISOString(),
        note:
          "Auto-completed from policy annexure signed during offer acceptance.",
      };

      await db
        .delete(trackCompletions)
        .where(eq(trackCompletions.assignmentId, assignment.id));
      await db.insert(trackCompletions).values({
        assignmentId: assignment.id,
        userId,
        receiptData,
        signedVersion: track.versionNumber,
      });

      await db
        .update(trackAssignments)
        .set({ status: "completed", completedAt: new Date(), signedVersion: track.versionNumber })
        .where(eq(trackAssignments.id, assignment.id));

      try {
        await db.insert(onboardingAuditEvents).values({
          userId,
          trackId: track.id,
          assignmentId: assignment.id,
          eventType: "policy_track_bridged_from_annexure",
          metadata: receiptData,
        });
      } catch {
        // Audit is best-effort.
      }

      bridged.push(track.title);
    }
  } catch (err) {
    console.error("bridgeAnnexuresForUser failed (non-fatal):", err);
  }
  return bridged;
}
