import { storage } from "./storage";

export type SalaryChangeSource = "offer_letter" | "addendum" | "manual" | "advance";

function toDateOnly(d?: Date | string | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  // String inputs: take the date part directly — no Date construction, no UTC shift.
  if (typeof d === "string") return d.split("T")[0];
  // Date object: shift to noon UTC before extracting so a server or browser
  // timezone offset cannot roll the date backward or forward.
  const shifted = new Date(d);
  shifted.setUTCHours(12, 0, 0, 0);
  return shifted.toISOString().slice(0, 10);
}

// Apply a salary change to the employee record AND record it in the centralized
// ledger as a single source of truth. Idempotent for document-backed sources
// (offer_letter / addendum): if an applied entry already exists for the same
// (sourceType, sourceDocumentId) the change is skipped.
export async function recordSalaryChange(opts: {
  employeeId: string;
  newSalary: number;
  sourceType: SalaryChangeSource;
  sourceDocumentType?: string | null;
  sourceDocumentId?: string | null;
  reason?: string | null;
  effectiveDate?: Date | string | null;
  initiatedBy?: string | null;
  approvedBy?: string | null;
  apply?: boolean; // default true — write back to admin_users.salary
}): Promise<{ applied: boolean; skipped: boolean }> {
  const apply = opts.apply !== false;

  // Idempotency for document-backed write-backs.
  if (opts.sourceDocumentId && (opts.sourceType === "offer_letter" || opts.sourceType === "addendum")) {
    const existing = await storage.getSalaryChangeBySource(opts.sourceType, opts.sourceDocumentId);
    if (existing) return { applied: false, skipped: true };
  }

  const employee = await storage.getAdminUser(opts.employeeId);
  if (!employee) return { applied: false, skipped: true };

  const oldSalary = employee.salary != null ? Number(employee.salary) : null;
  const newSalary = Math.round(opts.newSalary * 100) / 100;
  const effectiveDate = toDateOnly(opts.effectiveDate);

  // Only write the live salary when the change is actually in effect (effective
  // date today or earlier). Future-dated changes are recorded in the ledger but
  // NOT written to admin_users.salary now — applyDueSalaryChanges() promotes them
  // when their effective date arrives. appliedAt is the marker for "reflected on
  // the employee record" (null = pending promotion).
  const writeNow = apply && !isFuture(effectiveDate);
  if (writeNow) {
    await storage.updateAdminUser(opts.employeeId, { salary: newSalary.toFixed(2) } as any);
  }

  await storage.createSalaryChange({
    employeeId: opts.employeeId,
    sourceType: opts.sourceType,
    sourceDocumentType: opts.sourceDocumentType ?? null,
    sourceDocumentId: opts.sourceDocumentId ?? null,
    oldSalary: oldSalary != null ? oldSalary.toFixed(2) : null,
    newSalary: newSalary.toFixed(2),
    amount: null,
    effectiveDate,
    reason: opts.reason ?? null,
    status: "applied",
    initiatedBy: opts.initiatedBy ?? null,
    approvedBy: opts.approvedBy ?? null,
    appliedAt: writeNow ? new Date() : null,
  } as any);

  return { applied: writeNow, skipped: false };
}

function isFuture(dateOnly: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateOnly > today;
}

// Promote future-dated salary changes whose effective date has now arrived:
// write the latest due value to admin_users.salary and stamp appliedAt. Safe to
// run repeatedly (idempotent — only entries with appliedAt IS NULL are touched).
export async function applyDueSalaryChanges(): Promise<{ promoted: number }> {
  const due = await storage.getDueSalaryChanges();
  // Group by employee; apply only the latest-effective change per employee to the
  // live record, but stamp every promoted row so it isn't reconsidered.
  const latestByEmployee = new Map<string, { date: string; salary: string }>();
  for (const c of due) {
    if (c.newSalary == null || !c.effectiveDate) continue;
    const prev = latestByEmployee.get(c.employeeId);
    if (!prev || c.effectiveDate >= prev.date) {
      latestByEmployee.set(c.employeeId, { date: c.effectiveDate, salary: c.newSalary });
    }
  }
  for (const [employeeId, { salary }] of latestByEmployee) {
    await storage.updateAdminUser(employeeId, { salary: Number(salary).toFixed(2) } as any);
  }
  let promoted = 0;
  for (const c of due) {
    if (c.newSalary == null || !c.effectiveDate) continue;
    await storage.updateSalaryChange(c.id, { appliedAt: new Date() } as any);
    promoted++;
  }
  return { promoted };
}

// Record an advance disbursement in the centralized ledger so it appears in the
// unified salary history. Does NOT change admin_users.salary. Idempotent per
// advance id.
export async function recordAdvanceLedgerEntry(opts: {
  employeeId: string;
  advanceId: string;
  amount: number;
  reason?: string | null;
  effectiveDate?: Date | string | null;
  initiatedBy?: string | null;
}): Promise<void> {
  const existing = await storage.getSalaryChangeBySource("advance", opts.advanceId);
  if (existing) return;
  await storage.createSalaryChange({
    employeeId: opts.employeeId,
    sourceType: "advance",
    sourceDocumentType: "salary_advance",
    sourceDocumentId: opts.advanceId,
    oldSalary: null,
    newSalary: null,
    amount: (Math.round(opts.amount * 100) / 100).toFixed(2),
    effectiveDate: toDateOnly(opts.effectiveDate),
    reason: opts.reason ?? null,
    status: "applied",
    initiatedBy: opts.initiatedBy ?? null,
    approvedBy: null,
    appliedAt: new Date(),
  } as any);
}

// Write back the salary carried by a salary-revision / combined addendum to the
// employee record and the ledger. Resolves the employee from the addendum's
// forEmployeeId, falling back to the parent offer letter's resulting user.
// Idempotent per addendum. No-op for non-salary addendum types or when no new
// salary / employee can be resolved.
export async function applyAddendumSalaryChange(
  addendum: any,
  actorId: string | null,
): Promise<{ applied: boolean; skipped: boolean }> {
  const type = String(addendum?.addendumType || "").toLowerCase();
  if (type !== "salary_revision" && type !== "combined") return { applied: false, skipped: true };

  const newSalary = addendum?.newSalary != null ? Number(addendum.newSalary) : NaN;
  if (!Number.isFinite(newSalary) || newSalary <= 0) return { applied: false, skipped: true };

  let employeeId: string | null = addendum?.forEmployeeId ?? null;
  if (!employeeId && addendum?.offerLetterId) {
    const offer = await storage.getOfferLetter(addendum.offerLetterId);
    employeeId = offer?.resultingUserId ?? null;
  }
  if (!employeeId) return { applied: false, skipped: true };

  return recordSalaryChange({
    employeeId,
    newSalary,
    sourceType: "addendum",
    sourceDocumentType: "addendum",
    sourceDocumentId: addendum.id,
    reason: addendum?.reason || `Salary revision via addendum ${addendum?.referenceNumber || addendum.id}`,
    effectiveDate: addendum?.effectiveDate ?? new Date(),
    initiatedBy: actorId,
    approvedBy: actorId,
    apply: true,
  });
}

// Resolve the opening (current) salary an offer letter implies. Employees start
// on their probation salary when one is specified; otherwise the headline salary.
export function resolveOfferOpeningSalary(letter: any): number | null {
  const probation = letter?.probationSalary != null ? Number(letter.probationSalary) : NaN;
  if (Number.isFinite(probation) && probation > 0) return probation;
  const base = letter?.salary != null ? Number(letter.salary) : NaN;
  if (Number.isFinite(base) && base > 0) return base;
  return null;
}

// Write back the salary an offer letter implies to the employee record + ledger.
// Handles probation vs post-probation: the opening entry uses the probation
// salary (effective at joining); if a distinct post-probation salary is set, a
// second future-dated ledger entry is recorded (effective after the probation
// period) so the salary report transitions automatically by effective date.
// Idempotent per offer (and per post-probation variant). `employeeId` may be
// passed explicitly (new hire just created) or resolved from resultingUserId
// (legacy employee accepting an offer). `apply` writes admin_users.salary now.
export async function applyOfferSalaryChange(
  letter: any,
  actorId: string | null,
  opts?: { employeeId?: string | null; apply?: boolean },
): Promise<{ applied: boolean; skipped: boolean }> {
  const opening = resolveOfferOpeningSalary(letter);
  if (opening == null) return { applied: false, skipped: true };

  const employeeId = opts?.employeeId ?? letter?.resultingUserId ?? null;
  if (!employeeId) return { applied: false, skipped: true };

  const joinDate = letter?.proposedStartDate || new Date().toISOString().slice(0, 10);
  const ref = letter?.referenceNumber || letter?.id;

  const result = await recordSalaryChange({
    employeeId,
    newSalary: opening,
    sourceType: "offer_letter",
    sourceDocumentType: "offer_letter",
    sourceDocumentId: letter.id,
    reason: `Opening salary from offer letter ${ref}`,
    effectiveDate: joinDate,
    initiatedBy: actorId,
    approvedBy: actorId,
    apply: opts?.apply !== false,
  });

  // Future-dated post-probation step, when it differs from the opening salary.
  const postProbation = letter?.postProbationSalary != null ? Number(letter.postProbationSalary) : NaN;
  if (Number.isFinite(postProbation) && postProbation > 0 && Math.round(postProbation * 100) !== Math.round(opening * 100)) {
    const months = Number(letter?.probationPeriodMonths) > 0 ? Number(letter.probationPeriodMonths) : 3;
    const effPost = new Date(joinDate);
    effPost.setMonth(effPost.getMonth() + months);
    await recordSalaryChange({
      employeeId,
      newSalary: postProbation,
      sourceType: "offer_letter",
      sourceDocumentType: "offer_letter",
      sourceDocumentId: `${letter.id}::post_probation`,
      reason: `Post-probation salary from offer letter ${ref}`,
      effectiveDate: effPost,
      initiatedBy: actorId,
      approvedBy: actorId,
      apply: false, // future-dated; salary report applies it by effective date
    });
  }

  return result;
}

// Resolve the salary in effect for an employee as of the end of the given month
// (1-based month). Uses applied ledger entries that change salary (offer_letter /
// addendum / manual) with an effective date on or before the month end; falls
// back to the employee's current salary when no ledger history applies.
export function resolveSalaryAsOf(
  appliedChanges: Array<{ employeeId: string; sourceType: string; newSalary: string | null; effectiveDate: string | null }>,
  employeeId: string,
  fallbackSalary: number,
  year: number,
  month: number,
): number {
  const monthEnd = new Date(year, month, 0); // last day of `month`
  let best: { date: Date; salary: number } | null = null;
  for (const c of appliedChanges) {
    if (c.employeeId !== employeeId) continue;
    if (c.sourceType === "advance") continue;
    if (c.newSalary == null) continue;
    const eff = c.effectiveDate ? new Date(c.effectiveDate) : null;
    if (!eff || eff > monthEnd) continue;
    if (!best || eff >= best.date) best = { date: eff, salary: Number(c.newSalary) };
  }
  return best ? best.salary : fallbackSalary;
}
