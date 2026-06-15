-- ============================================================================
-- Production seed script — plan_goal_templates
-- Tasks: #389 (DB-driven role dropdown) + #390 (fill missing/thin templates)
-- Generated: June 2026
--
-- Safe to run multiple times:
--   • UPDATEs only overwrite the specific rows listed (matched by plan_type +
--     role_slug + goal_title) so any rows an admin already edited differently
--     are unaffected.
--   • INSERTs use ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING
--     so existing rows are never duplicated.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 — Correct PIP target_metrics to exactly match the uploaded doc
--           "Hirein Healthcare PIP Plans by Role"
-- ============================================================================

-- ── Associate Recruiter PIP ──────────────────────────────────────────────────
UPDATE plan_goal_templates
SET target_metric = 'Minimum 40-60 qualified outreach attempts per working day, based on assigned roles and portal availability'
WHERE plan_type = 'pip' AND role_slug = 'associate_recruiter'
  AND goal_title = 'Achieve minimum daily outreach target';

UPDATE plan_goal_templates
SET target_metric = 'Minimum 4-6 completed candidate screens per working day'
WHERE plan_type = 'pip' AND role_slug = 'associate_recruiter'
  AND goal_title = 'Complete minimum daily phone screens';

UPDATE plan_goal_templates
SET target_metric = 'Minimum 4-6 manager-approved, complete, and relevant submissions per week'
WHERE plan_type = 'pip' AND role_slug = 'associate_recruiter'
  AND goal_title = 'Achieve qualified submissions per week';

UPDATE plan_goal_templates
SET target_metric = '95%+ same-day updates for candidate status, notes, follow-ups, RTR, and submission details'
WHERE plan_type = 'pip' AND role_slug = 'associate_recruiter'
  AND goal_title = 'Maintain ATS logging accuracy';

-- ── Senior Recruiter PIP ─────────────────────────────────────────────────────
UPDATE plan_goal_templates
SET target_metric = 'Minimum 50-75 qualified outreach attempts per working day'
WHERE plan_type = 'pip' AND role_slug = 'senior_recruiter'
  AND goal_title = 'Achieve minimum daily outreach';

UPDATE plan_goal_templates
SET target_metric = 'Minimum 5-8 completed candidate screens per working day'
WHERE plan_type = 'pip' AND role_slug = 'senior_recruiter'
  AND goal_title = 'Complete minimum weekly phone screens';

UPDATE plan_goal_templates
SET target_metric = 'Minimum 6-8 complete, accurate, and relevant submissions per week'
WHERE plan_type = 'pip' AND role_slug = 'senior_recruiter'
  AND goal_title = 'Restore weekly submission volume';

UPDATE plan_goal_templates
SET target_metric = 'Minimum 1 offer-stage or start-ready candidate during the PIP period, where job flow allows'
WHERE plan_type = 'pip' AND role_slug = 'senior_recruiter'
  AND goal_title = 'Achieve placement rate recovery';

UPDATE plan_goal_templates
SET target_metric = '98% same-day accuracy for submissions, RTR, follow-ups, interview status, and onboarding notes'
WHERE plan_type = 'pip' AND role_slug = 'senior_recruiter'
  AND goal_title = 'Maintain ATS compliance and accuracy';

-- ── Lead Recruiter PIP ───────────────────────────────────────────────────────
UPDATE plan_goal_templates
SET target_metric = 'Maintain agreed personal recruiter output if the role carries individual requisitions; personal production standard must not fall below minimum while team oversight is active'
WHERE plan_type = 'pip' AND role_slug = 'lead_recruiter'
  AND goal_title = 'Restore personal outreach and screening metrics';

UPDATE plan_goal_templates
SET target_metric = 'Zero preventable duplicate or RTR-related errors after PIP start; 100% QC of assigned team submissions before client/VMS submission where required'
WHERE plan_type = 'pip' AND role_slug = 'lead_recruiter'
  AND goal_title = 'Recover strategic placement cadence';

UPDATE plan_goal_templates
SET target_metric = 'Minimum 2 documented coaching sessions per week with assigned recruiters; minimum 2 structured pipeline aging reviews per week; coaching notes logged and shared'
WHERE plan_type = 'pip' AND role_slug = 'lead_recruiter'
  AND goal_title = 'Improve team submission-to-interview conversion';

UPDATE plan_goal_templates
SET target_metric = '95%+ daily accuracy across assigned team pipeline; team tracker updated same-day; ATS compliance verified weekly by manager or lead'
WHERE plan_type = 'pip' AND role_slug = 'lead_recruiter'
  AND goal_title = 'Maintain 100% ATS compliance and update team playbooks';

-- ── Associate Manager PIP ────────────────────────────────────────────────────
UPDATE plan_goal_templates
SET target_metric = '100% of direct reports with active goals and documented check-ins; all recruiter performance gaps identified and corrected within same PIP window'
WHERE plan_type = 'pip' AND role_slug = 'associate_manager'
  AND goal_title = 'Restore structured direct-report performance oversight';

UPDATE plan_goal_templates
SET target_metric = 'Team achieves agreed placement target improvement during PIP; individual recruiter gaps documented and addressed within 1 week of identification'
WHERE plan_type = 'pip' AND role_slug = 'associate_manager'
  AND goal_title = 'Return team to placement quota';

UPDATE plan_goal_templates
SET target_metric = '100% active roles categorized by urgency and ownership each working day; 95%+ clean submission standard; daily review of recruiter activity and submissions'
WHERE plan_type = 'pip' AND role_slug = 'associate_manager'
  AND goal_title = 'Improve team outreach and submission volume';

UPDATE plan_goal_templates
SET target_metric = '100% of escalations logged and resolved within same business day; weekly pipeline report delivered proactively; minimum 3 documented coaching/correction actions per week'
WHERE plan_type = 'pip' AND role_slug = 'associate_manager'
  AND goal_title = 'Implement structured escalation and ATS audit process';

-- ── Account Manager PIP ──────────────────────────────────────────────────────
UPDATE plan_goal_templates
SET target_metric = '95%+ complete intake for all active roles: title, location, schedule, pay/rate, must-haves, credentials, submission rules, and client contact path'
WHERE plan_type = 'pip' AND role_slug = 'account_manager'
  AND goal_title = 'Recover at-risk client fill rate';

UPDATE plan_goal_templates
SET target_metric = 'Same business day response to all active client/MSP/VMS communications; minimum 2-3 meaningful follow-ups per active account per week'
WHERE plan_type = 'pip' AND role_slug = 'account_manager'
  AND goal_title = 'Improve client communication SLA';

UPDATE plan_goal_templates
SET target_metric = 'Weekly briefing to delivery team covering priorities, client feedback, and stuck items; feedback collected within 24-48 hours on submissions, interviews, and offers'
WHERE plan_type = 'pip' AND role_slug = 'account_manager'
  AND goal_title = 'Rebuild client pipeline and requisition volume';

UPDATE plan_goal_templates
SET target_metric = 'Weekly account risk log maintained for aging roles, low rates, falloffs, and client dissatisfaction; identify at least 1-2 expansion or additional requirement opportunities during PIP'
WHERE plan_type = 'pip' AND role_slug = 'account_manager'
  AND goal_title = 'Ensure ATS accuracy for all managed requisitions';


-- ============================================================================
-- PART 2 — Insert new goals (skips any row that already exists)
-- ============================================================================

-- ── PIP: Associate Recruiter — goal 5 ────────────────────────────────────────
INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'pip', 'associate_recruiter', 'healthcare',
  'Build interview pipeline',
  'individual',
  'Drive submitted candidates to interview stage and eliminate repeated submission errors after written coaching',
  'Minimum 2-3 interview-stage candidates during the PIP period, where client/job flow allows; no repeated submission errors after written coaching',
  5, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

-- ── PIP: Senior Recruiter — goal 6 ───────────────────────────────────────────
INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'pip', 'senior_recruiter', 'healthcare',
  'Achieve interview conversion target',
  'individual',
  'Move sufficient submitted candidates to interview and offer stage during the PIP window',
  'Minimum 4-6 interview-stage candidates during the PIP period, where client/job flow allows',
  6, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

-- ── PIP: Lead Recruiter — goal 5 ─────────────────────────────────────────────
INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'pip', 'lead_recruiter', 'healthcare',
  'Drive visible team improvement by final review',
  'team',
  'Show measurable improvement in team output, quality, and candidate movement by the PIP end date',
  'Demonstrable improvement in interview movement, candidate follow-up, submission quality, or recruiter activity by final review — confirmed by manager',
  5, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

-- ── PIP: Associate Manager — goal 5 ──────────────────────────────────────────
INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'pip', 'associate_manager', 'healthcare',
  'Drive visible delivery improvement by final review',
  'team',
  'Show measurable improvement in team delivery outcomes, starts pipeline, or recurring margin contribution by PIP end date',
  '100% same-day or next-business-day follow-up on active interview, offer, onboarding, and start items; visible improvement in team output and starts pipeline by final review',
  5, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

-- ── PIP: Account Manager — goal 5 ────────────────────────────────────────────
INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'pip', 'account_manager', 'healthcare',
  'Drive account growth and expansion',
  'individual',
  'Identify and pursue expansion, vendor, or additional requirement opportunities with managed accounts during PIP',
  'Identify at least 1-2 expansion, vendor, or additional requirement opportunities during the PIP period; document in account plan and share with delivery team',
  5, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

-- ── PIP: Foundation → Senior Recruiter — all 6 goals (new role) ──────────────
INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'pip', 'foundation_to_senior', 'healthcare',
  'Achieve senior-level daily outreach target',
  'individual',
  'Reach the senior recruiter outreach standard required for the foundation-to-senior transition benchmark',
  'Minimum 50-75 qualified outreach attempts per working day — this is the senior standard; consistent effort is required throughout the PIP period',
  1, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'pip', 'foundation_to_senior', 'healthcare',
  'Complete minimum daily candidate screens',
  'individual',
  'Conduct required daily candidate phone screens to build an interview-ready pipeline',
  'Minimum 5-8 completed candidate screens per working day',
  2, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'pip', 'foundation_to_senior', 'healthcare',
  'Achieve weekly quality submission standard',
  'individual',
  'Submit fully verified, quality candidates every week — no unconfirmed or low-commitment candidates',
  'Minimum 6-8 complete, accurate, and relevant submissions per week; each submission must have availability, pay, location, and commitment confirmed',
  3, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'pip', 'foundation_to_senior', 'healthcare',
  'Achieve interview and conversion movement',
  'individual',
  'Drive candidates from submission to interview and offer stages and prove conversion capability',
  'Minimum 4-6 interview-stage candidates during the PIP period; minimum 1 offer-stage or start-ready candidate, where client/job flow allows',
  4, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'pip', 'foundation_to_senior', 'healthcare',
  'Maintain ATS and tracker accuracy',
  'individual',
  'Keep all candidate records, notes, and tracker fully updated same-day throughout the PIP',
  '98% same-day accuracy for submissions, RTR, follow-ups, interview status, and candidate notes; weekly tracker submitted proactively every Friday without manager follow-up',
  5, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'pip', 'foundation_to_senior', 'healthcare',
  'Demonstrate confidentiality and trust — no violations',
  'individual',
  'Maintain full discretion on all internal company matters throughout the PIP period',
  'Zero incidents of sharing internal tools, sourcing strategy, client approach, business plans, or team matters outside the company without manager approval during the PIP',
  6, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

-- ── Probation: Foundation → Senior Recruiter — all 5 goals (new role) ────────
INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'probation', 'foundation_to_senior', 'healthcare',
  'Complete onboarding training and policy acknowledgements',
  'individual',
  'Finish all mandatory policy training and tool access setup as documented in the onboarding plan',
  'All 9 policy areas acknowledged by Day 2; tool training (CEIPAL, SignalHire, Zoom, KlerHire.ai, ProKred) completed by Day 3; controlled production approved by manager by Day 4',
  1, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'probation', 'foundation_to_senior', 'healthcare',
  'Build initial pipeline and quality submissions under manager review',
  'individual',
  'Establish active candidate pipeline and begin quality submissions with manager review before external submission',
  'Minimum 10-15 quality submissions during probation with all candidate verification fields completed; manager-reviewed before submission for first 2 weeks; 15+ active candidates pipelined by Day 30',
  2, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'probation', 'foundation_to_senior', 'healthcare',
  'Demonstrate ATS and sourcing tool mastery',
  'individual',
  'Maintain accurate, complete ATS records and demonstrate proficiency with all assigned sourcing tools',
  '95%+ same-day ATS compliance for candidate notes, status, RTR, follow-up dates, and submission records; manager-verified ATS accuracy by Day 30',
  3, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'probation', 'foundation_to_senior', 'healthcare',
  'Establish sourcer coordination and desk ownership',
  'individual',
  'Begin directing sourcers and demonstrate proactive desk ownership from Day 10 onward — no repeated chasing from manager required',
  'Daily sourcing priorities provided to sourcers from Day 10; weekly sourcer output reviewed and documented; manager confirms independent desk direction without prompting by Day 60',
  4, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'probation', 'foundation_to_senior', 'healthcare',
  'Maintain confidentiality and professional conduct throughout probation',
  'individual',
  'Uphold full confidentiality and professional conduct standards per the Code of Conduct and NDA from Day 1',
  'Zero policy violations; no external sharing of internal tools, strategy, or business information; full adherence to Code of Conduct, NDA, and data security standards throughout probation',
  5, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

-- ── Growth: Associate Recruiter — goals 3-5 ──────────────────────────────────
INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'associate_recruiter', 'healthcare',
  'Achieve first independent placement',
  'production',
  'Close a clean PO/start without manager-led submission assistance; candidate starts and bills for minimum 30 days',
  'First clean PO/start confirmed with candidate starts, bills, and remains committed for minimum 30 days; PO confirmation and retention status documented',
  3, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'associate_recruiter', 'healthcare',
  'Improve submission-to-interview conversion rate',
  'production',
  'Drive submitted candidates to interview stage and reduce submission rejection rate',
  'Minimum 2-3 interview-stage candidates achieved during growth plan window; submission rejection rate reduces vs. pre-plan baseline',
  4, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'associate_recruiter', 'healthcare',
  'Demonstrate ATS mastery and reporting discipline',
  'individual',
  'Maintain 98%+ ATS accuracy and proactive weekly reporting throughout the growth plan',
  'ATS accuracy at 98%+ for entire growth period; weekly tracker submitted proactively without manager follow-up; zero same-day logging gaps',
  5, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

-- ── Growth: Senior Recruiter — goals 3-5 ─────────────────────────────────────
INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'senior_recruiter', 'healthcare',
  'Achieve placement volume target',
  'production',
  'Close a minimum number of clean, retained placements during the growth plan period',
  'Minimum 2 clean POs/starts during growth plan; strong performance is 3+; all starts billed and retained for 30+ days; PO and retention status documented',
  3, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'senior_recruiter', 'healthcare',
  'Improve candidate follow-up and falloff prevention',
  'individual',
  'Follow up all submitted candidates consistently and prevent avoidable falloffs throughout the plan',
  'All submitted candidates followed up 2x/week; zero avoidable falloffs due to missed follow-up or screening gaps; risk log maintained for active candidates',
  4, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'senior_recruiter', 'healthcare',
  'Build repeatable pipeline and conversion discipline',
  'production',
  'Sustain strong submission volume and track rejections to improve conversion strategy over time',
  '6-8 quality submissions/week sustained for final 4 weeks of plan; rejection reasons tracked and strategy adjusted weekly with documented action plan',
  5, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

-- ── Growth: Lead Recruiter — goals 3-5 ───────────────────────────────────────
INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'lead_recruiter', 'healthcare',
  'Elevate team submission quality and reduce rejection rate',
  'team',
  'Coach team to reduce submission rejection rate and eliminate preventable errors',
  'Team submission rejection rate reduces by minimum 15% vs. pre-plan baseline; zero duplicate or RTR errors under lead oversight during growth plan',
  3, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'lead_recruiter', 'healthcare',
  'Build and maintain structured team pipeline review cadence',
  'team',
  'Conduct regular pipeline aging reviews to ensure all active candidates have documented next steps',
  'Weekly pipeline aging reviews documented for entire growth plan; no active candidate silent for more than 5 business days; all aging candidates with updated next steps',
  4, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'lead_recruiter', 'healthcare',
  'Demonstrate delivery leadership and proactive escalation',
  'individual',
  'Own all client/candidate blockers and escalate without prompting throughout the growth plan',
  'All client/candidate/submission blockers escalated within same business day; no issues withheld or escalated late; manager confirms independent delivery leadership at plan review',
  5, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

-- ── Growth: Associate Manager — goals 3-5 ────────────────────────────────────
INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'associate_manager', 'healthcare',
  'Drive team to achieve placement target',
  'team',
  'Ensure team meets or exceeds agreed placement quota during the growth plan period',
  'Team achieves agreed placement quota; individual recruiter performance gaps documented and corrected within 1 week of identification throughout growth plan',
  3, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'associate_manager', 'healthcare',
  'Implement and sustain delivery metrics reporting',
  'team',
  'Deliver proactive weekly reports covering full delivery pipeline for every week of the growth plan',
  'Weekly report covering submissions, interviews, offers, starts, and falloffs delivered proactively; no manager prompting required for any weekly report during growth plan',
  4, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'associate_manager', 'healthcare',
  'Demonstrate escalation ownership and quality control',
  'individual',
  'Own all delivery quality issues and escalate proactively without manager prompting throughout the growth plan',
  'All client/candidate/quality issues escalated within same business day; zero quality gaps reaching client without manager awareness; 100% same-day follow-up on active interview, offer, and start items',
  5, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

-- ── Growth: Account Manager — goals 3-5 ──────────────────────────────────────
INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'account_manager', 'healthcare',
  'Increase active requirement intake and account scope',
  'production',
  'Open new or expanded requirements from managed accounts and document expansion opportunities',
  'Minimum 2 new or expanded requirements opened under account manager ownership during growth plan; all expansion opportunities documented in account plan',
  3, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'account_manager', 'healthcare',
  'Build structured client communication cadence',
  'individual',
  'Maintain consistent, documented client touchpoints across all active accounts throughout the growth plan',
  '2-3 documented client touchpoints per active account per week for entire growth plan; client satisfaction maintained with zero unresolved escalations at time of review',
  4, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

INSERT INTO plan_goal_templates
  (plan_type, role_slug, department_scope, goal_title, goal_category, goal_description, target_metric, sort_order, is_active)
VALUES (
  'growth', 'account_manager', 'healthcare',
  'Deliver weekly delivery team briefing consistently',
  'team',
  'Brief the delivery team every week without prompting, covering all priorities and client updates',
  'Weekly briefing to delivery team covering priorities, changes, client feedback, and stuck items — delivered proactively for every week of growth plan without manager prompting',
  5, true
)
ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING;

-- ============================================================================
-- PART 3 — Correct foundation_to_senior Growth PO/start targets
--           3 clean starts per month = minimum 9 across 90 days
-- ============================================================================

UPDATE plan_goal_templates
SET
  target_metric    = 'Minimum 3 clean POs or starts in the first 30 days; each placement counts only when the candidate starts, stays, and bills consistently',
  goal_description = 'Close minimum 3 clean POs or confirmed starts from the live pipeline in the first 30 days, assuming client demand remains active. A PO only counts when the candidate starts, stays, and bills consistently.'
WHERE plan_type = 'growth' AND role_slug = 'foundation_to_senior'
  AND goal_title = 'D1-30: Clean POs or starts';

UPDATE plan_goal_templates
SET
  target_metric    = 'Minimum 3 additional clean POs or starts in Days 31-60; running total of 6 clean starts by Day 60; retained billing status documented for each',
  goal_description = 'Close minimum 3 additional clean POs or confirmed starts. Running total of 6 clean starts by Day 60. Focus on retained placements where the candidate starts, stays, and bills consistently — not just initial PO receipt.'
WHERE plan_type = 'growth' AND role_slug = 'foundation_to_senior'
  AND goal_title = 'D31-60: Clean POs or starts';

UPDATE plan_goal_templates
SET
  target_metric    = 'Minimum 9 total clean POs/starts across the full 90-day plan (3 per month); strong performance = 10+; PO/start and retained billing status documented for every placement',
  goal_description = 'Reach the 90-day placement target with clean, retained starts — minimum 9 total (3 per month). Strong performance is 10+. Each placement is assessed on whether the candidate started, stayed, billed, and the client relationship remained stable.'
WHERE plan_type = 'growth' AND role_slug = 'foundation_to_senior'
  AND goal_title = 'D61-90: Total clean POs or starts — 90-day target';

COMMIT;

-- ── Verification query (run separately after the script to confirm) ────────────
-- SELECT plan_type, role_slug, COUNT(*) AS goal_count
-- FROM plan_goal_templates
-- GROUP BY plan_type, role_slug
-- ORDER BY plan_type, role_slug;
--
-- Expected result: 18 rows, each with 5-6 goals except foundation_to_senior
-- growth (19 goals). Total across all rows: 102.
