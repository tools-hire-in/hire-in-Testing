# Manager Guide — Offer Letters

**Audience:** manager
**Last updated:** 2026-07-21
**Related source doc:** `manager-onboarding-track-source.md` Topic 5

---

## Purpose

This guide explains how managers create offer letters for candidates they are hiring, why the offer enters a pending approval queue rather than being sent immediately, how to track the offer's progress, and what happens after the candidate accepts.

---

## Who Uses It

| Role | What they can do |
|---|---|
| `manager` | Generate offer letters, track status, countersign (for their own offers) |
| `hr`, `admin`, `super_admin` | All offer letter actions |

---

## Where to Find It

`/admin/new-hire` → **Offer Letters** tab

---

## Step-by-Step: Creating an Offer Letter

1. Go to `/admin/new-hire` → Offer Letters tab.
2. Click **Generate Offer Letter**.
3. Fill in all required fields:
   - **Candidate name and email address** — use the candidate's personal email address, not a company address
   - **Role title** — the exact title that will appear in the letter
   - **Department**
   - **Compensation** — base salary and any components agreed upon
   - **Proposed start date**
   - **Probation period** — typically 90 days; confirm with HR if different
4. Click **Create**.

**What happens immediately:** The offer is created in `pending_approval` status. It is **not sent to the candidate yet**. The candidate does not receive any email at this point.

---

## Why Does My Offer Need Approval?

Managers cannot approve their own offers. This is a control that exists for two reasons:

1. **Consistency** — compensation and title must be reviewed against HR policy before external dispatch
2. **Authority** — offer letters are legally binding documents; `super_admin` holds the authorization level required

A `super_admin` receives a notification about your pending offer and must approve it before the email is dispatched.

**Timeline expectation:** Super_admin review typically takes 1–2 business days. If your offer is urgent, contact the super_admin directly after creating it.

---

## Tracking Your Offer's Status

After creating the offer, you can monitor its progress in the Offer Letters dashboard.

| Status | What it means | Your action |
|---|---|---|
| `pending_approval` | Waiting for super_admin to approve | Wait, or contact super_admin |
| `approved` | Approved — email being sent to candidate | None — system handles this |
| `sent` | Email delivered to candidate | None — wait for candidate |
| `viewed` | Candidate has opened the acceptance link | None — give them time |
| `accepted` | Candidate accepted | None — HR handles countersign |
| `countersigned` | HR has countersigned | None — HR handles onboarding |
| `onboarded` | Candidate's account has been created | Prepare for their Day 1 |
| `rejected` | super_admin rejected your offer | Review the rejection reason and revise |
| `expired` | Candidate did not accept within the validity period | HR can reactivate if candidate is still interested |

---

## What Happens After the Candidate Accepts

After the candidate clicks Accept:

1. The offer status changes to `accepted`.
2. **HR handles all post-acceptance steps** — you do not need to do anything.
3. HR countersigns the offer (signing it from the company side).
4. HR onboards the candidate — this creates their portal account and sends their welcome email with login credentials.
5. A probation plan is automatically seeded for the candidate (linked to you as their manager).
6. You receive a notification when the candidate is onboarded and will appear in your My Team view on their joining date.

**There is no manager action required between acceptance and the start date.** HR manages the countersign and onboarding steps.

---

## If Your Offer is Rejected by super_admin

1. You receive a notification with the rejection reason.
2. Review the reason — it may relate to compensation that doesn't match the approved range, title inconsistencies, or missing information.
3. Go to the Offer Letters dashboard, find the rejected offer.
4. Click **Revise** (or create a new offer with corrected details — contact HR to confirm which approach).
5. Resubmit for approval.

---

## If a Sent Offer Needs to Be Cancelled

You **cannot cancel a sent offer** yourself. A sent offer has already reached the candidate and is legally in play.

Contact HR or super_admin immediately if:
- The candidate is no longer suitable and you want to withdraw the offer
- The compensation or role details were incorrect in the sent offer
- The candidate position has been eliminated

Super_admin can cancel a sent offer. This sends the candidate a revocation notification.

---

## Common Mistakes

**"The candidate says they haven't received the offer email after 2 days."**
Check the offer status. If it still shows `pending_approval`, the super_admin has not approved it yet. The email is only sent after approval. Follow up with super_admin.

**"The offer status shows `sent` but the candidate says they can't find the email."**
The email was delivered to the candidate's email address you provided. Ask the candidate to check their spam/junk folder, or verify that you entered the correct email address when creating the offer. If the email address was wrong, contact HR — a new offer with the correct email may need to be created.

**"The offer was accepted but the candidate doesn't show in My Team."**
The candidate will appear in My Team only after HR clicks Onboard (after countersigning). If it has been more than 2 business days since acceptance with no update, follow up with HR.

**"I created an offer but selected the wrong start date."**
If the offer is still in `pending_approval`, contact HR — they may be able to correct it before approval. If it has already been sent, you cannot edit it. The start date can be communicated separately, or HR can cancel and reissue.

---

## Quick Reference

| Task | Who does it | When |
|---|---|---|
| Create offer | Manager | When hiring decision is made |
| Approve offer | super_admin only | After manager creates |
| Send to candidate | System (automatic) | Immediately after approval |
| Countersign | HR / admin / super_admin | After candidate accepts |
| Onboard (create account) | HR / admin / super_admin | After countersign |
| Cancel sent offer | super_admin only | Anytime before onboarding |

---

## Where to Get Help

- Offer letter state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §1
- HR Admin guide for offer letters: `hr-admin-guide-offer-letters.md`
- For urgent approvals: contact super_admin directly
- For post-acceptance questions: contact HR
