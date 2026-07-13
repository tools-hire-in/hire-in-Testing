/**
 * seed-platform-training.ts
 * =========================
 * Seeds 8 role-based platform training tracks into the Hire'in portal.
 *
 * MANUAL VERIFICATION STEPS (HR Admin):
 * 1. Navigate to /admin/hr/training — confirm all 8 tracks appear with status "published".
 * 2. Navigate to /admin/hr/training-progress — confirm every active team member shows
 *    at least one assignment (universal track) plus their role-specific track.
 * 3. Open one track as an employee-role user — confirm sections load with full prose
 *    content, the dwell timer activates on section 1, and the quiz appears on the
 *    sections marked for comprehension checks.
 * 4. Check role_training_rules table — confirm all 9 role slugs are covered
 *    (super_admin, admin, hr, finance, operations, manager, recruiter, operations,
 *    executive have explicit rules; employee is covered via the universal track).
 *
 * RUN:
 *   npx tsx scripts/seed-platform-training.ts
 *
 * IDEMPOTENT: Safe to run twice. Tracks are skipped if title already exists.
 * Quiz questions are added incrementally if a section has fewer than required.
 * Assignments are skipped if the user already has one for that track.
 */

import { db } from "../server/db";
import {
  learningTracks,
  trackSections,
  sectionQuizQuestions,
  sectionQuizOptions,
  roleTrainingRules,
  trackAssignments,
  adminUsers,
} from "../shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function calcDwell(body: string): number {
  return Math.max(60, Math.floor(wordCount(body) / 10));
}

// ─── TYPE HELPERS ─────────────────────────────────────────────────────────────

interface QuizOption {
  text: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  questionText: string;
  explanation: string;
  options: QuizOption[];
}

interface SectionDef {
  title: string;
  body: string;
  quiz: { questions: QuizQuestion[] } | null;
}

interface TrackDef {
  title: string;
  description: string;
  isUniversal: boolean;
  isPolicyTrack: boolean;
  status: string;
  targetRole: string | null;
  roles: string[];
  sections: SectionDef[];
}

// ─── TRACK CONTENT ────────────────────────────────────────────────────────────

const TRACKS: TrackDef[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // TRACK 1 — Platform Fundamentals (Universal)
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: "Platform Fundamentals",
    description: "Core orientation for every person on the Hire'in platform — security, My Desk, and getting help.",
    isUniversal: true,
    isPolicyTrack: false,
    status: "published",
    targetRole: null,
    roles: [],
    sections: [
      {
        title: "What is Hire'in Solutions",
        body: `Hire'in Solutions is an AI-powered staffing and talent acquisition firm designed to serve clients across four specialist verticals: Healthcare, Information Technology, Engineering, and Professional Services. The platform you are using right now is not just a website — it is an integrated operating system that connects a public-facing job board with a comprehensive internal HR portal, giving the whole team a single place to manage recruitment, employee lifecycle, payroll, compliance, and communication.

On the public side, candidates and employers interact with a marketing website that displays active job listings pulled in real time from the Ceipal ATS. On the internal side, every member of the team has a role-specific portal where they carry out their day-to-day work. Recruiters and operations staff manage the talent pipeline; HR handles employee records, leave, and letters; finance runs payroll; managers oversee their teams; and employees access their own payslips, leave balances, and training assignments.

The platform is built on React 18 for the frontend, Node.js and Express for the backend API, and PostgreSQL for all data storage. Drizzle ORM connects the application to the database, and the schema is maintained as a single source of truth in shared/schema.ts. Authentication is handled through a combination of Replit Auth (OpenID Connect) and a custom email and password system secured with bcrypt. Role-based access control (RBAC) governs what each user can see and do, so the system adapts its navigation and available actions based on who is logged in.

You are part of a team that is genuinely using this platform to run the business. That means your experience as a user directly informs how the platform improves over time. When you encounter something confusing, missing, or broken, the right move is to raise a Help Desk ticket — not to work around it silently. The platform's four service verticals map to distinct client relationships, and the internal tools you use every day are designed to make those relationships more efficient, more auditable, and more professional.`,
        quiz: null,
      },
      {
        title: "Your Account and Security",
        body: `Every account on the Hire'in platform requires mandatory two-factor authentication using a Time-based One-Time Password (TOTP). TOTP works by linking your account to an authenticator app on your phone — Google Authenticator and Authy are both supported. When you log in, you enter your email address and password as usual, and then you are prompted for a six-digit code that the app generates fresh every 30 seconds. This second factor ensures that even if your password is ever compromised, an attacker cannot access the platform without also having your physical device.

Setting up 2FA is not optional. The system enforces it before granting access to any protected page. If you have not yet set up TOTP, you will be redirected to the setup screen on your next login. Keep a backup of your authenticator recovery codes in a safe place — if you lose access to your phone, recovery requires contacting HR directly.

Sessions on the platform have a 30-minute auto-timeout. If you leave a browser tab open and do not interact with the platform for 30 minutes, you will receive a warning popup with a countdown. If you do not click to extend the session within that window, you will be logged out automatically. This is a security control that prevents someone from walking up to an unattended computer and accessing the system under your credentials. Sessions are rolling — every time you make a request, the 30-minute clock resets, so active work will never be interrupted.

Password policy requires a minimum of 8 characters. Do not share your password with colleagues under any circumstance. If you suspect your account has been compromised, contact your HR administrator immediately. The system stores only a bcrypt hash of your password — no one, including system administrators, can retrieve your plaintext password. If you forget your password, use the password reset flow, which sends a time-limited link to your registered email address.

Do not log in from public or shared computers where possible. Always log out explicitly when you finish a session on a shared machine rather than relying on the auto-timeout.`,
        quiz: {
          questions: [
            {
              questionText: "What happens after 30 minutes of inactivity on the platform?",
              explanation: "The platform enforces a 30-minute rolling session timeout as a security control. A warning is shown first, and if not dismissed, the session is terminated automatically.",
              options: [
                { text: "The page refreshes automatically with no effect on your session", isCorrect: false },
                { text: "You receive a warning popup, and if not dismissed, you are logged out", isCorrect: true },
                { text: "Your account is permanently locked and requires HR to unlock it", isCorrect: false },
                { text: "Your work is saved and you remain logged in indefinitely", isCorrect: false },
              ],
            },
            {
              questionText: "What type of two-factor authentication does the Hire'in platform require?",
              explanation: "The platform requires TOTP (Time-based One-Time Password) 2FA. It is mandatory — users cannot bypass it after account creation. The six-digit code refreshes every 30 seconds in an authenticator app.",
              options: [
                { text: "SMS one-time password sent to your registered phone number", isCorrect: false },
                { text: "Hardware security key (YubiKey or similar)", isCorrect: false },
                { text: "TOTP via an authenticator app such as Google Authenticator or Authy", isCorrect: true },
                { text: "Email one-time password sent each time you log in", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "My Desk Walkthrough",
        body: `My Desk is the central dashboard you land on after logging in. It is designed around a single principle: give you an immediate, accurate picture of your own status and let you take the most common actions without navigating away. The layout adapts based on your role — what a manager sees differs from what an employee sees — but the core widgets are consistent.

The most important action on My Desk is punching in and out. When you arrive at work, locate the full-width Punch In button on the Attendance tab of My Desk. Press it to record your start time. When you leave, press Punch Out. The system records a timestamp in the database for each action. Your total hours for the day are calculated from the difference, and this figure feeds directly into your monthly attendance report, which in turn affects your salary calculation if any Loss of Pay (LOP) applies.

Break tracking is integrated into the punch flow. Once you are punched in, a Breaks card appears on the Attendance tab. You are entitled to one Lunch break of up to 30 minutes and two Tea breaks of up to 15 minutes each. Start and end each break using the controls in the Breaks card. A live timer shows how long your break has been running. The system applies soft warnings if you exceed the break allowance — these are informational only and do not automatically deduct from your pay, but they are visible to your manager.

The Leave Balance section on My Desk shows your current Earned Leave (EL) and Sick Leave (SL) balances for the year. EL accrues at a rate designed to give 15 days per year, but accrual for any given month is conditional on meeting a minimum hours-worked threshold. SL accrues unconditionally at a rate giving 8 days per year. To apply for leave, navigate to the Leaves tab on My Desk, select the leave type, choose your dates, and submit — your manager will receive a notification to approve or reject the request.

The Notifications bell in the top bar shows unread alerts. These include leave approval decisions, training due date reminders, and system announcements. Clicking the bell opens the notification panel. The unread count badge updates in real time as new notifications arrive.`,
        quiz: {
          questions: [
            {
              questionText: "What is the maximum duration of a Tea break on the platform?",
              explanation: "The break policy allows two Tea breaks of up to 15 minutes each. Lunch is a single break of up to 30 minutes. The BreakWidget enforces soft warnings if these limits are exceeded.",
              options: [
                { text: "30 minutes per Tea break", isCorrect: false },
                { text: "15 minutes per Tea break, with a maximum of two Tea breaks per day", isCorrect: true },
                { text: "15 minutes total for all breaks combined", isCorrect: false },
                { text: "There is no time limit on Tea breaks", isCorrect: false },
              ],
            },
            {
              questionText: "How many Lunch breaks are you entitled to per working day?",
              explanation: "The break policy allows exactly one Lunch break of up to 30 minutes per day, plus two separate Tea breaks of up to 15 minutes each.",
              options: [
                { text: "Two Lunch breaks — one in the morning and one in the afternoon", isCorrect: false },
                { text: "One Lunch break of up to 30 minutes", isCorrect: true },
                { text: "As many as needed, provided the total does not exceed 60 minutes", isCorrect: false },
                { text: "None — breaks are at manager discretion and are not tracked by the system", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Getting Help",
        body: `The platform has a built-in Help Desk ticketing system accessible from the My Profile section of your navigation. When you encounter a problem — whether it is a technical bug, an attendance discrepancy, a question about your payslip, or a policy clarification — the right first step is to raise a ticket rather than messaging someone directly. Tickets create a paper trail, get routed to the right person, and allow the team to track patterns in recurring issues.

When raising a ticket, choose the correct type from the dropdown. Regularisation tickets are for attendance corrections — for example, if you forgot to punch in or out on a particular day and need a manager to fix the record. General tickets are for any other query, question, or report.

Escalation works as follows. Your ticket is first reviewed by your reporting manager. If the issue requires HR involvement — for example, a leave balance discrepancy or a question about your employment letter — the manager will escalate it to the HR team. For payroll-related queries, escalation goes to Finance. System access issues or account problems go to Super Admin or Admin. You will receive in-app notifications as your ticket status changes from Open to In Review to Resolved.

For urgent issues that cannot wait for the ticket workflow — such as being locked out of your account entirely — contact your HR administrator directly by email or phone using the contact details shared during your onboarding. For questions about your role, assignments, or goals, your primary point of contact is always your direct reporting manager. For questions about the platform itself — features, bugs, or feature requests — raise a ticket and tag it appropriately so the product team can review it.

Do not attempt to work around technical issues by asking a colleague with higher permissions to perform actions on your behalf. This creates audit gaps and can cause compliance problems. Always use the official channels so the system maintains an accurate record of who did what and when.`,
        quiz: null,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRACK 2 — Product Owner Onboarding (super_admin, admin)
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: "Product Owner Onboarding",
    description: "Full product scope, task lifecycle, feature flags, and definition of done for platform administrators.",
    isUniversal: false,
    isPolicyTrack: false,
    status: "published",
    targetRole: "_rules_only",
    roles: ["super_admin", "admin"],
    sections: [
      {
        title: "Full Product Module Map",
        body: `The Hire'in platform is organised into two major surfaces: the public-facing marketing and recruitment site, and the internal admin portal. As a product owner or administrator, you are responsible for understanding both surfaces and how they connect.

The public surface includes the job board, which displays active listings pulled from the Ceipal ATS via a JWT-authenticated integration. Candidates can browse jobs, apply directly, and submit contact inquiries. The marketing site also includes the IT Staffing page with its hero section, stats strip, and slide viewer, designed to generate leads from enterprise technology clients.

The internal admin portal is where all operational work happens. It is divided into the following major modules: My Work (the personal dashboard including attendance punch, leave management, holidays, and break tracking); My Team (manager tools for team oversight, leave approvals, attendance monitoring, and growth plans); People and HR (the HR team's control centre for the employee directory, leave administration, department management, and user settings); Recruitment (job listings and candidate pipeline management); New Hire (the pre-employment pipeline covering offer letters, onboarding status, and user provisioning); HR Tools (the salary slip generator, letter generator for experience and relieving letters, and amendment letters for salary revisions, promotions, and device allocation); Payroll (India statutory payroll engine, salary structures, and run management); Training (the learning management system including track management, assignments, and compliance reporting); Performance (goals, check-ins, review cycles, and feedback); Content Studio (AI-assisted content creation for the marketing team); and the Executive Cockpit (a read-only high-level view for senior leadership).

Each module has a primary persona — the role that uses it most and whose needs it is optimised for. Knowing the primary persona for each module helps you make better decisions about what to prioritise when conflicts arise. The training module serves employees first but is configured by HR. The payroll module is owned by Finance but its outputs are consumed by employees. Understanding these ownership lines prevents you from building features that optimise for the wrong person.`,
        quiz: {
          questions: [
            {
              questionText: "Which module provides the pre-employment pipeline, covering offer letters, onboarding status, and user provisioning?",
              explanation: "The New Hire section (/admin/new-hire) is the dedicated pre-employment pipeline. It is accessible to super_admin, admin, hr, operations, and manager roles but not to employee-role users.",
              options: [
                { text: "People and HR", isCorrect: false },
                { text: "Recruitment", isCorrect: false },
                { text: "New Hire", isCorrect: true },
                { text: "HR Tools", isCorrect: false },
              ],
            },
            {
              questionText: "Who owns the Payroll module, and whose primary needs does it serve?",
              explanation: "Finance owns and operates the Payroll module (they run it and are accountable for accuracy), but its outputs — salary slips — are primarily consumed by employees. A good product decision balances both personas.",
              options: [
                { text: "HR owns and operates it; employees consume its outputs", isCorrect: false },
                { text: "Finance owns and operates it; employees consume its outputs", isCorrect: true },
                { text: "Super Admin owns it; all roles consume its outputs equally", isCorrect: false },
                { text: "Employees own their own payroll data; Finance only reviews totals", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "MLP Definition — What Must Never Break",
        body: `Every software system has a core that must always work. On the Hire'in platform, we call this the Minimum Loveable Product (MLP) — the set of flows so critical that a failure in any one of them directly harms employees, candidates, or clients. As a product owner, your first obligation is to protect these flows above everything else.

The five critical path flows on this platform are: payroll processing, offer letter generation and signing, leave request and approval, attendance recording (punch in and out), and HR letter verification via the public /verify page.

Payroll processing is P0 because it touches people's livelihoods. A bug that miscalculates net pay, applies incorrect deductions, or prevents a salary slip from generating is a legal and reputational emergency. The payroll engine is a pure paise-based computation engine — every amount is stored and calculated in the smallest unit of currency to avoid floating point errors. This must never be changed casually.

Offer letter generation is P0 because it is the legal contract that brings candidates onboard. The PDF must render correctly, the e-sign flow must complete reliably, the HR counter-signature must be recorded with a cryptographic hash, and the candidate's acceptance must be immutable once submitted. A broken offer letter pipeline stops hiring entirely.

Leave management is P0 because errors in leave calculation directly affect attendance records, which feed into payroll. An incorrectly rejected leave request, a balance that does not update after approval, or a leave that shows as pending forever all create real consequences for employees and their pay.

Attendance recording — specifically the punch in and punch out flow — is P0 because it is the data source for both leave and payroll. If the punch button fails to record, or the timestamp is wrong, or the daily attendance sweep misclassifies a day, the downstream calculations cannot be trusted.

The public /verify page is P0 from a client trust perspective. HR issues letters with a reference number and an auth code. Candidates and employers verify the authenticity of those letters by entering those codes on the public verification page. If this page is broken, letters issued by the platform become unverifiable, which is a compliance failure.

Never ship a change to any of these five flows without smoke-testing the complete end-to-end path first.`,
        quiz: {
          questions: [
            {
              questionText: "Why is the payroll engine implemented using paise rather than rupees?",
              explanation: "Floating point arithmetic on fractional rupee amounts (e.g. 0.1 + 0.2 ≠ 0.3 in IEEE 754) would cause rounding errors that compound across deductions. Using integer paise eliminates this class of error entirely.",
              options: [
                { text: "To comply with Reserve Bank of India regulations on digital payments", isCorrect: false },
                { text: "To avoid floating point rounding errors that would compound across deductions", isCorrect: true },
                { text: "Because the database schema does not support decimal columns", isCorrect: false },
                { text: "To match the format expected by the Ceipal ATS integration", isCorrect: false },
              ],
            },
            {
              questionText: "Which of the five critical path flows is P0 because it is the data source for both leave management and payroll?",
              explanation: "Attendance recording (punch in and punch out) is the foundational data source. If timestamps are wrong or daily attendance is misclassified, both leave calculations and payroll deductions become unreliable downstream.",
              options: [
                { text: "HR letter verification on the /verify page", isCorrect: false },
                { text: "Offer letter generation and signing", isCorrect: false },
                { text: "Attendance recording (punch in and out)", isCorrect: true },
                { text: "Leave request and approval", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Feature Flag System",
        body: `The platform uses a centralised feature flag system stored in the system_settings database table. Feature flags let the team enable or disable entire product surfaces without deploying code. They are particularly important during staged rollouts, where a new feature needs to be live in the codebase but not yet visible to users.

Every flag has three required registration points, and missing any one of them means the flag is silently treated as disabled forever. The three places are: the ALLOWED_FLAGS list in the routes file (which prevents unknown flag names from being set via the API), the flagDefs array in the HR Settings UI page (which renders the toggle in the admin panel), and the FLAG_DEFAULTS object in the server startup seed (which ensures the flag exists in the database with a safe default value when the system boots for the first time).

Current flags in the system include: in-app notifications (controls the notification bell and unread badge), document reminder emails (triggers automatic emails when training or onboarding documents are overdue), onboarding training (enables or disables the training compliance lock that prevents employees with overdue training from accessing certain features), performance management (enables or disables the entire performance module including goals, check-ins, review cycles, and feedback), salary advance (enables or disables the self-service salary advance request flow for employees — note that the manual recording tool for super_admin, admin, and HR bypasses this flag and is always available), and new look (the platform redesign opt-in flag that activates the v2 visual theme when set alongside the per-user preference).

To toggle a flag, navigate to People and HR, open Settings, and find the Feature Flags section. Changes take effect immediately — there is no restart required for most flags. However, the onboarding training compliance lock is evaluated at session load time, so affected users may need to log out and back in to see the updated behaviour.

Before disabling any flag in production, confirm with the team that no active process depends on it. Disabling the salary advance flag, for example, will prevent employees from submitting new requests but will not affect advances already in progress.`,
        quiz: null,
      },
      {
        title: "How Work Flows on This Team",
        body: `Every piece of work on this platform follows a lifecycle with defined stages. Understanding this lifecycle is essential for anyone in a product owner or administrator role, because your job is not just to build features — it is to maintain the system's integrity through clear acceptance criteria, safe schema changes, and disciplined delivery practices.

Work begins in the PROPOSED stage, where a task description is written that explains the problem, the solution, what done looks like, and what is explicitly out of scope. A proposed task is not approved for development until the done criteria are specific and testable. Vague done criteria — "the feature should work" or "improve the UI" — are not acceptable. Every task must describe a measurable outcome.

Once approved, work moves to IN PROGRESS. During this stage, the developer writes code, updates the schema if needed, and adds any required seed data. Schema changes follow a strict policy: the single source of truth for the database schema is shared/schema.ts. Any new table or column must be declared there first, and the change is applied to the database using drizzle-kit push. Never create columns in startup ensure blocks that are not also in schema.ts — drizzle-kit will treat them as orphans and try to delete them on the next push, which causes data loss.

When development is complete, the task moves to MERGED, which in this system means the changes have been committed and the platform has been rebuilt. At this point, the post-merge script runs automatically. This script performs a schema drift check before applying any pending database changes, and aborts if it detects a destructive operation (dropping a column, renaming a table) that was not explicitly planned.

The definition of done on this team means: the feature works end-to-end, it handles error cases gracefully, it has no silent fallbacks that hide failures, it does not break any of the five critical path flows, and it has been tested manually by the developer before being marked complete.`,
        quiz: {
          questions: [
            {
              questionText: "What is the correct way to add a new database column to the Hire'in platform?",
              explanation: "The schema in shared/schema.ts is the single source of truth. Columns declared there are applied to the database via drizzle-kit push. Startup ensure blocks are for idempotent backfills and seeds only — not for owning columns that schema.ts doesn't know about.",
              options: [
                { text: "Write a raw SQL ALTER TABLE statement in an ensure block in server/index.ts, without updating shared/schema.ts", isCorrect: false },
                { text: "Declare the column in shared/schema.ts first, then apply it via npm run db:push", isCorrect: true },
                { text: "Create a migration file in the migrations/ directory and run it manually against the database", isCorrect: false },
                { text: "Add the column directly in the production database using a database client, then update schema.ts afterwards", isCorrect: false },
              ],
            },
            {
              questionText: "At what stage does the post-merge script perform its schema drift check?",
              explanation: "The post-merge script runs automatically when a task moves to MERGED (the changes are committed and the platform is rebuilt). It performs the drift check before applying any pending db:push, and aborts if it detects a destructive change.",
              options: [
                { text: "During the PROPOSED stage, before development begins", isCorrect: false },
                { text: "During IN PROGRESS, every time the developer saves a schema file", isCorrect: false },
                { text: "When the task moves to MERGED — the post-merge script runs automatically", isCorrect: true },
                { text: "In production only, the first time the server restarts after deployment", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Writing Acceptance Criteria",
        body: `Acceptance criteria are the contract between the person requesting a feature and the person building it. Well-written criteria eliminate ambiguity, prevent scope creep, and make testing straightforward. On this team, we use a format inspired by Gherkin — the Given-When-Then structure — because it forces the writer to think through the user's perspective, the triggering action, and the expected outcome separately.

A well-formed criterion looks like this: "Given an active employee with an EL balance of 3 days, when they submit a leave request for 4 days of Earned Leave, then the system should reject the request and display the message 'Insufficient leave balance' without creating a leave request record in the database." This is testable. A tester can set up the precondition (an employee with exactly 3 days of EL), perform the action (submit a 4-day leave request), and verify the outcome (rejection message shown, no database record created) without any ambiguity about what success looks like.

A weak criterion would be: "Leave requests should be validated." This is not testable. It does not specify what validation means, what the error message should say, whether the record should be created and then rolled back or never created at all, or what the user sees.

Every acceptance criterion should be independent and atomic — it tests exactly one behaviour. If you find yourself using "and" in the outcome clause, consider splitting into two criteria.

For UI changes, always include a criterion for the error state, not just the success state. For data changes, always include a criterion specifying what should and should not be written to the database. For email flows, always specify the trigger condition, the recipient, and at least one field in the email subject or body.

Criteria that reference specific UI text, error codes, or status values are better than criteria that describe behaviour in general terms. Specific criteria can be automated later; general criteria cannot.`,
        quiz: null,
      },
      {
        title: "Backlog Orientation",
        body: `As a platform administrator or product owner, you have visibility into the full backlog of proposed and in-progress work. Understanding how to read and prioritise the backlog is a core part of your role.

The backlog is organised around three horizons: Now (the current sprint or active work), Next (ready-to-start work that is fully specified and unblocked), and Later (ideas, research items, or work that has dependencies that are not yet resolved). Items in the Now horizon should have complete acceptance criteria and should be actively being worked on. Items in the Next horizon should be fully described but waiting for capacity. Items in the Later horizon may still need scoping, research, or decisions before they can move forward.

Within each horizon, work is prioritised by impact on the five critical path flows first, then by the number of users affected, then by business value, and finally by implementation complexity. A fix to the payroll calculation engine jumps every queue. A cosmetic improvement to the executive dashboard waits its turn.

When you receive a new feature request — from a team member, from a client, or from your own observations — the first step is to write it up as a proposed task with a clear problem statement, a proposed solution, and measurable done criteria. Do not start building before this is done. Informal requests that bypass the task system create undocumented changes that are impossible to track, test, or roll back.

The platform also maintains a set of known constraints that affect how work is planned. The TypeScript compiler (tsc) is not a build gate on this project — there are pre-existing type errors that do not prevent the application from running, because the build uses tsx and esbuild directly. This means a clean tsc run is not a sign-off condition. The actual sign-off condition is a passing manual smoke test of the affected feature and no regressions in the five critical flows.`,
        quiz: null,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRACK 3 — QA Engineer Onboarding (admin)
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: "QA Engineer Onboarding",
    description: "Test coverage, critical paths, bug classification, and known environment constraints for QA engineers.",
    isUniversal: false,
    isPolicyTrack: false,
    status: "published",
    targetRole: "_rules_only",
    roles: ["admin"],
    sections: [
      {
        title: "Product Scope for QA",
        body: `Quality assurance on the Hire'in platform requires a precise understanding of what the system does, who uses it, and what a regression means in this context. Unlike a consumer app where a broken feature means a frustrated user, a broken feature here can mean an employee not getting paid correctly, a candidate's offer letter becoming invalid, or an HR letter failing public verification. The stakes are high, and QA must be prioritised accordingly.

The platform serves nine distinct roles: super_admin, admin, hr, finance, operations, manager, recruiter, employee, and executive. Each role has a different set of features available to it, and a regression may affect one role but not others. When you receive a bug report or plan a test pass, always identify which role or roles are affected. A change to the leave approval workflow, for example, must be tested from both the employee perspective (submitting the request) and the manager perspective (receiving and acting on the notification).

A regression on this platform is any change in behaviour that breaks a previously working feature. This includes: a feature that now shows an error where it previously succeeded, a feature that now silently does nothing where it previously worked, a calculation that now produces a wrong number, a UI element that is no longer rendered, or a permission check that now grants or denies access incorrectly. Regressions in the five critical path flows (payroll, offer letters, leave, attendance, HR letter verification) are always P0 regardless of how small the code change appears to be.

The platform's primary personas map to its modules. Employees are primarily users of My Desk, the Attendance tab, the Leaves tab, and My Training. Managers are primarily users of My Team and leave approvals. HR uses People and HR, New Hire, and HR Tools. Finance uses the Payroll module. Recruiters and operations use the Recruitment and New Hire modules. Understanding these personas helps you prioritise your test coverage: spend the most time on the highest-traffic paths for the most common roles.`,
        quiz: null,
      },
      {
        title: "Existing Test Coverage and How to Run Tests",
        body: `The backend of the Hire'in platform has a test suite built using Node.js's built-in test runner (node:test). This is important to know because the project also has a frontend toolchain that includes Vitest, and if you run tests using the wrong command, you will either get no results or you will be running the wrong tests.

To run backend tests, use the command: npx tsx --test. Do not use npx vitest, which is configured for the frontend and will not pick up the backend test files correctly. The backend tests live in files that match the pattern *.test.ts and are located alongside their source files in the server directory.

Current test coverage focuses on the most algorithmically complex parts of the system: the leave accrual engine (which handles EL and SL monthly accrual, minimum hours checks, year-end carry-forward, and lapse calculations), the payroll computation engine (which calculates gross pay, statutory deductions including PF, PT, ESI, and TDS, and net payable amounts), and selected API route handlers for authentication and leave management.

What is not currently covered by automated tests: the offer letter PDF generation flow, the HR letter e-sign and verification flow, the attendance sweep cron job, the email notification dispatch system, and most UI-level interactions. These areas rely on manual testing to catch regressions.

When a new feature is added, the developer is responsible for identifying whether the new code path is covered by existing tests or requires new tests. If the feature introduces new business logic — a new calculation, a new state machine, a new validation rule — a test should be added before the feature is marked complete. If the feature is purely a UI change with no new business logic, a manual smoke test is sufficient.

The TypeScript compiler is not used as a build gate. The build process uses tsx and esbuild directly, so tsc errors do not prevent the application from starting. Do not use a clean tsc compilation as evidence that the code is correct — use the running application and the test suite instead.`,
        quiz: {
          questions: [
            {
              questionText: "What command should you use to run the backend test suite on the Hire'in platform?",
              explanation: "The backend tests use node:test and must be run with `npx tsx --test`. Using `npx vitest` will pick up the frontend Vitest configuration and will not execute the backend test files correctly.",
              options: [
                { text: "npx vitest", isCorrect: false },
                { text: "npm test", isCorrect: false },
                { text: "npx tsx --test", isCorrect: true },
                { text: "npx ts-node --test", isCorrect: false },
              ],
            },
            {
              questionText: "Which of the following is currently covered by automated backend tests?",
              explanation: "The automated test suite covers the leave accrual engine, the payroll computation engine, and selected route handlers. The offer letter PDF generation, e-sign flow, attendance sweep cron, and email dispatch are all covered by manual testing only.",
              options: [
                { text: "The offer letter PDF generation flow", isCorrect: false },
                { text: "The HR letter e-sign and /verify endpoint", isCorrect: false },
                { text: "The leave accrual engine and payroll computation engine", isCorrect: true },
                { text: "The attendance sweep cron job", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "The Five Critical Path Flows",
        body: `Every release must be manually smoke-tested against the five critical path flows before it is considered safe to ship. These flows must work end-to-end. A passing test of a component in isolation is not sufficient — you must verify the complete path from user action to database write to UI feedback.

Flow 1 — Payroll Processing. Starting point: an active employee with a salary structure assigned. Steps: HR navigates to the Payroll module and initiates a salary run for the current month. The system computes gross pay based on the salary structure, applies statutory deductions (PF at the employee's rate, Professional Tax based on the employee's state, ESI if the gross is below the threshold, TDS if applicable), applies any LOP deductions for unpaid leave days, applies any salary advance recovery for the month, and produces a net payable amount. The salary slip is generated and can be downloaded as a PDF. Data written: a salary run record, a salary slip record with the components JSONB, and a computation snapshot. Verification: the net payable in the PDF matches the sum in the database.

Flow 2 — Offer Letter Generation and Signing. Starting point: a candidate record exists, and a manager or operations user is logged in. Steps: the user generates an offer letter from the New Hire section, fills in the candidate's details and compensation, and submits for approval. HR or Admin approves and counter-signs. The candidate receives a link to accept. The candidate reviews and accepts, which records a cryptographic hash of the document content. Verification: the offer letter status is 'accepted', the hash is stored, and the letter appears in the New Hire dashboard.

Flow 3 — Leave Request and Approval. Starting point: an employee is logged in with a non-zero leave balance. Steps: the employee submits a leave request from the Leaves tab. The manager receives an in-app notification. The manager approves or rejects the request. The employee's leave balance is updated if approved. Data written: a leave request record with status 'approved', and a deduction from the leave balance. Verification: the balance before minus the days approved equals the balance after.

Flow 4 — Attendance Recording. Starting point: an employee is logged in and has not yet punched in today. Steps: the employee clicks Punch In on the Attendance tab. The punch-in timestamp is recorded. Later, the employee clicks Punch Out. The total hours are calculated. Verification: the attendance record for today shows both timestamps and a positive total_hours value.

Flow 5 — HR Letter Verification. Starting point: an HR letter has been issued with a reference number and an auth code. Steps: a user (who may not be logged in) navigates to the public /verify page, enters the reference number and auth code, and submits. The system looks up the letter and returns its details including the employee name, letter type, and issue date. Verification: the returned details match the letter in the database.`,
        quiz: {
          questions: [
            {
              questionText: "Which data must be written to the database after a successful leave approval?",
              explanation: "A leave approval must both update the leave request status to 'approved' AND deduct the approved days from the employee's leave balance. Missing either write means the system is in an inconsistent state.",
              options: [
                { text: "Only the leave request status is updated to 'approved'", isCorrect: false },
                { text: "The leave request status is updated to 'approved' AND the employee's leave balance is reduced by the approved days", isCorrect: true },
                { text: "A new leave balance record is created; the original is not modified", isCorrect: false },
                { text: "An audit log entry is created; no changes are made to the leave request or balance until payroll runs", isCorrect: false },
              ],
            },
            {
              questionText: "What is the starting verification point to confirm a payroll flow worked correctly end-to-end?",
              explanation: "The net payable figure in the generated PDF salary slip must match the net payable figure stored in the database salary slip record. This confirms the computation, storage, and PDF generation all agreed on the same number.",
              options: [
                { text: "The salary run status changes from draft to sent", isCorrect: false },
                { text: "The employee receives an in-app notification that their slip is ready", isCorrect: false },
                { text: "The net payable in the PDF matches the net payable stored in the database salary slip record", isCorrect: true },
                { text: "No deductions appear for employees below the PF wage ceiling", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Bug Severity Classification",
        body: `Every bug reported on this platform must be classified by severity before it is prioritised. Using a consistent classification system ensures that P0 issues are fixed immediately, P1 issues are fixed within the current sprint, and P2 and P3 issues are scheduled based on their impact.

P0 — Critical. A P0 bug is a complete blocker that causes data loss, financial miscalculation, security bypass, or total unavailability of a critical path flow. P0 bugs require immediate response regardless of time of day or sprint status. Examples: the punch in button records no data to the database, the payroll engine calculates incorrect PF deductions for a subset of employees, a user with the employee role can access the HR Tools module that should be restricted to HR and above, the /verify public page returns a 500 error for all valid reference numbers.

P1 — High. A P1 bug significantly degrades a critical path flow but does not cause data loss or financial error. Work can continue but with friction. P1 bugs should be fixed within the current sprint. Examples: the leave balance display shows the wrong number in the UI but the database value is correct, the offer letter PDF renders with a missing field but the data is stored correctly, in-app notifications are not being sent but email notifications still work, the punch out button is missing on mobile browsers but works on desktop.

P2 — Medium. A P2 bug affects a non-critical flow or produces a cosmetic problem that does not impact data accuracy. Examples: a chart in the executive cockpit shows data from the wrong time period, the attendance calendar highlights the wrong days as weekends for a minority of date ranges, the salary slip PDF uses the wrong font on a particular browser.

P3 — Low. A P3 bug is a minor cosmetic or UX issue with no functional impact. Examples: a button label has a typo, a tooltip appears in the wrong position, a loading spinner is shown for an extra 200ms.

When filing a bug report, include: the severity classification, the steps to reproduce starting from a logged-out state, the expected result, the actual result, the role used during reproduction, and any relevant database state (e.g. the employee ID, the date, the leave type). A bug report without reproduction steps is not actionable and will be returned for more information.`,
        quiz: {
          questions: [
            {
              questionText: "A bug is reported: the payroll engine calculates a slightly incorrect PF deduction for employees earning above ₹15,000 per month. What severity is this?",
              explanation: "Any financial miscalculation is P0. It directly affects employees' livelihoods, creates legal liability, and requires immediate correction regardless of the magnitude of the error.",
              options: [
                { text: "P3 — Low, because the error is small and only affects a subset of employees", isCorrect: false },
                { text: "P2 — Medium, because PF deductions are handled by the payroll run and can be corrected in the next cycle", isCorrect: false },
                { text: "P1 — High, because it degrades the payroll flow but does not prevent salary slips from generating", isCorrect: false },
                { text: "P0 — Critical, because any financial miscalculation is an immediate emergency", isCorrect: true },
              ],
            },
            {
              questionText: "An employee with the 'employee' role can view the HR Tools letter generator, which should only be accessible to hr and above. What severity is this?",
              explanation: "A permission check that grants access to a restricted module is a P0 — it is a security bypass that could allow an employee to issue fraudulent official HR letters. This takes precedence over any functional severity consideration.",
              options: [
                { text: "P2 — Medium, because the employee cannot actually issue letters without an HR signature", isCorrect: false },
                { text: "P1 — High, because the module is visible but some actions within it are still restricted", isCorrect: false },
                { text: "P0 — Critical, because it is a security bypass granting unauthorized access to a restricted module", isCorrect: true },
                { text: "P3 — Low, because UI visibility without functional access is cosmetic", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Manual Smoke Test Checklist",
        body: `Before every significant release, the QA engineer or developer must complete a manual smoke test of all P0 and P1 features. This checklist is the minimum — it does not replace full regression testing for large changes, but it ensures the most critical paths have not been accidentally broken.

P0 Smoke Tests. Authentication: log in as an employee, verify 2FA is required, verify the 30-minute session timeout warning appears. Punch in/out: as an employee, punch in and verify a record appears in the database with a timestamp; punch out and verify total_hours is calculated. Leave request and approval: submit a leave request as an employee, approve it as a manager, verify the balance decrements. Payroll run: initiate a payroll run for a test employee, verify the salary slip is generated with correct gross pay and at least one deduction. Offer letter: generate an offer letter, approve it as HR, verify the candidate acceptance link works and records the document hash. HR letter verification: issue an HR letter, note the reference number and auth code, verify them on the public /verify page.

P1 Smoke Tests. In-app notifications: perform an action that triggers a notification (e.g., approve a leave request) and verify the notification bell updates for the recipient. Training assignment: verify a new user gets automatically assigned the universal training track. Break tracking: punch in as an employee, start a Lunch break, verify the timer starts and the duration is recorded. My Team view: as a manager, verify that only your direct reports appear in the team attendance view and not other employees. Feature flag toggle: toggle a non-critical feature flag off and on in settings, verify the feature disappears and reappears in the UI.

For each test, record the pass/fail result, the date tested, and the role used. If any P0 test fails, stop the release immediately and raise a P0 bug ticket. The release cannot proceed until all P0 tests pass.`,
        quiz: null,
      },
      {
        title: "Known Constraints and Environment Quirks",
        body: `Every platform has quirks that are not documented in the user-facing features but that matter deeply when you are testing and debugging. This section documents the known constraints on the Hire'in platform that a QA engineer needs to understand to work effectively.

TypeScript compilation is not a build gate. The tsc compiler will report hundreds of pre-existing type errors, but the application builds and runs correctly because it uses tsx and esbuild, which strip types without enforcing them. Do not use a clean tsc compilation as evidence that code is correct or that a bug is not present. Always test the running application.

The backend development server does not watch for file changes automatically. If a backend route is added or changed, the server must be restarted for the change to take effect. If you make a backend change and the API still returns the old response (or returns the HTML of the SPA instead of JSON), restart the workflow. Frontend changes hot-reload automatically via Vite.

Drizzle-kit push requires an interactive terminal and presents arrow-key prompts for any ambiguous schema changes. It cannot be piped or run in a non-TTY environment. When new tables or columns are needed during a test environment setup, use the raw SQL scripts in the scripts/ directory rather than trying to pipe drizzle-kit. If you see a drizzle-kit prompt asking whether a column was created or renamed, always answer that it was created — answering "renamed" is data-destructive.

The database schema drift guard (scripts/check-schema-drift.sh) is registered as a validation step. Running it will flag any column or table that exists in the live database but not in shared/schema.ts, or vice versa. Run this before testing any schema-related change.

Leave accrual runs on the first day of each month via a scheduled cron job. Testing accrual behaviour requires either waiting for the cron to fire or manually calling the accrual endpoint in a test environment. Do not test accrual logic by checking the UI on arbitrary dates — always check the database directly.

Session cookies use rolling expiry with a 30-minute window. If a test involves waiting more than 30 minutes between actions, you will be logged out. Design test scenarios to complete within the session window or plan for the re-authentication step.`,
        quiz: null,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRACK 4 — HR Team Onboarding (hr)
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: "HR Team Onboarding",
    description: "Complete HR operations guide — leave management, letters, new hire pipeline, exit management, and compliance.",
    isUniversal: false,
    isPolicyTrack: false,
    status: "published",
    targetRole: "_rules_only",
    roles: ["hr"],
    sections: [
      {
        title: "HR Module Overview",
        body: `The HR function on the Hire'in platform is supported by a comprehensive set of tools that cover the full employee lifecycle from offer acceptance through to exit. As an HR team member, your primary workspace is the People and HR section of the admin portal, but you will also work regularly in New Hire, HR Tools, and the Payroll module in coordination with Finance.

The People and HR section contains the employee directory, which is your master list of all users in the system. From here you can view employee profiles, manage department assignments, adjust designations, and trigger administrative actions such as soft-deleting a departed employee. The directory shows both active and inactive employees, and you can filter by department, role, or employment status to find who you need quickly.

The Attendance section in People and HR gives you a bird's-eye view of the team's attendance for any given day or date range. You can see who is present, who is absent, who is on leave, and who has pending leave requests that need action. The attendance data feeds directly into the payroll run at month end, so accuracy here matters financially.

The Leave Management section is where you will spend significant time. From here you can see all pending leave requests across the organisation (not just your direct reports — you have visibility across all employees). You can approve, reject, or request more information on any request. You can also make manual balance adjustments if an employee's balance needs to be corrected due to a data entry error or a special circumstance approved by management.

The New Hire section is your window into the pre-employment pipeline. It shows the status of every candidate who has received an offer letter, tracks their progress through the onboarding checklist, and alerts you to any blockers (missing documents, incomplete bank details, unsigned consents) that need to be resolved before the employee's first working day.

HR Tools contains the letter generators — both the standard template letters (Experience, Internship, Relieving) and the Amendment Letters (Salary Revision, Designation/Promotion, Combined, and Device Allocation). All letters issued through these tools are verifiable via the public /verify page using a reference number and auth code.`,
        quiz: null,
      },
      {
        title: "Leave Management Deep-Dive",
        body: `Leave management on this platform is governed by a rules engine that handles two main leave types: Earned Leave (EL) and Sick Leave (SL). Understanding the rules precisely matters because errors in leave management directly affect payroll through Loss of Pay (LOP) deductions.

Earned Leave accrues at a rate designed to give 15 days per year. Accrual happens on the first working day of each month and is conditional — an employee only receives their monthly EL accrual if they worked a minimum number of hours in the preceding month. This minimum hours threshold is configurable per leave type in the system settings. If an employee did not meet the threshold (for example, because they took extended unpaid leave), they do not receive the accrual for that month. The accrual engine also handles bonus months, where certain months trigger an additional accrual. At year end, a batch process carries forward any unused EL (up to the configured carry-forward cap) and lapses the rest.

Sick Leave accrues unconditionally at a rate designed to give 8 days per year. There is no minimum hours threshold for SL accrual — the only requirement is that the employee has been employed for at least 30 days. SL does not carry forward at year end.

Leave Without Pay (LWP) is what happens when an employee takes more leave than their available balance allows. The system gates LWP at the application point — if an employee tries to apply for 5 days of EL but only has 3 days available, the system will not automatically split the request. The employee must either apply for fewer days or accept that part of the request will be LWP. When a request results in LWP days, those days are tracked as splitLwpDays on the leave request record and fed into the payroll calculation as LOP.

Weekends and public holidays are automatically excluded from leave day counts. A leave request from Friday to Monday counts as 1 day (Friday only, assuming Saturday and Sunday are non-working days and the Monday is not a holiday). Regional optional holidays are handled separately — employees can select which optional holidays they observe, and these are factored into leave calculations individually.

When an employee's leave request creates LOP and the payroll run has already started, coordinate with Finance before making any manual adjustments. Changes to leave balances after the payroll cut-off date may not be reflected in the current month's salary and will need to be corrected in the following run.`,
        quiz: {
          questions: [
            {
              questionText: "What is the key difference between Earned Leave and Sick Leave accrual on this platform?",
              explanation: "EL accrual is conditional — the employee must meet a minimum hours-worked threshold in the preceding month. SL accrual is unconditional — it accrues every month as long as the employee has been employed for 30 or more days.",
              options: [
                { text: "EL accrues monthly, SL accrues annually", isCorrect: false },
                { text: "EL gives 15 days per year, SL gives 15 days per year — the only difference is carry-forward rules", isCorrect: false },
                { text: "EL accrual requires a minimum hours threshold to be met; SL accrual is unconditional", isCorrect: true },
                { text: "EL can be taken in half-day increments, SL can only be taken in full days", isCorrect: false },
              ],
            },
            {
              questionText: "How many Earned Leave days per year does the accrual engine target?",
              explanation: "The EL accrual engine is designed to credit 15 days of Earned Leave per year. SL targets 8 days per year. Both are conditional on the respective qualification rules — EL on minimum hours, SL on minimum 30 days of employment.",
              options: [
                { text: "12 days per year — 1 day per month", isCorrect: false },
                { text: "15 days per year", isCorrect: true },
                { text: "18 days per year — 1.5 days per month", isCorrect: false },
                { text: "10 days per year plus 5 carry-forward days", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Letters and Documents",
        body: `The HR letter system on this platform covers four standard template letter types — Experience Letters, Internship Completion Certificates, Internship Certificates, and Relieving Letters — plus five amendment letter types: Salary Revision, Designation/Promotion, Combined (salary and designation), and Device Allocation.

All letters are generated from the HR Tools section of the admin portal. For template letters, you select the letter type, choose the employee (from the system picker or by entering details manually for former employees not in the system), fill in the relevant fields (designation, dates, performance band, conduct band), and generate the letter. The system produces a DOCX file using the document engine and assigns a unique reference number and auth code. Once you click Issue, the letter is locked and the reference number and auth code are written to the database.

The public /verify page at the platform's URL allows anyone — a bank, a background check agency, a future employer — to enter the reference number and auth code and confirm the letter's authenticity. The verification response shows the employee name, letter type, issue date, and key fields. It does not show the full letter text to external parties.

Offer Letters have a specific approval chain that differs from HR letters. A manager or operations user generates the offer letter from the New Hire section. It goes to HR and Admin for review and approval. Once approved, HR counter-signs the letter using the e-sign flow. The counter-signature records a cryptographic hash of the document content, so any tampering after signing is detectable. The candidate then receives an email with a link to accept the offer. Their acceptance is also hashed. If a candidate's name changes after the letter is issued, the system flags the letter with a warning badge to alert HR that the letter may need to be re-issued.

Amendment letters follow a similar flow through the addendum engine. They can optionally be delivered by email to the employee directly from the HR Tools interface. All amendment letters are verifiable on the public /verify page using the same reference number and auth code system.

Important: never issue a letter containing incorrect information and plan to correct it verbally. If a letter has incorrect information, revoke the issued letter (which marks it as revoked in the system and removes it from verification), correct the details, and re-issue. The re-issue process creates a new reference number and records the reissue reason in the audit trail.`,
        quiz: {
          questions: [
            {
              questionText: "What should you do if a letter was issued with incorrect information?",
              explanation: "The correct process is to revoke the original letter (which removes it from verification and marks it in the audit trail), correct the details, and re-issue a new letter with a new reference number. Issuing a verbal correction without revoking the original leaves an incorrect verifiable document in the system.",
              options: [
                { text: "Edit the letter details in the system and regenerate the PDF without revoking the original", isCorrect: false },
                { text: "Revoke the issued letter, correct the details, and re-issue with a new reference number", isCorrect: true },
                { text: "Contact the candidate or external party directly to explain the error; no system change is needed", isCorrect: false },
                { text: "Delete the letter record from the database and generate a new one from scratch", isCorrect: false },
              ],
            },
            {
              questionText: "What information does the /verify page show to an external party (such as a bank or background check agency)?",
              explanation: "The /verify endpoint shows the employee name, letter type, issue date, and key fields from the letter. It deliberately does not show the full letter text to external parties — only enough to confirm authenticity.",
              options: [
                { text: "The full letter text including all salary and designation details", isCorrect: false },
                { text: "The employee name, letter type, issue date, and key fields — but not the full letter text", isCorrect: true },
                { text: "Only a 'valid' or 'invalid' status with no additional information", isCorrect: false },
                { text: "The letter PDF download link, allowing external parties to download the full document", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "New Hire Pipeline",
        body: `The New Hire section gives you visibility into every candidate who is in the pre-employment pipeline — from the point their offer letter is generated through to the point they are fully onboarded. The section has three tabs: Offer Letters, Onboarding, and Users.

The Onboarding tab is your daily operational tool. It shows a table of all employees who joined within the last 90 days, plus any employees whose joining date has not yet been set (which indicates they accepted an offer but have not started yet). For each employee, the table shows their onboarding checklist completion percentage, how many documents they have uploaded, whether their bank details are filled in, and whether they have provided their night-shift consent if applicable.

The onboarding checklist is a structured sequence of tasks the new hire must complete before their onboarding is considered done. It includes: completing their profile (uploading a photo, adding their LinkedIn URL), submitting their identity documents (Aadhaar, PAN, passport if applicable), providing their emergency contact, filling in their bank account details for payroll, acknowledging the required policy documents, and completing their assigned training tracks. The checklist is computed from multiple sources in the system and shown as a percentage.

As an HR team member, your role in the new hire pipeline is to monitor blockers and prompt resolution. If a new hire has been in the system for more than two weeks and their document completion is below 50%, that is a signal to follow up. If bank details are missing and payroll is approaching, that is urgent. The system sends automated reminder emails when the document reminder flag is enabled — check the feature flags in settings to ensure this is turned on.

The 90-day window in the Onboarding tab is a deliberate design choice. It means that employees who joined more than 90 days ago fall off the onboarding view, signalling that their onboarding period is complete. If you need to review a former new hire's onboarding status, you can access their full profile through the People and HR directory.

The Users tab in New Hire is the same user management panel that appears in People and HR. It is included in New Hire for convenience — so you can create accounts for incoming candidates without navigating away from the hiring workflow.`,
        quiz: null,
      },
      {
        title: "Exit Management",
        body: `When an employee leaves the organisation, the platform supports two distinct exit statuses that must be applied correctly: Relieved and Left Company. Choosing the wrong status has compliance implications and affects the type of letter that can be issued.

Relieved is used for involuntary departures — where the organisation has ended the employment relationship. This includes terminations for cause, restructuring, or any situation where the employee did not choose to leave. When you apply the Relieved status, the system makes the employee's account inactive and records the employment status change in the database. A Relieving Letter can then be issued from HR Tools, which formally documents the end of the employment relationship from the organisation's perspective.

Left Company is used for voluntary departures — where the employee chose to resign. This is the status to apply when an employee submits a resignation and works out their notice period (or when notice is waived). The Employment Exit section in the employee's profile allows you to record the last working day, the notice period status, and any special circumstances. A Relieving Letter or Experience Letter can be issued depending on what the employee needs for their next role.

Super Admin users have the ability to soft-delete employee accounts. Soft-delete is different from setting an exit status. Soft-delete marks the account with a deleted_at timestamp, which removes the employee from all active views, search results, and auto-assignment logic. However, the data is not physically deleted — it is retained for audit, payroll history, and letter verification purposes. Never hard-delete an employee record. If someone asks you to remove an employee from the system entirely, explain that soft-delete is the correct approach and that physical deletion would break historical salary slips and letter verification.

If an employee's name changes after a letter has been issued — for example, due to a marriage — the system will flag all previously issued letters with a warning badge when you view them. This is a reminder that the letter may need to be re-issued with the new name if the employee needs it for official purposes. The decision to re-issue is yours to make based on the employee's request and the purpose of the letter.`,
        quiz: {
          questions: [
            {
              questionText: "What is the correct exit status to apply when an employee chooses to resign and works out their notice period?",
              explanation: "'Left Company' is used for voluntary departures where the employee chose to leave. 'Relieved' is for involuntary departures initiated by the organisation. Using the wrong status creates incorrect records and may result in the wrong type of letter being issued.",
              options: [
                { text: "Relieved, because the employment relationship has ended regardless of who initiated it", isCorrect: false },
                { text: "Left Company, because the departure was voluntary", isCorrect: true },
                { text: "Soft-delete the account without setting an exit status", isCorrect: false },
                { text: "No status change is needed — just set is_active to false", isCorrect: false },
              ],
            },
            {
              questionText: "What happens to an employee record when it is soft-deleted?",
              explanation: "Soft-delete sets a deleted_at timestamp on the record, removing the employee from active views and auto-assignment logic. The data is retained for audit, payroll history, and letter verification — it is never physically deleted.",
              options: [
                { text: "The record is permanently removed from the database", isCorrect: false },
                { text: "A deleted_at timestamp is set and the record is hidden from active views but retained for audit and history", isCorrect: true },
                { text: "The record is anonymised — all personal data is replaced with placeholder values", isCorrect: false },
                { text: "The record is moved to an archive table separate from admin_users", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Compliance Touchpoints",
        body: `As an HR team member, you are responsible for ensuring the platform's compliance-sensitive features are properly configured before payroll close each month. This section describes the key compliance touchpoints and what to check at each one.

Feature flags that affect HR operations. The onboarding training flag determines whether the training compliance lock is active. When this flag is on, employees with overdue training assignments are prevented from accessing certain features until they complete their assignments. Before payroll close, verify that no active employees have been blocked by the compliance lock in a way that prevented them from completing required payroll-adjacent tasks (such as submitting expense claims or correcting attendance). If a legitimate blocker has occurred, you can grant a training exception for a specific employee from the Training management section.

The document reminder emails flag controls automated nudges to new hires with incomplete onboarding documents. Ensure this flag is on at all times during active onboarding periods. If you see a new hire approaching their first payroll cycle with missing bank details, follow up manually — the automated email may not have been received.

Leave balance accuracy before payroll. The last working day of the month is the cut-off for leave balance changes that affect the current payroll run. Any leave approval, rejection, or balance adjustment made after the payroll run has started will not automatically update the current month's salary. Coordinate the leave cut-off with Finance — ideally, all pending leave requests for the month should be actioned at least two business days before the payroll run begins.

Employment status accuracy. The payroll engine only processes employees with active status (employment_status = 'active' and deleted_at IS NULL). If an employee's last working day falls mid-month and they should be paid for part of the month, ensure their status is updated correctly before the payroll run. If a Relieved or Left Company employee appears in the payroll run, raise it with Finance immediately.

The audit trail. Every significant HR action — letter issuance, leave adjustment, profile change, exit status update — is recorded in the audit log. Before making any bulk change or manual correction, confirm with your manager or super admin. The audit trail is the evidence of what happened and why, and it cannot be retroactively altered.`,
        quiz: null,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRACK 5 — Finance Team Onboarding (finance)
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: "Finance Team Onboarding",
    description: "India statutory payroll engine, run lifecycle, salary advances, pay reporting, and contracts.",
    isUniversal: false,
    isPolicyTrack: false,
    status: "published",
    targetRole: "_rules_only",
    roles: ["finance"],
    sections: [
      {
        title: "India Statutory Payroll Engine",
        body: `The Hire'in payroll engine is a pure India statutory computation engine written in TypeScript. It computes salary components from a structured salary template and applies the relevant statutory deductions based on each employee's individual settings. Understanding what the engine computes — and critically, what it does not compute — is essential before you run payroll for the first time.

The engine computes the following components from the salary structure: Basic salary (the foundation, typically 40–50% of CTC), House Rent Allowance (HRA, typically 50% of Basic for metro cities or 40% for non-metro), and any other allowances defined in the employee's salary structure such as Transport, Special Allowance, or Variable Pay. The gross salary is the sum of all these components before any deductions.

Statutory deductions computed by the engine include: Employee Provident Fund (EPF) at 12% of Basic salary (subject to a monthly wage ceiling of ₹15,000 — employees earning a Basic above this threshold may be exempt if they were never previously PF members; this is configurable via the pfExempt flag on the employee record), Professional Tax (PT) as a slab-based deduction that varies by state (the employee's ptState field on their profile determines which slab table applies), Employee State Insurance (ESI) at 0.75% of gross salary for employees whose gross is below ₹21,000 per month (this threshold rises to ₹25,000 for employees with disabilities, controlled by the esiDisability flag), and Tax Deducted at Source (TDS) when applicable.

The engine does not compute: income tax projections for the full financial year (TDS is computed based on declared investments and projected income — this requires a separate module), employer-side EPF and ESI contributions (these are the company's cost and not deducted from employee salaries), gratuity accruals, or any state-specific labour welfare fund contributions beyond Professional Tax.

All monetary amounts within the engine are stored and computed in paise (the smallest Indian currency unit, equal to 1/100th of a rupee). This is a deliberate design choice to eliminate floating-point rounding errors that would otherwise compound across multiple deduction calculations. When you see amounts in the database, divide by 100 to get the rupee value.

An employee will not appear in the payroll computation unless they have a salary structure assigned to their profile. Employees without a salary structure are excluded from the run and will not have a salary slip generated. Check the employee directory before each run to ensure all active employees have a structure assigned.`,
        quiz: {
          questions: [
            {
              questionText: "What is the EPF wage ceiling used in the payroll engine, and what does it mean for high-earning employees?",
              explanation: "The EPF monthly wage ceiling is ₹15,000. Employees with a Basic salary above this threshold may be exempt from EPF contributions if they were never previously PF members. The pfExempt flag on the employee record controls this.",
              options: [
                { text: "₹25,000 — employees earning more are exempt from EPF automatically", isCorrect: false },
                { text: "₹15,000 — employees with Basic above this may be exempt if they were never previously PF members, controlled by the pfExempt flag", isCorrect: true },
                { text: "₹21,000 — the same threshold used for ESI eligibility", isCorrect: false },
                { text: "There is no ceiling — EPF is always 12% of the full Basic salary regardless of amount", isCorrect: false },
              ],
            },
            {
              questionText: "Why does the payroll engine store all monetary values in paise rather than rupees?",
              explanation: "Paise are the smallest unit of Indian currency (1/100th of a rupee). Using integers in paise eliminates floating-point rounding errors that would otherwise compound across multiple deduction calculations on fractional rupee amounts.",
              options: [
                { text: "RBI mandates that payroll software use paise as the base unit for statutory remittance calculations", isCorrect: false },
                { text: "To eliminate floating-point rounding errors that compound across multiple deduction calculations", isCorrect: true },
                { text: "The database only supports integer columns for monetary fields", isCorrect: false },
                { text: "To match the format required by the PF remittance portal's API", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Payroll Run Lifecycle",
        body: `The payroll run on the Hire'in platform follows a defined lifecycle with four stages: Draft, Review, Send, and Disburse. Each stage has specific actions, controls, and dependencies that must be completed before moving to the next.

Draft stage. A payroll run begins as a draft when Finance or HR initiates it for a specific month and year. In the draft stage, the system computes the payroll for all eligible employees (those with an active status, a salary structure assigned, and a non-zero salary). The computation pulls in the attendance data for the month — specifically the number of days present, days absent, approved leave days, and LOP days. It applies the salary engine to produce gross pay, statutory deductions, advance recovery amounts, and net payable. At this stage, the figures are provisional and can be recalculated if the underlying data changes.

Review stage. Once the draft computation looks correct, Finance moves the run to Review. In this stage, HR and Finance team members can examine the per-employee breakdowns, identify anomalies (employees with unusually high or low net pay, employees who appear to be missing from the run, employees whose deductions seem incorrect), and make corrections. Corrections at this stage require modifying the underlying source data (leave balances, attendance records, salary structure assignments) and then regenerating the run. The run cannot be directly edited — it must be recalculated from source.

Send stage. The Send stage corresponds to the generation and distribution of salary slips. When Finance sends the payroll, each employee's salary slip is generated as a PDF and made available in the employee's My Desk view. Employees are notified via in-app notification and email. Once slips are sent, the run is locked for editing. The attendance report underlying the run is also locked at this point and marked with a notified_at timestamp.

Disburse stage. After salaries are physically transferred to employee bank accounts (outside the platform — the platform does not initiate bank transfers), Finance marks the run as disbursed. This final status triggers any salary advance recovery bookkeeping for the month. The run's payroll lock ensures that no further changes can be made to the slip data after disbursement.

Critical dependency: the payroll run depends on a finalized attendance report for the month. The attendance report must be generated and marked as complete before the payroll run can be considered accurate. If attendance data is still being corrected (punch corrections, leave approvals pending), delay the run until those corrections are done.`,
        quiz: {
          questions: [
            {
              questionText: "At which payroll run stage do employee salary slips become visible to employees and get locked for editing?",
              explanation: "Salary slips are generated and distributed during the Send stage. At this point, the run is locked — no further edits can be made to the slip data. The subsequent Disburse stage records that the actual bank transfers have been made.",
              options: [
                { text: "Draft — slips are generated immediately when the run is created", isCorrect: false },
                { text: "Review — slips are shown to Finance for approval before being sent to employees", isCorrect: false },
                { text: "Send — slips are generated, made visible to employees, and the run is locked", isCorrect: true },
                { text: "Disburse — slips are generated only after bank transfers are confirmed", isCorrect: false },
              ],
            },
            {
              questionText: "What is the critical data dependency that must be resolved before a payroll run can be considered accurate?",
              explanation: "The payroll run pulls attendance data (days present, LOP days, etc.) from the attendance report. If attendance data is still being corrected — punch corrections pending, leave approvals outstanding — the run will be computed on incomplete data.",
              options: [
                { text: "All salary structure assignments must be reviewed by HR each month", isCorrect: false },
                { text: "A finalized attendance report for the month must be completed before the run", isCorrect: true },
                { text: "All ESI remittances from the previous month must be confirmed as received", isCorrect: false },
                { text: "The salary advance recovery schedule must be approved by the Finance manager", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Salary Advances",
        body: `The salary advance system on the platform allows employees to request advances against their future salary, and allows Finance and HR to record advances and overpayments directly without going through the employee request flow. Understanding both paths is important because they coexist in the same system.

The employee self-service path. When the salary_advance_enabled feature flag is on, employees can submit a salary advance request from My Desk. They specify the amount and the number of months over which they want the recovery spread. The request goes to their manager for approval, then to Finance for final authorisation and disbursement. Once disbursed, the advance is recorded with a repayment schedule, and the recovery engine deducts the instalment amount from each subsequent month's salary run.

The manual recording path for super_admin, admin, and HR. Even when the self-service flag is off, authorised users can record advances directly from the Active Advances section by clicking "Record for Employee." This bypasses the request-approval flow. There are two types of manual recording: a backfilled advance (where you pick an amount, a number of repayment months, and the start month for recovery) and an overpayment (where the full overpayment amount is recovered in the next payroll cycle, with any remainder carrying forward). Both types are created with a disbursed status, which means the recovery engine will immediately begin processing them in the next eligible payroll run.

The recovery engine. At payroll run time, the engine looks at all active (disbursed) advances for each employee and calculates the recovery amount for the current month. It applies the instalment amount up to the employee's available net pay for the month. If the net pay is insufficient to cover the full instalment, a partial recovery is made and the shortfall carries forward to the next month. The engine processes advances oldest-first. The outstanding balance on each advance decreases with each recovery until it reaches zero, at which point the advance is automatically marked as fully recovered.

When reviewing a payroll run in the Review stage, check the advance recovery column for each employee. If an employee's recovery amount seems wrong, verify their active advances in the salary advance section and confirm that the recovery month and instalment amount are configured correctly.`,
        quiz: {
          questions: [
            {
              questionText: "What happens if an employee's net pay in a given month is insufficient to cover their full salary advance instalment?",
              explanation: "The recovery engine applies a partial recovery up to the available net pay and carries the shortfall forward to the next month. It does not reduce the instalment amount permanently — the outstanding balance simply takes longer to clear.",
              options: [
                { text: "The advance is cancelled and the remaining balance is written off", isCorrect: false },
                { text: "A partial recovery is made up to the available net pay, and the shortfall carries forward to the next month", isCorrect: true },
                { text: "The full instalment is deducted and the employee's net pay goes negative for that month", isCorrect: false },
                { text: "The recovery is skipped entirely for that month and the original repayment schedule is extended by one month", isCorrect: false },
              ],
            },
            {
              questionText: "What is the difference between a 'backfilled advance' and an 'overpayment' in the manual recording tool?",
              explanation: "A backfilled advance is recovered over multiple months with a configurable instalment amount and start month. An overpayment is recovered in full in the next payroll cycle, with any remainder carrying forward if net pay is insufficient.",
              options: [
                { text: "A backfilled advance requires employee approval; an overpayment does not", isCorrect: false },
                { text: "A backfilled advance is spread over multiple repayment months with a configured start; an overpayment is recovered in full in the next cycle", isCorrect: true },
                { text: "A backfilled advance applies to past salary periods; an overpayment applies only to the current month", isCorrect: false },
                { text: "There is no functional difference — both are recorded identically and recovered by the same engine path", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Pay Report Dashboard",
        body: `The pay report dashboard provides an aggregated view of the payroll run results for Finance and HR. It is the primary tool for reviewing the overall cost of the payroll before distributing salary slips and for identifying employees whose pay differs significantly from previous months.

The dashboard shows total gross pay, total deductions (broken down by PF, PT, ESI, and TDS), total net payable across all employees, and the total LOP deductions for the month. The LOP figure is particularly important because it represents the financial impact of absent days — both unapproved absences and approved leave without pay. A high LOP total in a given month may indicate attendance data quality issues or a period with significant unapproved absenteeism.

The LOP versus paid leave breakdown on individual salary slips shows employees exactly how their leave affected their pay. A slip shows the number of LOP days (days deducted from pay) separately from the number of approved paid leave days (days covered by the leave balance, with no pay impact). This distinction is frequently a source of employee queries — an employee who had leave approved may still see an LOP deduction if their leave balance ran out before all the days were covered.

Summary figures on the dashboard are computed from the salary run records, not from live database queries. This means the dashboard always reflects the state of the run at the time it was locked, not any changes made to the underlying data afterwards. If an attendance correction is made after the run is locked, it will be reflected in the next month's run, not the current one.

When presenting payroll summaries to senior management or board members, use the figures from the locked run rather than live database queries. The locked run figures are the authoritative record of what was paid, and any discrepancy between them and live attendance data represents a timing difference that will be corrected in a future run.`,
        quiz: null,
      },
      {
        title: "Contracts and Finance",
        body: `Beyond employee payroll, the Finance function on the Hire'in platform encompasses client contract management, invoice tracking, and the executive-level financial visibility provided by the Executive Cockpit.

Client contracts on the platform are managed through a client registry that stores the master details of each client relationship: client name, industry vertical, key contacts, and the contract documents (Master Service Agreements and Statements of Work). The contract documents are stored in the platform's object storage and linked to the client record. Each contract has a status (active, expired, or pending renewal) and tracks the key dates (start date, end date, renewal notice date) so Finance can proactively manage renewals.

Invoice tracking is linked to the client and contract records. Each invoice records the billing period, the amount, the status (draft, sent, paid, overdue), and any payment references. The system does not initiate invoice delivery or payment — that happens through your accounting software. The platform acts as the record system, giving Finance a single view of all outstanding invoices and their status.

The Executive Cockpit (accessible to users with the executive role) shows high-level financial metrics: headcount history (how many employees were active in each month, useful for cost-per-head calculations), payroll cost trends over time, and statutory compliance status (whether PF, PT, and ESI remittances are up to date). Finance team members with appropriate access can review the underlying data that feeds these metrics to verify their accuracy before executive review meetings.

As a Finance team member, your responsibilities include: running the monthly payroll cycle on time, ensuring all statutory deductions are correctly computed and remitted to the appropriate government bodies, maintaining accurate client contract and invoice records, and coordinating with HR on any payroll corrections or employee exits that affect the current or previous payroll periods.`,
        quiz: null,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRACK 6 — Manager Onboarding (manager)
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: "Manager Onboarding",
    description: "My Team, leave approvals, offer letters, performance, probation, training compliance, and SOP responsibilities.",
    isUniversal: false,
    isPolicyTrack: false,
    status: "published",
    targetRole: "_rules_only",
    roles: ["manager"],
    sections: [
      {
        title: "My Team — Your Direct Reports",
        body: `As a manager on the Hire'in platform, your primary operational tool is My Team, found in the navigation sidebar. This section gives you a view of every employee who reports directly to you — and only those employees. The platform enforces manager-scoped data access at the server level, which means you cannot accidentally access records for employees outside your reporting line.

From My Team, you can view each direct report's profile (employment details, designation, department, joining date), their attendance records for the current and past months, their leave history and current balances, their training completion status, and their performance plans if the performance module is enabled.

The view is read-dominant — you can see a great deal of information but can only edit specific fields. The fields you can edit include punch corrections (if an employee forgot to punch in or out and you have permission to make the correction), basic profile updates that do not require HR approval, and performance plan elements within your scope. Every change you make through My Team is recorded in an audit trail — you cannot delete or obscure your edits. If you make a correction in error, the right path is to raise a Help Desk ticket with HR so it can be formally reviewed and corrected.

The My Team section is organised with sub-navigation: you will find a Team tab for the overview, a Corrections tab for attendance punch corrections, and a Plans tab for viewing active growth and probation plans for your direct reports. As your team grows or changes (new hires joining, employees moving to a different manager), the system updates automatically based on the managerId field on each employee's profile. If someone is incorrectly reporting to you — or should be reporting to you but is not appearing — contact HR to update the manager assignment.

My Team is also where you will see summary status cards showing today's attendance pulse: how many of your direct reports are present, absent, on approved leave, or have pending leave requests that need your action. This at-a-glance view is designed to help you start each day with a clear picture of your team's availability.`,
        quiz: null,
      },
      {
        title: "Attendance and Leave for Your Team",
        body: `Managing your team's attendance and leave is one of your most time-sensitive responsibilities as a manager. Delays in approving or rejecting leave requests have downstream effects on payroll accuracy, and failure to monitor attendance patterns can cause issues to go undetected until month end.

When one of your direct reports submits a leave request, you receive an in-app notification and an email notification. Your action is required before the request expires. From My Team, navigate to the Leaves section to see all pending requests for your team. For each request, you can approve it (which deducts the days from the employee's leave balance), reject it (which requires you to provide a reason that the employee can see), or return it for more information if the reason is unclear.

Understanding LOP (Loss of Pay) implications. When you approve a leave request and the employee does not have sufficient leave balance, the system will flag that part of the leave will result in LOP. Before approving such a request, consider whether the LOP is intended — sometimes an employee applies for leave knowing they have insufficient balance and accepts the pay deduction. Other times, it is a misunderstanding of their balance. You can check an employee's current leave balance from their profile in My Team before approving.

Attendance thresholds are configurable by role. As a manager, you may have the ability to set a configurable attendance threshold for your team that determines when an attendance pattern triggers an alert. If an employee's attendance percentage for the month falls below the threshold, the system flags it for your attention. Use this as an early warning signal — address attendance concerns before they become a payroll problem.

When a direct report's attendance needs to be corrected — for example, they forgot to punch out and the system recorded an incomplete attendance record — you can initiate a punch correction from the Corrections tab in My Team. Provide the correct punch time and a note explaining the reason. The correction is recorded in the audit trail with your name as the corrector.

Leave approval decisions — who approved or rejected each request, and when — are visible to employees. Your employees can see your name and the timestamp of your decision on their leave history. Act promptly and provide thoughtful rejection reasons when needed.`,
        quiz: {
          questions: [
            {
              questionText: "What happens when you approve a leave request for an employee who has insufficient leave balance to cover the full request?",
              explanation: "The system will process the approval, but part of the leave will be treated as LOP (Loss of Pay). The LOP days are tracked as splitLwpDays on the request and feed into the payroll deduction. You should confirm with the employee that they intend to accept the LOP before approving.",
              options: [
                { text: "The system automatically rejects the request and asks the employee to reduce the number of days", isCorrect: false },
                { text: "The request is approved but only the days covered by the balance are treated as paid; remaining days become LOP", isCorrect: true },
                { text: "The full request is approved as paid leave and the balance goes negative, to be recovered in the next accrual cycle", isCorrect: false },
                { text: "The system splits the request into two separate requests and approves them individually", isCorrect: false },
              ],
            },
            {
              questionText: "Can employees see who approved or rejected their leave request, and when?",
              explanation: "Yes — leave approval decisions including the reviewer's name and the timestamp are visible to employees in their leave history. This transparency means managers should act promptly and provide thoughtful rejection reasons.",
              options: [
                { text: "No — approval decisions are confidential and visible only to HR and the manager", isCorrect: false },
                { text: "Yes — the employee can see the reviewer's name and the decision timestamp on their leave history", isCorrect: true },
                { text: "Only the decision (approved/rejected) is shown; the reviewer's identity is hidden", isCorrect: false },
                { text: "Employees can only see the decision after the payroll run processes the LOP, not in real time", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Offer Letters — Generating and Tracking",
        body: `As a manager, you have the ability to generate offer letters for candidates in the New Hire section. This is typically the first step in bringing a new team member onboard, and understanding the full flow — from generation through to candidate acceptance — ensures you are not a bottleneck in the hiring process.

To generate an offer letter, navigate to New Hire and select the Offer Letters tab. Click Generate Offer Letter. You will be prompted to enter the candidate's details (name, email, role, department, designation, compensation package) and any special terms. Once you submit, the offer letter enters the approval queue and is sent to HR and Admin for review.

The approval chain for offer letters works as follows: you generate and submit, HR reviews and approves or rejects, and Admin (or super admin) provides final countersign authorisation. You will receive a notification when the letter is approved or rejected. If rejected, the notification includes the rejection reason — a piece of information that was specifically designed to be visible to you so you can make corrections and resubmit without needing to chase HR for feedback.

If an offer letter is rejected and you need to resubmit, you can edit the pending or rejected offer letter directly rather than creating a new one from scratch. This preserves the continuity of the offer letter record and avoids creating duplicates for the same candidate. To resubmit, open the offer letter from the dashboard, make the necessary changes, and click Resubmit for Approval.

CC recipients. When an offer letter is sent, you can specify additional email addresses to be copied on the communication. These CC recipients — typically the recruiter, a finance contact for compensation verification, or an HR business partner — receive a copy of the email when the offer is sent to the candidate. Stored CC recipients are visible when you review a sent letter's details.

Once the offer letter is approved and sent, the candidate receives an email with a link to view and electronically accept the offer. You will be notified when the candidate accepts. After acceptance, the onboarding checklist is automatically triggered and the candidate's user account is provisioned.`,
        quiz: {
          questions: [
            {
              questionText: "Where can you see the reason given by HR when they reject an offer letter you submitted?",
              explanation: "Rejection reasons are visible to the submitting manager on the offer letter detail view in the New Hire section. This was specifically designed so managers can correct and resubmit without needing to contact HR separately to understand the rejection.",
              options: [
                { text: "In your HR direct message inbox — HR sends the reason separately", isCorrect: false },
                { text: "In the offer letter detail view in the New Hire section", isCorrect: true },
                { text: "In the audit log, which is only accessible to super_admin users", isCorrect: false },
                { text: "Rejection reasons are not stored; you must ask HR verbally", isCorrect: false },
              ],
            },
            {
              questionText: "What should you do if an offer letter you submitted is rejected and needs corrections?",
              explanation: "You can edit the pending or rejected offer letter directly and resubmit — there is no need to create a new letter from scratch. This preserves the continuity of the record and avoids creating duplicates for the same candidate.",
              options: [
                { text: "Delete the rejected offer letter and generate a brand-new one with the correct details", isCorrect: false },
                { text: "Ask HR to edit the letter on your behalf since rejected letters are locked for managers", isCorrect: false },
                { text: "Open the rejected offer letter, make the necessary corrections, and click Resubmit for Approval", isCorrect: true },
                { text: "Send the candidate the offer details manually by email while HR creates a new letter internally", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Performance and Probation",
        body: `The performance module on the platform — when enabled by the feature flag — gives you structured tools to set goals, conduct check-ins, manage the probation process for new hires, provide coaching notes, and run formal review cycles. This section covers the key concepts and your responsibilities as a manager.

Goals can be set at the individual level (for a specific employee), the team level (shared goals for your entire direct-report group), or the company level (which are set by senior leadership and cascade down). When you set a goal for a direct report, you specify the title, description, category, start date, target date, and weight (how much this goal contributes to the overall performance assessment). Goals have a status lifecycle: not started, in progress, completed, or cancelled. The employee can update their own goal progress percentage; you can update the status and add review notes.

Check-ins are the primary mechanism for your regular one-on-one conversations with each direct report. A check-in record captures the date, your notes as the manager, the employee's notes, any action items agreed during the conversation, and a rating if applicable. Check-ins are visible to both you and the employee — there is no private manager-only view. Structure your check-in notes accordingly.

Probation management follows a defined eight-milestone cadence for every new hire: Day 1, Day 7, Day 15, Day 30, Day 45, Day 60, Day 75, and Day 90. Days 30, 60, and 90 are formal milestone reviews where a scorecard must be completed. The other days are lightweight pulse reviews. The system automatically creates check-in records for each milestone at the time the probation plan is activated. You receive reminders as each milestone approaches. Missing a formal milestone review (Day 30, 60, or 90) without completing the scorecard will trigger an escalation notification.

Coaching log entries are ad-hoc notes you can attach to an employee's record to document informal coaching conversations, behavioural observations, or commendations. Unlike check-ins, coaching log entries do not follow a scheduled cadence — you add them as needed. They are visible in the employee's profile under the Plans section and form part of the overall performance record.

Growth plans are structured development plans that emerge from the performance review process. When a growth plan is activated, it generates tracked goals with specific milestones and due dates. Employees acknowledge their growth plan electronically, and this acknowledgement is recorded with a timestamp.`,
        quiz: {
          questions: [
            {
              questionText: "How many check-in milestones are scheduled during an employee's 90-day probation period, and which ones require a formal scorecard?",
              explanation: "Eight check-ins are scheduled at Days 1, 7, 15, 30, 45, 60, 75, and 90. The Day 30, 60, and 90 check-ins are formal milestone reviews that require a full scorecard. The other five are lightweight pulse reviews.",
              options: [
                { text: "Three check-ins — at Day 30, Day 60, and Day 90 — all with scorecards", isCorrect: false },
                { text: "Eight check-ins — at Days 1, 7, 15, 30, 45, 60, 75, and 90 — with scorecards required at Days 30, 60, and 90", isCorrect: true },
                { text: "Four check-ins — weekly for the first month and then monthly", isCorrect: false },
                { text: "Twelve check-ins — weekly for three months, all requiring a scorecard", isCorrect: false },
              ],
            },
            {
              questionText: "Are check-in notes visible to the employee being reviewed, or only to the manager?",
              explanation: "Check-in records are visible to both the manager and the employee — there is no private manager-only view. Managers should structure their notes with this in mind and use the coaching log for informal private observations.",
              options: [
                { text: "Only the manager can see check-in notes; the employee sees only the scheduled date and outcome", isCorrect: false },
                { text: "Both the manager and the employee can see all check-in notes", isCorrect: true },
                { text: "The employee sees only the rating; notes remain private to the manager and HR", isCorrect: false },
                { text: "Notes are visible to both until the check-in is marked complete; then only HR can access them", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Training Compliance for Your Team",
        body: `As a manager, you are responsible for monitoring your team's training completion and ensuring that no employee falls into a compliance lock that prevents them from working effectively. The training module gives you oversight tools, and you have the ability to raise extension requests for team members who need more time.

To view your team's training status, navigate to the Training section available from your role's navigation. The team progress view shows each of your direct reports alongside their assigned training tracks, their completion percentage for each track, and their due dates. Overdue assignments are highlighted so you can identify who needs immediate attention.

The training compliance lock is a feature that activates when an employee's assigned training is overdue and the onboarding_training feature flag is enabled. A locked employee sees a warning on their My Desk and may be prevented from accessing certain features. As a manager, the compliance lock for your direct reports will be visible in your team's training view — an employee in a locked state is shown with a lock icon.

To raise a training extension request for a team member, open their training assignment from the team view and click Request Extension. Provide the reason for the extension and the new proposed due date. The extension request goes to HR for approval. Once approved, the due date is updated and the compliance lock is lifted for that specific track. Note: you can only raise extension requests for your direct reports, and the extension must be justified — routine extension requests without clear reasons may be rejected.

Your role in training goes beyond administrative oversight. When you see an employee struggling with a training track, your first action should be to find out why — is it a time constraint, a technical difficulty accessing the content, or a misunderstanding of the material? Most training issues are resolved through a brief conversation rather than a formal extension request. Use the extension request process for genuine unavoidable delays, not as a default workaround for lack of engagement.

Training completion certificates are generated automatically when an employee completes all sections of a track and provides their electronic acknowledgement on each section. You will see the completion recorded in your team's training progress view.`,
        quiz: null,
      },
      {
        title: "SOP Responsibilities for Managers",
        body: `Standard Operating Procedures (SOPs) on the Hire'in platform are formal documents that govern how specific processes should be performed. As a manager, you have both a compliance responsibility (ensuring your team follows the SOPs relevant to their roles) and a governance responsibility (completing periodic audits to confirm adherence).

SOPs are linked to training tracks. When a new SOP is published, it is associated with a training track that employees must complete to demonstrate they have read and understood the procedure. Once an employee completes the linked training track and passes the quiz, their SOP acknowledgement is recorded. The compliance module uses this acknowledgement to determine whether the employee is considered compliant with the SOP.

SOP enforcement operates at two levels: soft and hard. In soft enforcement mode, an employee who has not acknowledged a relevant SOP sees a coaching banner reminding them to complete it. There is no functional restriction. In hard enforcement mode (the compliance lock), employees who have not acknowledged the SOP are prevented from accessing certain platform features until they do. As a manager, you can see which enforcement mode applies to each SOP for your team.

Weekly audit responsibilities apply to managers for operational SOPs. A weekly audit record requires you to confirm that your team followed the relevant procedure during the past week. The audit is completed via the SOP section of the admin portal and requires a simple acknowledgement for each in-scope SOP. Missing a weekly audit will generate a reminder notification. Consistent non-completion of audits triggers escalation to HR.

When the SOP system rolls out new procedures, they follow a wave-based rollout schedule. Your team may be in a pilot wave (receiving the SOP early for testing and feedback) or a later wave (receiving it once the procedure is considered stable). Your team's wave membership is determined at the department and role level by HR and super admin. You do not need to manage wave assignments directly, but you should be aware of which SOPs are active for your team at any given time.`,
        quiz: null,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRACK 7 — Recruiter / Operations Onboarding (recruiter, operations)
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: "Recruiter and Operations Onboarding",
    description: "Job board, Ceipal sync, candidate pipeline, offer letter workflow, and new hire handoff.",
    isUniversal: false,
    isPolicyTrack: false,
    status: "published",
    targetRole: "_rules_only",
    roles: ["recruiter", "operations"],
    sections: [
      {
        title: "Job Board and Ceipal ATS Sync",
        body: `The Hire'in platform's job board is powered by a real-time integration with the Ceipal ATS (Applicant Tracking System). Ceipal is the system of record for all open positions — the platform pulls job listings from Ceipal and displays them on the public-facing website so candidates can browse and apply.

The sync mechanism uses a JWT-authenticated API connection to Ceipal. When the sync runs, it retrieves all active job postings from Ceipal and maps them to the jobs table in the platform database. The mapping preserves the Ceipal job code and Ceipal job ID alongside the platform's own job ID, so every job in the platform can be traced back to its source record in Ceipal.

Status mapping. Jobs in Ceipal have their own status values, and not all of them translate directly to the platform. The sync maps Ceipal statuses to the platform's is_active field — active jobs in Ceipal become active on the platform and visible to candidates, while closed or expired jobs are marked inactive and hidden from the public job board. Hot jobs (high-priority, urgent openings) can be flagged using the is_hot field, which causes them to appear in a highlighted position on the job board.

When sync fails. If the Ceipal connection is unavailable — due to a Ceipal maintenance window, an expired JWT token, or a network issue — the sync will fail silently and the job board will continue to show the last-synced data. You should check the sync status from the Recruitment section of the admin portal regularly. If jobs have not updated in more than 24 hours, investigate the connection. Common causes: the JWT token has expired and needs to be rotated (contact your admin), the Ceipal API has changed and the integration needs updating (raise a bug ticket), or a network firewall rule has changed.

Jobs can also be created manually in the platform without Ceipal — use the source field to mark them as 'manual' rather than 'ceipal'. Manual jobs are fully managed within the platform and are not synced back to Ceipal.`,
        quiz: null,
      },
      {
        title: "Candidate Pipeline Management",
        body: `The candidate pipeline on the Hire'in platform tracks every applicant from initial application through to hiring decision. As a recruiter or operations team member, you spend most of your time in this pipeline — reviewing applications, updating statuses, communicating with candidates, and pushing accepted applicants back to Ceipal.

Applications enter the pipeline when a candidate applies through the public job board. Each application record captures the candidate's name, email, phone number, resume (stored in object storage), cover letter, LinkedIn URL, years of experience, current employer, and the job they applied for. Applications begin in 'new' status.

Status progression. Move applications through the pipeline using the status field. Typical statuses are: new (just received, not yet reviewed), in review (being assessed), shortlisted (advancing to interviews), interviewed, offer extended, offer accepted, and hired. You can also mark applications as rejected at any stage with a rejection reason, or put them on hold while you gather more information.

Pushing applicant data back to Ceipal. Once you decide to move an applicant forward in the Ceipal workflow, use the Push to Ceipal action on the application record. This sends the applicant's data to Ceipal using the applicant data push API, creating or updating the corresponding Ceipal record. The ceipalSyncStatus field on the application tells you whether the push succeeded, is pending, or failed. If a push fails, check the error details and retry — most failures are due to missing required fields in the applicant record (Ceipal often requires a phone number in a specific format or a complete address).

The job detail page for any listing shows the count of applications received, their status distribution, and a list of applicants with their key details. Use this view to get a quick snapshot of the pipeline for any given role and to identify applications that have been sitting in the same status for too long without action.`,
        quiz: {
          questions: [
            {
              questionText: "What does the ceipalSyncStatus field on an application record tell you?",
              explanation: "The ceipalSyncStatus field indicates whether the applicant data has been successfully pushed to Ceipal ('pending', 'synced', or 'failed'). A failed status means the push did not complete and should be retried after checking for missing or incorrectly formatted required fields.",
              options: [
                { text: "Whether the candidate's application was received from Ceipal or submitted directly on the platform", isCorrect: false },
                { text: "Whether the job the candidate applied for is still active in Ceipal", isCorrect: false },
                { text: "Whether the applicant's data has been successfully pushed back to Ceipal", isCorrect: true },
                { text: "The candidate's interview status in the Ceipal workflow", isCorrect: false },
              ],
            },
            {
              questionText: "What is the most common cause of a failed Push to Ceipal action?",
              explanation: "Most push failures are caused by missing or incorrectly formatted required fields in the applicant record — Ceipal typically requires a phone number in a specific format or a complete address. Check the error details and correct the applicant data before retrying.",
              options: [
                { text: "The Ceipal JWT token has expired and needs to be rotated by an admin", isCorrect: false },
                { text: "Missing or incorrectly formatted required fields in the applicant record (e.g. phone format or address)", isCorrect: true },
                { text: "The candidate's email address is already registered in Ceipal under a different applicant ID", isCorrect: false },
                { text: "The job listing was closed in Ceipal before the push was attempted", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Offer Letter Pipeline",
        body: `When a candidate is ready to receive an offer, the offer letter pipeline on the platform handles the full workflow from generation through to candidate acceptance and HR counter-signature. As a recruiter or operations team member, you initiate this pipeline and coordinate the parties involved.

Generating an offer letter. From the New Hire section, select the Offer Letters tab and click Generate Offer Letter. Fill in the candidate's details (name, email address, role, department, designation) and the compensation components (CTC, basic salary, allowances). You can also specify CC recipients — additional email addresses that should receive a copy of the offer email when it is sent to the candidate. Once submitted, the offer letter enters the approval queue.

Approval chain. The offer letter flows through a mandatory approval chain before it reaches the candidate. First, HR reviews and approves or rejects. If HR rejects, you receive a notification with the rejection reason so you can correct and resubmit. Once HR approves, the letter moves to Admin or super admin for final counter-signature. The counter-signature step involves an authorised signatory electronically signing the document, which records a cryptographic hash of the signed content. Any subsequent tampering with the document would invalidate the hash.

Candidate acceptance. Once counter-signed, the candidate receives an email with a link to view the offer letter and a button to accept. The acceptance flow asks the candidate to review the full letter and confirm their acceptance by clicking the Accept button, which records their acceptance timestamp and a hash of the content they accepted. If the candidate has questions or wants to negotiate, they should contact you outside the platform — the platform records only the final acceptance, not the negotiation process.

New hire handoff. After acceptance, the system automatically triggers the onboarding checklist for the new hire and provisions their platform account if they do not already have one. A training assignment for the universal training track is automatically created. You receive a notification confirming that the handoff to HR has occurred. Your responsibility in the pipeline effectively ends at this point — the onboarding process is owned by HR from here.`,
        quiz: {
          questions: [
            {
              questionText: "What is the correct order of the offer letter approval chain after a recruiter generates and submits an offer letter?",
              explanation: "The offer letter flows from the recruiter submission to HR for review and approval, then to Admin/super admin for counter-signature, and finally to the candidate for acceptance. This order ensures compliance review before any offer reaches the candidate.",
              options: [
                { text: "Recruiter generates → candidate sees the offer → HR approves → Admin countersigns", isCorrect: false },
                { text: "Recruiter generates → HR approves → Admin countersigns → candidate accepts", isCorrect: true },
                { text: "Recruiter generates → Admin countersigns → HR approves → candidate accepts", isCorrect: false },
                { text: "Recruiter generates → Manager approves → candidate accepts → HR records in the system", isCorrect: false },
              ],
            },
            {
              questionText: "What is recorded when a candidate electronically accepts an offer letter?",
              explanation: "The candidate's acceptance records a timestamp and a cryptographic hash of the document content they accepted. This makes the acceptance immutable — any tampering with the document after acceptance would invalidate the hash.",
              options: [
                { text: "Only a timestamp indicating when the candidate clicked Accept", isCorrect: false },
                { text: "A timestamp and a cryptographic hash of the document content at the time of acceptance", isCorrect: true },
                { text: "A digital signature image captured from the candidate's touch screen", isCorrect: false },
                { text: "An email confirmation sent by the candidate to HR acknowledging the offer", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "New Hire Handoff — What Happens After Acceptance",
        body: `The moment a candidate accepts an offer letter, a sequence of automatic actions is triggered in the platform that initiates their transition from candidate to employee. Understanding this sequence helps you know what to expect and when to follow up if something does not happen as expected.

First, the candidate's user account is provisioned in the platform. If the candidate already had a Replit Auth account linked to their email address, their existing account is associated with the new employee record. If not, an account is created using the email address on the offer letter. The account is given the role specified in the offer letter and placed under the reporting manager designated during the offer letter generation.

Second, the onboarding checklist is activated for the new hire. The checklist appears in the New Hire section's Onboarding tab and tracks the new hire's progress through required steps: profile completion, document upload, bank details submission, emergency contact entry, and policy acknowledgements. The checklist completion percentage in the Onboarding tab is what HR monitors during the first 90 days.

Third, training assignments are automatically created based on the new hire's role. The universal Platform Fundamentals training track is assigned to every new hire regardless of role. The role-specific training track (for example, the Recruiter and Operations Onboarding track for a new recruiter) is assigned automatically based on the role_training_rules configured in the system. The due date for these assignments is set to 30 days from the assignment date, giving new hires a month to complete their orientation training.

Fourth, HR receives a notification that a new hire has accepted and that the onboarding process has been initiated. The HR team then coordinates document collection, access provisioning for external tools, and any physical onboarding requirements (workstation, access cards, etc.) that are managed outside the platform.

As a recruiter, your post-acceptance responsibility is to ensure the information you entered in the offer letter was accurate. If there is a discrepancy in the candidate's name, email, or compensation that needs to be corrected, raise it with HR immediately — some corrections require re-issuing the offer letter, which restarts part of the acceptance flow.`,
        quiz: null,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRACK 8 — Executive Onboarding (executive)
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: "Executive Onboarding",
    description: "Executive Cockpit metrics, platform overview, and payroll and finance visibility for the executive role.",
    isUniversal: false,
    isPolicyTrack: false,
    status: "published",
    targetRole: "_rules_only",
    roles: ["executive"],
    sections: [
      {
        title: "Executive Cockpit — Metrics and Meaning",
        body: `The Executive Cockpit is the primary interface for users with the executive role. It is a read-only view designed to give senior leadership a high-level picture of the organisation's operational health without exposing the detailed administrative tools available to HR, Finance, and operations staff.

The Cockpit shows headcount history — a month-by-month record of how many active employees were on the platform in each period. This figure is computed from the admin_users table, counting records where employment_status is 'active' and deleted_at is null, at the end of each month. Use headcount history to track growth trends, identify periods of high attrition, and correlate headcount changes with business events.

Payroll cost summary. For each completed payroll run, the Cockpit shows the total gross payroll, total net payable, and total statutory deductions for the period. These figures come from the locked payroll run records, not from live estimates. If you are reviewing a month where the payroll run has not yet been completed, the Cockpit will show the previous completed period's figures with a note indicating the current month is pending.

Statutory compliance status. This section shows whether key statutory remittances — EPF contributions, Professional Tax payments, ESI contributions — are recorded as up to date. The platform does not process these payments directly; it records whether Finance has marked them as remitted for each period. If a period is overdue, it will appear highlighted in the compliance status view. Use this as a prompt to follow up with Finance, not as a definitive legal compliance statement.

The Cockpit figures are read-only and cannot be edited from the executive view. If you believe a figure is incorrect, raise it with Finance or HR for investigation. Do not assume that a discrepancy represents a problem — it may be a timing difference (a payroll run that has not yet been marked as complete) or a data entry issue that Finance is already aware of.

The executive role has strictly read-only access to the Cockpit and selected other high-level views. Attempts to access HR management tools, payroll editing functions, or employee personal data will be blocked by the platform's access control system.`,
        quiz: {
          questions: [
            {
              questionText: "Where does the payroll cost data shown in the Executive Cockpit come from?",
              explanation: "The Cockpit shows figures from locked, completed payroll run records — not live estimates. This ensures the figures are stable and auditable. A month where the payroll run has not been completed will show the previous period's figures with a pending indicator.",
              options: [
                { text: "Live database queries run each time the Cockpit is opened, giving up-to-the-minute figures", isCorrect: false },
                { text: "Locked, completed payroll run records — stable and auditable figures from finalised runs", isCorrect: true },
                { text: "Estimates based on headcount multiplied by average salary, updated monthly by Finance manually", isCorrect: false },
                { text: "The Ceipal ATS, which tracks contractor billing rates and converts them to salary equivalents", isCorrect: false },
              ],
            },
            {
              questionText: "What should you do if the Executive Cockpit shows a statutory compliance status as overdue for a past period?",
              explanation: "The overdue indicator is a prompt to follow up with Finance — it means Finance has not yet marked the remittance as completed in the platform. It is not a definitive legal statement; the remittance may have been made but not yet recorded.",
              options: [
                { text: "Log into the payroll module and mark the period as compliant directly", isCorrect: false },
                { text: "Raise a compliance escalation with the statutory authority directly", isCorrect: false },
                { text: "Follow up with Finance to confirm whether the remittance was made and request that they update the platform record", isCorrect: true },
                { text: "No action needed — the system automatically updates compliance status from bank records nightly", isCorrect: false },
              ],
            },
          ],
        },
      },
      {
        title: "Platform Overview for Executives",
        body: `The Hire'in platform is an end-to-end operating system for a staffing and talent acquisition business. As an executive, you are a consumer of the platform's outputs rather than an operator of its tools. This section explains what each major module does at a level of detail appropriate for oversight without requiring you to use those tools yourself.

The Recruitment module manages the candidate pipeline from job listing through to offer. Jobs are sourced from the Ceipal ATS integration and displayed on the public job board. Recruiters and operations staff track candidate applications, conduct interviews, and generate offer letters. The offer letter workflow includes a mandatory approval chain that ensures all offers go through HR and authorised signatories before reaching candidates.

The HR module manages the employee lifecycle after onboarding. It covers attendance recording (employees punch in and out every day, and these records feed payroll), leave management (EL and SL entitlements, with automated balance calculations), letter generation (experience, relieving, and amendment letters), and the new hire onboarding process. HR has visibility across the entire organisation; managers see only their direct reports.

The Payroll module runs monthly and processes the India statutory payroll for all active employees. It computes gross pay, applies EPF, PT, ESI, and TDS deductions, accounts for LOP from unapproved absences, and generates individual salary slips. The Finance team runs this module and is accountable for its accuracy and timely completion.

The Training module assigns and tracks completion of learning tracks for all employees. New hires are automatically assigned tracks when they join. Training compliance is enforced via a lock mechanism that can restrict access for employees with overdue training. As an executive, you can view overall training completion rates in the platform's reporting views.

The Performance module — when enabled — provides a structured framework for goal-setting, check-ins, probation management, and review cycles. It gives managers tools to have documented, auditable performance conversations and provides HR with oversight of the full performance management process.

Your executive role has been carefully scoped to provide the visibility you need for strategic oversight without exposing sensitive employee personal data or operational configuration tools. If you need information that is not visible in your current view, the appropriate path is to request a report from HR or Finance rather than asking for elevated platform access.`,
        quiz: null,
      },
      {
        title: "Payroll and Finance Visibility",
        body: `As an executive, your payroll and finance visibility is focused on aggregate metrics and trend data rather than individual employee pay details. This section explains what you can see, how to interpret it, and what to ask Finance when you need more detail.

Payroll run summaries. For each completed payroll run, you can see the total headcount processed, total gross payroll cost, total net payable to employees, and total statutory deductions remitted (or pending remittance). These figures let you track the monthly payroll cost as a business metric and identify months where significant deviations from trend occurred — for example, a month with higher-than-expected LOP deductions may indicate an attendance issue worth investigating with HR.

Headcount history. The month-by-month headcount view shows how the active employee count has changed over time. Combine this with payroll cost data to compute cost-per-head trends. A rising cost-per-head in a stable headcount period typically indicates salary revisions or statutory rate changes. A falling cost-per-head with stable headcount may indicate LOP deductions (employees absent without pay).

Statutory compliance indicators. The Cockpit shows whether EPF, PT, and ESI remittances have been recorded for each period. EPF (Employee Provident Fund) is a mandatory retirement savings contribution — the employer contributes 12% of each employee's basic salary to their EPF account monthly. PT (Professional Tax) is a state-level tax deducted from employee salaries at a slab rate. ESI (Employee State Insurance) covers health insurance for employees earning below a gross salary threshold.

When Finance presents monthly payroll reports to leadership, the Cockpit figures provide the foundation. If there is a discrepancy between the Cockpit's summary and Finance's external accounting records, the likely cause is a timing difference — either a payroll run that has been completed in the platform but not yet reconciled in the accounting system, or vice versa. Finance can provide a reconciliation bridge if needed.

For strategic planning purposes — budgeting for headcount growth, forecasting payroll cost for a new business unit, or modelling the cost of a statutory rate change — the Cockpit data provides the historical baseline, and Finance can project forward using the salary structure engine's outputs as inputs to the financial model.`,
        quiz: null,
      },
    ],
  },
];

// ─── SEED LOGIC ───────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Hire'in Platform Training Seed ===\n");

  // ── PRE-FLIGHT ──────────────────────────────────────────────────────────
  console.log("PRE-FLIGHT: Checking existing data...");

  const existingRolesResult = await db.execute(sql`
    SELECT role, COUNT(*) as count
    FROM admin_users
    WHERE deleted_at IS NULL
    GROUP BY role
    ORDER BY role
  `);
  console.log("Active users by role:", existingRolesResult.rows);

  const existingTracks = await db.select({ title: learningTracks.title }).from(learningTracks);
  const existingTitles = new Set(existingTracks.map((t) => t.title));
  console.log("Existing track titles:", [...existingTitles]);

  const existingRulesCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM role_training_rules`);
  console.log("Existing role_training_rules rows:", existingRulesCount.rows[0]);

  // Fixup: role-specific tracks seeded before targetRole was introduced may have
  // target_role = NULL. Phase 1 of new-user auto-assignment treats NULL as "assign to
  // everyone", which would give all 8 tracks to every new user regardless of role.
  // Set them to '_rules_only' so Phase 1 skips them and Phase 2 (role_training_rules)
  // handles the correct role-based assignment.
  const roleSpecificTitles = TRACKS.filter((t) => t.targetRole === "_rules_only").map((t) => t.title);
  if (roleSpecificTitles.length > 0) {
    const fixResult = await db.execute(sql`
      UPDATE learning_tracks
      SET target_role = '_rules_only'
      WHERE title = ANY(ARRAY[${sql.join(roleSpecificTitles.map((t) => sql`${t}`), sql`, `)}])
        AND (target_role IS NULL OR target_role = '')
    `);
    const fixed = (fixResult as any).rowCount ?? 0;
    if (fixed > 0) console.log(`  FIXUP: set target_role='_rules_only' on ${fixed} existing role-specific track(s).`);
  }

  console.log("\n--- Phase 1: Creating tracks and sections ---\n");

  const trackIdMap: Record<string, string> = {};

  for (const track of TRACKS) {
    if (existingTitles.has(track.title)) {
      console.log(`  SKIP (already exists): ${track.title}`);
      const [existing] = await db.select({ id: learningTracks.id })
        .from(learningTracks)
        .where(eq(learningTracks.title, track.title));
      if (existing) trackIdMap[track.title] = existing.id;
      continue;
    }

    console.log(`  INSERT track: ${track.title}`);
    const [inserted] = await db.insert(learningTracks).values({
      title: track.title,
      description: track.description,
      isUniversal: track.isUniversal,
      isPolicyTrack: track.isPolicyTrack,
      status: track.status,
      targetRole: track.targetRole,
      version: "1.0",
      versionNumber: 1,
      publishedAt: new Date(),
    }).returning({ id: learningTracks.id });

    const trackId = inserted.id;
    trackIdMap[track.title] = trackId;

    for (let i = 0; i < track.sections.length; i++) {
      const section = track.sections[i];
      const dwell = calcDwell(section.body);
      console.log(`    Section ${i + 1}: "${section.title}" — ${wordCount(section.body)} words, dwell ${dwell}s`);

      await db.insert(trackSections).values({
        trackId,
        title: section.title,
        body: section.body,
        orderIndex: i,
        minDwellSeconds: dwell,
        estimatedMinutes: Math.ceil(dwell / 60),
      });
    }
  }

  console.log("\n--- Phase 2: Seeding quiz questions (2 per quiz section) ---\n");

  for (const track of TRACKS) {
    const trackId = trackIdMap[track.title];
    if (!trackId) continue;

    for (const section of track.sections) {
      if (!section.quiz) continue;

      const requiredQuestionCount = section.quiz.questions.length;

      const sectionRows = await db.select({ id: trackSections.id, title: trackSections.title })
        .from(trackSections)
        .where(eq(trackSections.trackId, trackId));

      const sectionRow = sectionRows.find((s) => s.title === section.title);
      if (!sectionRow) {
        console.log(`  WARN: Section not found for quiz — track "${track.title}", section "${section.title}"`);
        continue;
      }

      const existingQuestions = await db.select({ id: sectionQuizQuestions.id })
        .from(sectionQuizQuestions)
        .where(eq(sectionQuizQuestions.sectionId, sectionRow.id));

      if (existingQuestions.length >= requiredQuestionCount) {
        console.log(`  SKIP quiz (already has ${existingQuestions.length}/${requiredQuestionCount} questions): "${section.title}"`);
        continue;
      }

      const questionsToInsert = section.quiz.questions.slice(existingQuestions.length);
      console.log(`  INSERT ${questionsToInsert.length} question(s) for: "${section.title}" (${existingQuestions.length} already exist)`);

      for (const question of questionsToInsert) {
        const [q] = await db.insert(sectionQuizQuestions).values({
          sectionId: sectionRow.id,
          questionText: question.questionText,
          explanation: question.explanation,
        }).returning({ id: sectionQuizQuestions.id });

        for (let oi = 0; oi < question.options.length; oi++) {
          const opt = question.options[oi];
          await db.insert(sectionQuizOptions).values({
            questionId: q.id,
            optionText: opt.text,
            isCorrect: opt.isCorrect,
            orderIndex: oi,
          });
        }
      }
    }
  }

  console.log("\n--- Phase 3: Seeding role_training_rules ---\n");

  for (const track of TRACKS) {
    if (track.roles.length === 0) continue;
    const trackId = trackIdMap[track.title];
    if (!trackId) continue;

    for (const roleSlug of track.roles) {
      const existing = await db.select({ id: roleTrainingRules.id })
        .from(roleTrainingRules)
        .where(and(
          eq(roleTrainingRules.trackId, trackId),
          eq(roleTrainingRules.roleSlug, roleSlug),
        ));

      if (existing.length > 0) {
        console.log(`  SKIP rule (exists): ${roleSlug} -> ${track.title}`);
        continue;
      }

      console.log(`  INSERT rule: ${roleSlug} -> ${track.title}`);
      await db.insert(roleTrainingRules).values({
        roleSlug,
        trackId,
        isMandatory: true,
      });
    }
  }

  console.log("\n--- Phase 4: Backfilling existing active users ---\n");

  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const activeUsers = await db.select({ id: adminUsers.id, role: adminUsers.role })
    .from(adminUsers)
    .where(isNull(adminUsers.deletedAt));

  console.log(`Found ${activeUsers.length} active users to backfill.`);

  const roleToTrackIds: Record<string, string[]> = {};
  for (const track of TRACKS) {
    if (!trackIdMap[track.title]) continue;
    for (const roleSlug of track.roles) {
      if (!roleToTrackIds[roleSlug]) roleToTrackIds[roleSlug] = [];
      roleToTrackIds[roleSlug].push(trackIdMap[track.title]);
    }
  }
  const universalTrackId = trackIdMap["Platform Fundamentals"];

  let backfilledUsers = 0;
  let assignmentsCreated = 0;
  let assignmentsSkipped = 0;

  for (const user of activeUsers) {
    const tracksForUser = new Set<string>();
    if (universalTrackId) tracksForUser.add(universalTrackId);
    const roleSpecific = roleToTrackIds[user.role] || [];
    for (const tid of roleSpecific) tracksForUser.add(tid);

    let userCreated = 0;

    for (const trackId of tracksForUser) {
      const existing = await db.select({ id: trackAssignments.id })
        .from(trackAssignments)
        .where(and(
          eq(trackAssignments.userId, user.id),
          eq(trackAssignments.trackId, trackId),
        ));

      if (existing.length > 0) {
        assignmentsSkipped++;
        continue;
      }

      await db.insert(trackAssignments).values({
        trackId,
        userId: user.id,
        dueDate,
        status: "not_started",
      });
      userCreated++;
      assignmentsCreated++;
    }

    if (userCreated > 0) backfilledUsers++;
  }

  console.log(`Backfill complete: ${backfilledUsers} users backfilled, ${assignmentsCreated} assignments created, ${assignmentsSkipped} skipped (already existed).`);

  console.log("\n--- Phase 5: Validation ---\n");

  let allPassed = true;

  // Check 1: 8 published tracks (our 8)
  const publishedTracksResult = await db.select({ id: learningTracks.id, title: learningTracks.title })
    .from(learningTracks)
    .where(eq(learningTracks.status, "published"));
  const ourTrackTitles = TRACKS.map((t) => t.title);
  const ourPublished = publishedTracksResult.filter((t) => ourTrackTitles.includes(t.title));
  const check1 = ourPublished.length === 8;
  console.log(`[${check1 ? "PASS" : "FAIL"}] 8 published platform training tracks: found ${ourPublished.length}`);
  if (!check1) allPassed = false;

  // Check 2: every track has at least the expected section count
  for (const track of TRACKS) {
    const tid = trackIdMap[track.title];
    if (!tid) { console.log(`[FAIL] Track missing from DB: ${track.title}`); allPassed = false; continue; }
    const secs = await db.select({ id: trackSections.id }).from(trackSections).where(eq(trackSections.trackId, tid));
    const expectedCount = track.sections.length;
    const ok = secs.length >= expectedCount;
    console.log(`[${ok ? "PASS" : "FAIL"}] Track "${track.title}" has ${secs.length}/${expectedCount} sections`);
    if (!ok) allPassed = false;
  }

  // Check 3: every quiz section has at least 2 questions (required minimum per task spec)
  for (const track of TRACKS) {
    const tid = trackIdMap[track.title];
    if (!tid) continue;
    for (const section of track.sections) {
      if (!section.quiz) continue;
      const secs = await db.select({ id: trackSections.id }).from(trackSections).where(and(
        eq(trackSections.trackId, tid),
        eq(trackSections.title, section.title),
      ));
      if (secs.length === 0) { console.log(`[FAIL] Quiz section not found: "${section.title}"`); allPassed = false; continue; }
      const questions = await db.select({ id: sectionQuizQuestions.id })
        .from(sectionQuizQuestions)
        .where(eq(sectionQuizQuestions.sectionId, secs[0].id));
      const ok = questions.length >= 2;
      console.log(`[${ok ? "PASS" : "FAIL"}] Quiz "${section.title}": ${questions.length} question(s) (minimum 2 required)`);
      if (!ok) allPassed = false;
    }
  }

  // Check 4: every active user has at least 2 assignments (universal + role-specific)
  // employee-role users only get the universal track → they have 1 assignment, which
  // is correct per the design (no role_training_rule for employee).
  // All other roles should have at least 2 (universal + their track).
  if (activeUsers.length > 0) {
    const nonEmployeeUsers = activeUsers.filter((u) => u.role !== "employee");
    const employeeRoleUsers = activeUsers.filter((u) => u.role === "employee");

    // Non-employee users must have >= 2 assignments
    for (const user of nonEmployeeUsers) {
      const assignments = await db.select({ id: trackAssignments.id })
        .from(trackAssignments)
        .where(eq(trackAssignments.userId, user.id));
      const ok = assignments.length >= 2;
      if (!ok) {
        console.log(`[FAIL] User ${user.id} (role: ${user.role}) has only ${assignments.length} assignment(s); expected >= 2`);
        allPassed = false;
      }
    }

    const nonEmployeeCovered = nonEmployeeUsers.filter(async (u) => {
      const a = await db.select({ id: trackAssignments.id }).from(trackAssignments).where(eq(trackAssignments.userId, u.id));
      return a.length >= 2;
    });
    console.log(`[${allPassed ? "PASS" : "FAIL"}] All non-employee active users have >= 2 assignments (universal + role-specific): ${nonEmployeeUsers.length} user(s) checked`);

    // Employee-role users must have >= 1 assignment (universal only is correct)
    for (const user of employeeRoleUsers) {
      const assignments = await db.select({ id: trackAssignments.id })
        .from(trackAssignments)
        .where(eq(trackAssignments.userId, user.id));
      const ok = assignments.length >= 1;
      if (!ok) {
        console.log(`[FAIL] Employee user ${user.id} has 0 assignments; expected >= 1 (universal track)`);
        allPassed = false;
      }
    }
    if (employeeRoleUsers.length > 0) {
      console.log(`[PASS] All employee-role users have >= 1 assignment (universal track): ${employeeRoleUsers.length} user(s) checked`);
    }
  } else {
    console.log("[PASS] No active users — backfill skipped");
  }

  // Check 5: role_training_rules covers all 9 role slugs
  // 8 non-employee roles have explicit rules; employee is covered via the universal
  // is_universal=true track which assigns to all new users at creation time.
  const EXPECTED_NON_EMPLOYEE_ROLES = ["super_admin", "admin", "hr", "finance", "operations", "manager", "recruiter", "executive"];
  const rules = await db.select({ roleSlug: roleTrainingRules.roleSlug }).from(roleTrainingRules);
  const coveredRoles = new Set(rules.map((r) => r.roleSlug));
  const missingRules = EXPECTED_NON_EMPLOYEE_ROLES.filter((r) => !coveredRoles.has(r));
  const ok5 = missingRules.length === 0;
  console.log(`[${ok5 ? "PASS" : "FAIL"}] role_training_rules covers all 8 explicit role slugs: missing=${JSON.stringify(missingRules)}`);
  console.log(`[INFO] 'employee' role is covered via the universal Platform Fundamentals track (is_universal=true), not via role_training_rules`);
  if (!ok5) allPassed = false;

  console.log("\n=== SEED COMPLETE ===");
  if (!allPassed) {
    console.error("\nSome validation checks FAILED. Review the output above.");
    process.exit(1);
  } else {
    console.log("\nAll checks PASSED.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed with error:", err);
  process.exit(1);
});
