import { db } from "./db";
import { adminUsers, offerLetters, employeePlans, systemSettings } from "@shared/schema";
import { eq, and, isNotNull, or, desc } from "drizzle-orm";

export interface ProbationStatus {
  active: boolean;
  reason: string;
  probationEndDate: string | null;
  confirmed: boolean;
  confirmedAt?: string | null;
  /** Name of the admin who owns/confirmed the plan (from createdBy), if available */
  confirmedByName?: string | null;
  overdue: boolean;
  probationMonths: number;
}

/**
 * Resolve whether a user is currently in an active probation period.
 *
 * Probation is considered ACTIVE when all of the following hold:
 *  1. The user has a joining_date.
 *  2. The computed probation end date (joining_date + probationMonths months) has
 *     not yet passed — OR — the plan has not been explicitly confirmed, regardless
 *     of the elapsed time.
 *
 * Probation is CONFIRMED when an employee_plans row of type 'probation' exists
 * for the user with outcome = 'confirmed'.
 *
 * The probation period length is sourced (in order of preference):
 *  a) The most-recent offer_letter linked to the user (by email) that has
 *     probation_period_months set.
 *  b) The system_setting 'probation_months' (default 3).
 */
export async function isProbationActive(userId: string): Promise<ProbationStatus> {
  const NOT_ON_PROBATION: ProbationStatus = {
    active: false,
    reason: "No joining date — probation tracking not applicable",
    probationEndDate: null,
    confirmed: false,
    overdue: false,
    probationMonths: 3,
  };

  const [user] = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      joiningDate: adminUsers.joiningDate,
      isActive: adminUsers.isActive,
      employmentStatus: adminUsers.employmentStatus,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, userId))
    .limit(1);

  if (!user || !user.joiningDate) return NOT_ON_PROBATION;

  const joiningDate = new Date(user.joiningDate);
  if (isNaN(joiningDate.getTime())) return NOT_ON_PROBATION;

  // Determine probation length: offer letter takes precedence, then system setting, then 3-month default.
  // Direct DB queries used here (not storage layer) to avoid circular imports.
  // Match by candidatePersonalEmail or hireInEmail; orderBy createdAt desc for deterministic latest.
  let probationMonths = 3;
  try {
    const [offerRow] = await db
      .select({ probationPeriodMonths: offerLetters.probationPeriodMonths })
      .from(offerLetters)
      .where(
        and(
          or(
            eq(offerLetters.candidatePersonalEmail, user.email),
            eq(offerLetters.hireInEmail, user.email),
          ),
          isNotNull(offerLetters.probationPeriodMonths),
        ),
      )
      .orderBy(desc(offerLetters.createdAt))
      .limit(1);
    if (offerRow?.probationPeriodMonths) {
      probationMonths = offerRow.probationPeriodMonths;
    } else {
      const [setting] = await db
        .select({ value: systemSettings.value })
        .from(systemSettings)
        .where(eq(systemSettings.key, "probation_months"))
        .limit(1);
      if (setting?.value) probationMonths = Number(setting.value) || 3;
    }
  } catch {
    try {
      const [setting] = await db
        .select({ value: systemSettings.value })
        .from(systemSettings)
        .where(eq(systemSettings.key, "probation_months"))
        .limit(1);
      if (setting?.value) probationMonths = Number(setting.value) || 3;
    } catch {
      // keep default 3
    }
  }

  // Compute probation end date (exclusive: the day after the last probation day)
  const probationEnd = new Date(joiningDate);
  probationEnd.setMonth(probationEnd.getMonth() + probationMonths);
  const probationEndDateStr = probationEnd.toISOString().split("T")[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const probationEndDay = new Date(probationEnd);
  probationEndDay.setHours(0, 0, 0, 0);

  const calendarProbationOver = today >= probationEndDay;

  // Check for an explicit probation confirmation in employee_plans.
  // We join adminUsers on createdBy to get the plan owner's name as a proxy
  // for "who confirmed" (no explicit confirmedBy field in the schema).
  let confirmed = false;
  let confirmedAt: string | null = null;
  let confirmedByName: string | null = null;
  try {
    const plans = await db
      .select({
        outcome: employeePlans.outcome,
        updatedAt: employeePlans.updatedAt,
        createdBy: employeePlans.createdBy,
      })
      .from(employeePlans)
      .where(
        and(
          eq(employeePlans.employeeId, userId),
          eq(employeePlans.planType, "probation"),
        ),
      );

    const confirmedPlan = plans.find((p) => p.outcome === "confirmed");
    if (confirmedPlan) {
      confirmed = true;
      confirmedAt = confirmedPlan.updatedAt?.toISOString() ?? null;
      // Resolve the name of the plan owner (best available proxy for confirming admin)
      if (confirmedPlan.createdBy) {
        try {
          const [creator] = await db
            .select({ firstName: adminUsers.firstName, lastName: adminUsers.lastName })
            .from(adminUsers)
            .where(eq(adminUsers.id, confirmedPlan.createdBy))
            .limit(1);
          if (creator) {
            confirmedByName = `${creator.firstName} ${creator.lastName || ""}`.trim();
          }
        } catch {
          // non-fatal
        }
      }
    }
  } catch {
    // Fail open — if we can't read plans, don't wrongly block accrual
  }

  if (confirmed) {
    return {
      active: false,
      reason: "Probation confirmed",
      probationEndDate: probationEndDateStr,
      confirmed: true,
      confirmedAt,
      confirmedByName,
      overdue: false,
      probationMonths,
    };
  }

  if (calendarProbationOver) {
    // Calendar period has elapsed but HR has not yet formally confirmed the outcome.
    // We keep active: true so the leave-accrual gate remains ON until HR acts.
    // The overdue flag signals the UI to show a distinct "needs HR action" state.
    return {
      active: true,
      reason: "Probation period has elapsed but has not been formally confirmed by HR — EL & SL accrual remains paused until confirmed.",
      probationEndDate: probationEndDateStr,
      confirmed: false,
      confirmedAt: null,
      overdue: true,
      probationMonths,
    };
  }

  return {
    active: true,
    reason: `Probation period active until ${probationEndDateStr}`,
    probationEndDate: probationEndDateStr,
    confirmed: false,
    confirmedAt: null,
    overdue: false,
    probationMonths,
  };
}
