# HR Admin Guide — Offer Letters

**Audience:** hr, admin, super_admin, manager (generation only)
**Last updated:** 2026-07-21
**Related source doc:** `hr-admin-onboarding-track-source.md` Topic 1

---

## Purpose

This guide walks HR administrators, admins, and managers through the complete offer letter workflow — from generating an offer to countersigning and triggering onboarding. It explains why the approval step exists, what each status means, and what the candidate sees at every stage.

---

## Who Uses It

| Role | What they can do |
|---|---|
| `super_admin` | Generate, approve, countersign, cancel, onboard |
| `admin` | Generate, countersign, onboard (cannot approve — goes to pending_approval) |
| `hr` | Generate, countersign, onboard (cannot approve — goes to pending_approval) |
| `manager` | Generate and track (cannot approve — goes to pending_approval) |
| `operations` | View only |

---

## Where to Find It

`/admin/new-hire` → **Offer Letters** tab

---

## Step-by-Step: Generating an Offer Letter

1. Go to `/admin/new-hire` → Offer Letters tab.
2. Click **Generate Offer Letter**.
3. Fill in all required fields:
   - Candidate name and email address
   - Role title and department
   - Compensation (base salary, components)
   - Proposed start date
   - Probation period (typically 90 days)
4. Click **Create**.

**What happens next depends on your role:**

- If you are `super_admin`: the offer moves directly to `approved` and the system sends the email to the candidate automatically.
- If you are `hr`, `admin`, or `manager`: the offer enters `pending_approval`. It is **not sent to the candidate** until a `super_admin` reviews and approves it.

---

## Step-by-Step: Approving an Offer (super_admin only)

1. Go to `/admin/new-hire` → Offer Letters tab.
2. Offers in `pending_approval` are shown with an orange badge.
3. Click the offer row to open the detail view.
4. Review all details. If correct, click **Approve**. The system sends the candidate email automatically.
5. If incorrect, click **Reject** and enter a reason. The creator is notified.

---

## Step-by-Step: Countersigning After Candidate Accepts

1. The offer status changes to `accepted` when the candidate accepts via the link in their email.
2. Go to the Offer Letters dashboard — the row now shows an **accepted** badge.
3. Click the row → click **Countersign**.
4. Review the offer content one final time.
5. Click **Confirm Countersign**. A cryptographic document hash is stored — the offer letter content is now locked and cannot be modified.
6. The status moves to `countersigned`.

---

## Step-by-Step: Onboarding the Candidate

1. After countersigning, click **Onboard**.
2. The system creates the employee's portal account.
3. A welcome email with login credentials is sent to the candidate's email address.
4. The employee plan (probation or growth) is activated — the NULL `employee_id` on the seeded plan is resolved.
5. Status moves to `onboarded`.

---

## Offer Status Reference

| Status | Meaning | Who sees next action |
|---|---|---|
| `draft` | Created but not yet submitted | Creator |
| `pending_approval` | Waiting for super_admin to approve | super_admin |
| `approved` | Approved — email sending in progress | System |
| `sent` | Email delivered to candidate | HR (track) |
| `viewed` | Candidate has opened the offer link | HR (track) |
| `accepted` | Candidate clicked Accept | HR/admin (countersign) |
| `countersigned` | HR has countersigned | HR/admin (onboard) |
| `onboarded` | Employee account created | N/A — complete |
| `rejected` | Rejected by super_admin | Creator (revise and resubmit) |
| `expired` | Offer passed validity window without acceptance | HR (can reactivate) |
| `cancelled` | Withdrawn after sending | — |

---

## Common Mistakes

**"The candidate hasn't received the offer email — where is it?"**
Check the offer status. If it shows `pending_approval`, the email has not been sent. A `super_admin` must approve the offer before the email is dispatched. Contact your super_admin.

**"I countersigned but the candidate says their login doesn't work."**
Countersigning alone does not create credentials. You must click **Onboard** after countersigning to trigger account creation.

**"A manager created the offer — can I approve it as HR?"**
No. Only `super_admin` can approve offers regardless of who created them.

**"The offer was accepted but the plan shows employee_id = NULL."**
This is expected. The plan is seeded at acceptance with a NULL employee_id and resolves when you click Onboard and the employee account is created.

---

## Quick Reference

| Task | Role required | Where |
|---|---|---|
| Create offer | Any role except employee | `/admin/new-hire` → Offer Letters |
| Approve offer | super_admin only | Offer Letters → pending_approval row |
| Countersign | hr, admin, super_admin | Offer Letters → accepted row |
| Onboard | hr, admin, super_admin | Offer Letters → countersigned row |
| Cancel sent offer | super_admin only | Offer Letters → offer row → Cancel |
| Reactivate expired offer | hr, admin, super_admin | Offer Letters → expired row |

---

## Where to Get Help

- Offer letter workflow state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §1
- Status tooltips are shown on each row in the Offer Letters dashboard
- For `pending_approval` offers that need urgent approval, contact your super_admin directly
