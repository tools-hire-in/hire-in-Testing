import { db } from "./db";
import {
  adminUsers,
  learningTracks,
  trackAssignments,
  trackCompletions,
  nightShiftConsents,
  employeeBankDetails,
  employeeEmergencyContacts,
  employeeDocuments,
} from "@shared/schema";
import { and, eq, desc } from "drizzle-orm";
import { bridgeAnnexuresForUser } from "./annexureBridge";

export interface ChecklistItem {
  key: string;
  label: string;
  complete: boolean;
  section: string;
  actionPath: string;
  message: string;
  count?: number;
  applicable: boolean;
}

export interface OnboardingChecklist {
  complete: boolean;
  overallPct: number;
  items: ChecklistItem[];
  pendingSections: string[];
  counts: { personal: number; policies: number; total: number };
}

const NIGHT_SHIFT_EXEMPT_ROLES = ["admin", "super_admin", "hr", "manager"];

/**
 * Computes the guided-onboarding checklist for a user. INFORMATIONAL ONLY —
 * the result never gates Punch In/Out or any navigation. Idempotently bridges
 * any annexures signed at offer acceptance before evaluating policy items.
 */
export async function computeOnboardingChecklist(
  userId: string,
  role: string,
): Promise<OnboardingChecklist> {
  const isEmployee = role === "employee";

  await bridgeAnnexuresForUser(userId);

  const [userRecord] = await db
    .select({
      gender: adminUsers.gender,
      totpEnabled: adminUsers.totpEnabled,
      linkedinUrl: adminUsers.linkedinUrl,
      photoUrl: adminUsers.photoUrl,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, userId));

  // ── Policies (published policy tracks assigned to the user) ──
  const assignments = await db
    .select({ assignment: trackAssignments, track: learningTracks })
    .from(trackAssignments)
    .innerJoin(learningTracks, eq(learningTracks.id, trackAssignments.trackId))
    .where(
      and(
        eq(trackAssignments.userId, userId),
        eq(learningTracks.isPolicyTrack, true),
        eq(learningTracks.status, "published"),
      ),
    );
  let pendingPolicyCount = 0;
  for (const { assignment, track } of assignments) {
    const [completion] = await db
      .select()
      .from(trackCompletions)
      .where(eq(trackCompletions.assignmentId, assignment.id));
    const isComplete = assignment.status === "completed";
    const isCurrent = completion?.signedVersion === track.versionNumber;
    if (!(isComplete && isCurrent)) pendingPolicyCount++;
  }

  // Night shift consent (Female non-exempt roles must have a valid consent)
  let nightShiftPending = false;
  try {
    if (!NIGHT_SHIFT_EXEMPT_ROLES.includes(role) && userRecord?.gender === "Female") {
      const [latestConsent] = await db
        .select()
        .from(nightShiftConsents)
        .where(and(eq(nightShiftConsents.userId, userId), eq(nightShiftConsents.isActive, true)))
        .orderBy(desc(nightShiftConsents.signedAt))
        .limit(1);
      if (!latestConsent || new Date(latestConsent.expiresAt) < new Date()) {
        nightShiftPending = true;
      }
    }
  } catch (nsErr) {
    console.error("Night shift consent check failed (non-fatal):", nsErr);
  }
  const policiesComplete = pendingPolicyCount === 0 && !nightShiftPending;

  // ── Personal data items (employees only) ──
  let bankComplete = true,
    emergencyComplete = true,
    docsComplete = true,
    docsPendingCount = 0;
  if (isEmployee) {
    const [bank] = await db
      .select({ id: employeeBankDetails.id })
      .from(employeeBankDetails)
      .where(eq(employeeBankDetails.userId, userId))
      .limit(1);
    bankComplete = !!bank;
    const [emc] = await db
      .select({ id: employeeEmergencyContacts.id })
      .from(employeeEmergencyContacts)
      .where(eq(employeeEmergencyContacts.userId, userId))
      .limit(1);
    emergencyComplete = !!emc;
    const reqDocs = await db
      .select({ status: employeeDocuments.status })
      .from(employeeDocuments)
      .where(and(eq(employeeDocuments.userId, userId), eq(employeeDocuments.isRequired, true)));
    docsPendingCount = reqDocs.filter((d) => d.status === "pending").length;
    docsComplete = docsPendingCount === 0;
  }

  const twoFactorComplete = userRecord?.totpEnabled === true;
  const profileComplete = !isEmployee || !!(userRecord?.gender && String(userRecord.gender).trim());
  const linkedinComplete =
    !isEmployee || !!(userRecord?.linkedinUrl && String(userRecord.linkedinUrl).trim());
  const headshotComplete =
    !isEmployee || !!(userRecord?.photoUrl && String(userRecord.photoUrl).trim());

  const items: ChecklistItem[] = [
    { key: "policies", label: "Sign your policies & consents", complete: policiesComplete, section: "growth", actionPath: "/admin/policy-gate", message: "Read and sign your workplace policies. Anything you already signed when accepting your offer is credited automatically.", count: pendingPolicyCount + (nightShiftPending ? 1 : 0), applicable: true },
    { key: "twoFactor", label: "Turn on two-factor authentication", complete: twoFactorComplete, section: "profile", actionPath: "/admin/hr/profile", message: "Protect your account with an authenticator app.", applicable: true },
    { key: "profile", label: "Complete your profile basics", complete: profileComplete, section: "profile", actionPath: "/admin/hr/profile", message: "Confirm your basic details so HR records stay accurate.", applicable: isEmployee },
    { key: "linkedin", label: "Add your LinkedIn URL", complete: linkedinComplete, section: "profile", actionPath: "/admin/hr/profile", message: "Helps your team and clients connect with you professionally.", applicable: isEmployee },
    { key: "headshot", label: "Upload a headshot", complete: headshotComplete, section: "profile", actionPath: "/admin/hr/profile", message: "A friendly photo helps colleagues recognise you.", applicable: isEmployee },
    { key: "bank", label: "Add your bank details", complete: bankComplete, section: "documents", actionPath: "/admin/hr/my-documents", message: "Required so payroll can pay you on time.", applicable: isEmployee },
    { key: "emergency", label: "Add an emergency contact", complete: emergencyComplete, section: "profile", actionPath: "/admin/hr/profile", message: "Who we should reach in case of an emergency.", applicable: isEmployee },
    { key: "documents", label: "Upload required documents", complete: docsComplete, section: "documents", actionPath: "/admin/hr/my-documents", message: "Upload your ID and other required documents for verification.", count: docsPendingCount, applicable: isEmployee },
  ];

  const applicable = items.filter((i) => i.applicable);
  const completeCount = applicable.filter((i) => i.complete).length;
  const overallPct = applicable.length === 0 ? 100 : Math.round((completeCount / applicable.length) * 100);
  const complete = completeCount === applicable.length;
  const pendingSections = Array.from(new Set(applicable.filter((i) => !i.complete).map((i) => i.section)));
  const personalPending = applicable.filter((i) => !i.complete && i.key !== "policies").length;
  const policiesPending = !policiesComplete ? 1 : 0;

  return {
    complete,
    overallPct,
    items,
    pendingSections,
    counts: { personal: personalPending, policies: policiesPending, total: applicable.length - completeCount },
  };
}
