# HR Admin Guide — HR Letters and Amendment Letters

**Audience:** hr, admin, super_admin
**Last updated:** 2026-07-21
**Related source doc:** `hr-admin-onboarding-track-source.md` Topic 3

---

## Purpose

This guide covers how to generate, issue, email, revoke, and re-issue formal employment letters. It explains the controlled-wording restriction, how public verification works, and the difference between standard HR letters and amendment letters.

---

## Who Uses It

| Role | What they can do |
|---|---|
| `super_admin` | All letter operations |
| `admin` | Generate, issue, email, revoke, re-issue |
| `hr` | Generate, issue, email, revoke, re-issue |
| `manager` | View letters for their direct reports (read only) |

---

## Where to Find It

`/admin/hr/tools` → HR Letters section

---

## Letter Types

### Standard HR Letters (PDF)

| Letter Type | When to use |
|---|---|
| **Experience Letter** | When an employee needs proof of employment duration and role |
| **Internship Letter** | At the end of an internship engagement |
| **Relieving Letter** | When an employee exits (voluntarily: "Left Company"; involuntarily: "Relieved") |

### Amendment Letters (DOCX via addendum engine)

| Letter Type | When to use |
|---|---|
| **Salary Revision** | When an employee's compensation changes |
| **Designation / Promotion** | When an employee's title or grade changes |
| **Combined** | When both salary and designation change simultaneously |
| **Device Allocation** | When issuing company equipment to an employee |

All letter types are verifiable at `/verify` using the reference number and auth code printed on the letter.

---

## Step-by-Step: Generating a Standard HR Letter

1. Go to `/admin/hr/tools` → HR Letters section.
2. Click **Generate Letter**.
3. **Select the employee** — use the search field to find the employee by name or email.
4. **Select the letter type** (Experience, Internship, or Relieving).
5. For Relieving letters: select the exit status:
   - `Relieved` — involuntary exit (company-initiated)
   - `Left Company` — voluntary resignation
6. Click **Generate** — the letter is created in `draft` status with pre-defined controlled wording.
7. Review the draft. You can review content in the preview panel.
8. Click **Issue** — the system assigns a unique **reference number** and **auth code**. The letter is now externally verifiable.
9. Click **Email** to send the PDF to the employee, or **Download** to retrieve the PDF for manual delivery.

---

## Step-by-Step: Generating an Amendment Letter

1. Go to `/admin/hr/tools` → Amendment Letters section.
2. Click **Generate Amendment**.
3. **Choose your input method:**
   - **System employee picker** — find the employee in the portal (pre-fills name and details)
   - **Manual entry** — type candidate or employee details (used for letters to people not yet in the system)
4. Select the amendment type (Salary Revision, Designation/Promotion, Combined, Device Allocation).
5. Fill in the amendment-specific fields:
   - Salary Revision: old salary, new salary, effective date
   - Designation: old title, new title, effective date
   - Device Allocation: device type, serial number, allocation date
6. Click **Generate** — a DOCX file is produced via the addendum engine.
7. Optional: click **Email** to send the DOCX to the employee.
8. The letter receives a reference number and auth code — verifiable at `/verify`.

---

## Controlled Wording — Why You Cannot Add Custom Text

HR letters use **controlled wording** by design. Free-form text outside the designated input fields is not supported.

This is intentional for two reasons:
1. **Legal consistency** — controlled language prevents inadvertent commitments or inconsistent employment terms across letters
2. **Verification integrity** — the verification hash is computed from the letter body; custom text would require reissuing

If you need to convey information not covered by the standard template, include it in a separate email or attachment — do not attempt to insert it into the letter body.

---

## Revoking a Letter

Use revocation when:
- A letter was issued with incorrect information and you need to replace it
- An employee has left and a letter they hold should no longer be considered valid

**Steps:**
1. Find the letter in the HR Letters dashboard.
2. Click **Revoke**.
3. Enter a revocation reason (stored in the audit log).
4. Confirm.

**What revocation does:**
- The reference number remains valid at `/verify` but returns **"Revoked"** status
- The letter row is retained in the database — it is not deleted
- "Revoked" at `/verify` is sufficient proof for third parties that the letter is no longer active

**What revocation does NOT do:**
- It does not notify the employee automatically — email the employee separately if needed
- It does not delete the original PDF

---

## Re-issuing a Letter

If a letter was revoked due to an error and you need to issue a corrected version:

1. Revoke the incorrect letter (see above).
2. Generate a new letter with the correct details.
3. Issue the new letter — it receives a new reference number and auth code.
4. Email the corrected letter to the employee.

Note: if the employee's legal name has changed since the original letter was issued, the re-issued letter will reflect the current name in the system. If this is a concern, verify the correct name before issuing.

---

## Public Verification — How It Works

Any third party (bank, government body, landlord) can verify a letter without logging in:

1. Visit `/verify` (public page, no account required).
2. Enter the **reference number** and **auth code** from the letter.
3. Click **Verify**.
4. The page displays:
   - Letter type
   - Issue date
   - Employee first name
   - Status: **Active** or **Revoked**

The page deliberately shows minimal personal information. Full name and salary details are not disclosed to third parties — only enough to confirm authenticity.

---

## Common Mistakes

**"I generated a letter but forgot to click Issue — the employee says they can't verify it."**
A letter in `draft` status has no reference number and is not verifiable. Click **Issue** to assign the reference number and make the letter verifiable.

**"I issued a letter with the wrong job title."**
Revoke the incorrect letter and generate a new one with the correct title. The reference number on the original is now "Revoked" at `/verify`. Issue the corrected version and email it to the employee.

**"A third party says the verification returns an error for our letter."**
Check that the employee is reading the reference number and auth code from the correct letter (they can be hard to read on some PDF viewers). Ensure no spaces were added. If the issue persists, check whether the letter was accidentally revoked.

**"An employee needs a letter for a role they held two years ago."**
Experience letters use the information currently stored in their employee record. If their role has been updated, verify the correct dates and title before generating. For legacy roles, use the manual entry option to specify the exact role and dates.

---

## Quick Reference

| Task | Role required | Verifiable immediately? |
|---|---|---|
| Generate and Issue (Experience/Internship/Relieving) | hr, admin, super_admin | Yes, after Issue |
| Generate and Issue (Amendment letters) | hr, admin, super_admin | Yes, after Issue |
| Revoke a letter | hr, admin, super_admin | — (verification returns "Revoked") |
| Re-issue after revocation | hr, admin, super_admin | Yes, after re-issuing |
| View letter for a direct report | manager | Read only |
| Verify a letter (public) | Anyone | `/verify` — no account needed |

---

## Letter Verification Status Meanings

| Status at `/verify` | Meaning |
|---|---|
| **Active** | Letter is valid and in force |
| **Revoked** | Letter has been withdrawn by HR |
| **Not found** | Reference number or auth code is incorrect |

---

## Where to Get Help

- HR Letter state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §12
- Public verification: `/verify` (no login required)
- For bulk letter generation needs, contact the system administrator
