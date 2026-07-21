# HR Admin Guide — SOP Publishing and Wave Rollout

**Audience:** hr, admin, super_admin (configure); hr, operations, manager (manage acknowledgements)
**Last updated:** 2026-07-21
**Related source doc:** `hr-admin-onboarding-track-source.md` Topic 4

---

## Purpose

This guide explains how to publish Standard Operating Procedures (SOPs), configure wave-based rollout phases, understand the difference between soft, measured, and full enforcement, and manage the compliance lock so employees are not accidentally locked out of the portal before they are ready.

---

## Who Uses It

| Role | What they can do |
|---|---|
| `super_admin` | Full SOP configuration, wave assignment, enforcement levels |
| `admin` | Full SOP configuration, wave assignment, enforcement levels |
| `hr` | View compliance status, manage exceptions |
| `operations` | View SOP library, manage their team's acknowledgements |
| `manager` | View SOP library and their team's compliance status |

---

## Where to Find It

- SOP Library: `/admin/sops`
- Compliance view (employee assignments): `/admin/sops/compliance`
- Policy gate (employee lock screen): `/admin/policy-gate`
- Process governance flag: `/admin/settings/feature-flags` → `process_governance`

---

## Step 1 — Create and Publish an SOP

1. Go to `/admin/sops` → click **Create SOP**.
2. Fill in:
   - **Title** and **category** (e.g., Operations, HR, Security)
   - **Content** — the SOP body (rich text/markdown)
   - **Applicable roles** — which roles must acknowledge this SOP
3. Click **Submit for Review**.
4. A designated reviewer approves the SOP.
5. After approval, click **Publish** — the SOP is now live in the library.

**Publishing cadence limit:** No more than **2 operational SOPs** can be published per week (outside Wave 0). This prevents employees from being overwhelmed. Wave 0 SOPs are exempt from this limit.

**Versioning:** When you need to update an already-published or active SOP, editing creates a new version (clone). The previous version is locked. Employees who acknowledged the old version must re-acknowledge the new version.

---

## Step 2 — Assign Employees to Rollout Waves

Waves control when enforcement applies to a group of employees. Before configuring enforcement, assign employees to waves.

**Wave definitions:**

| Wave | Typical use | Enforcement behavior |
|---|---|---|
| Wave 0 | Pilot group / leadership | Exempt from weekly cadence limit; gets access earliest |
| Wave 1 | Early adopters | Configured enforcement |
| Wave 2–4 | Progressive rollout groups | Configured enforcement |
| Wave 5 | Full compliance lock target | Full enforcement — portal lock on overdue |

Wave assignments are managed in SOP settings. Each employee belongs to one wave per SOP. You can bulk-assign by department or role.

---

## Step 3 — Configure Enforcement Levels

Set the enforcement level per wave. There are three levels:

### `soft` — Warning banner, no access restriction
- Employees see a warning banner at the top of the portal
- Portal access is **not restricted** — they can continue working
- Use this for initial awareness phases

### `measured` — Tracked compliance, no lock
- System tracks overdue acknowledgements and reports them
- Managers and HR can see compliance percentages
- Portal access is **not restricted**
- Use this for accountability without disruption

### `full` — Compliance lock
- Employees who are overdue (past their due date) AND in `full` enforcement are **locked out of the portal**
- They see the policy gate screen (`/admin/policy-gate`) listing the overdue items
- Access is restored immediately when they complete the required acknowledgements
- Use this only after employees have had sufficient time in `soft` or `measured` waves

**Important:** The compliance lock only activates when **both** conditions are true:
1. The employee is in a wave with `full` enforcement
2. The employee's assignment is past the due date (grace period: 15 days after due date before lock activates)

---

## Managing the Compliance Lock

### Granting an exception

If an employee should not be required to complete a specific SOP (e.g., the content is not relevant to their role, or they were on leave during the rollout):

1. Go to `/admin/sops/compliance`.
2. Find the employee and the specific SOP assignment.
3. Click **Grant Exception**.
4. Enter the reason.
5. Confirm.

**What an exception does:**
- The employee is permanently exempt from that SOP requirement
- They will not be asked to acknowledge it again
- Their compliance lock for this SOP is removed immediately

**What an exception does NOT do:**
- It does not remove other overdue SOP requirements — only the one you excepted
- Exceptions are permanent — use them sparingly

### Extending a due date

If an employee needs more time (not a full exception):

1. Go to `/admin/sops/compliance`.
2. Find the employee's assignment.
3. Click **Extend Due Date**.
4. Enter the new due date.
5. Save.

The compliance lock will not activate until the new due date (plus 15-day grace period).

---

## SOP Acknowledgement Flow (Employee Experience)

When an employee is assigned an SOP:
1. They receive an email notification with a link.
2. They can also access assigned SOPs from `/admin/hr/my-training` → SOPs tab.
3. They read the SOP content.
4. They click **Acknowledge** and type their full name (digital sign-off).
5. The acknowledgement is stored with: typed name, timestamp, IP address, and document hash.

Acknowledgements are **immutable** — they cannot be edited or deleted once recorded.

---

## SOP Access Control — Access Requests (OPS-001)

For SOPs that require tool or system access (typically operations SOPs), employees can submit an access request directly from the SOP page. These requests are handled through the internal requests system and can be linked to the specific SOP.

HR and operations roles can view and action pending access requests.

---

## Common Mistakes

**"Employees are locked out before they had a chance to read the SOP."**
Check the enforcement level for their wave. If they were moved to `full` enforcement before the due date was set appropriately, they may have been locked prematurely. Either extend the due date or temporarily move their wave to `measured` while they catch up.

**"I published 3 operational SOPs this week and the third one failed."**
The system limits operational SOP publications to 2 per week (outside Wave 0). Wait until the following week, or classify the SOP as Wave 0 if it is a pilot/leadership-only document.

**"An employee says they acknowledged an SOP but they're still locked out."**
Check if there are multiple overdue SOPs — the employee may have only acknowledged one. Check `/admin/sops/compliance` for all their outstanding items.

**"We updated an SOP — do employees need to re-acknowledge?"**
Yes. Any published and active SOP that is edited creates a new version. All employees assigned to that SOP must re-acknowledge the new version.

---

## Quick Reference — Enforcement Levels

| Level | Portal access | Use when |
|---|---|---|
| `soft` | Unrestricted | Initial awareness — visibility only |
| `measured` | Unrestricted | Accountability tracking without disruption |
| `full` | Locked for overdue employees | Compliance is mandatory and rollout is complete |

---

## Quick Reference — Key Rules

| Rule | Detail |
|---|---|
| Weekly publication limit | ≤ 2 operational SOPs/week (Wave 0 exempt) |
| Grace period before lock | 15 days after due date |
| Lock condition | Overdue AND in `full` enforcement wave |
| Exception effect | Permanent bypass of that SOP requirement |
| Version update | Edited published SOPs create new versions requiring re-acknowledgement |
| Compliance flag | `process_governance` flag must be ON for SOP pages to be visible |

---

## Where to Get Help

- SOP state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §6 (SOP lifecycle) and §7 (employee SOP progress)
- SOP wave rollout rules: `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §SOP Compliance
- For bulk wave reassignments or exceptions: contact super_admin
