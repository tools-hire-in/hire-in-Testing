export interface PolicyAnnexure {
  key: string;
  label: string;
  title: string;
  body: string;
}

export const POLICY_ANNEXURE_KEYS = [
  "leave_policy",
  "attendance_policy",
  "code_of_conduct",
  "nda",
  "marketing_nda",
  "marketing_content_policy",
  "marketing_code_of_conduct",
  "eng_nda",
  "eng_ip",
  "eng_byod",
  "eng_data_protection",
  "eng_access_policy",
  "eng_exit_certification",
] as const;
export type PolicyAnnexureKey = typeof POLICY_ANNEXURE_KEYS[number];

export const ENGINEERING_ANNEXURE_KEYS: readonly string[] = [
  "eng_nda",
  "eng_ip",
  "eng_byod",
  "eng_data_protection",
  "eng_access_policy",
  "eng_exit_certification",
];

export const POLICY_ANNEXURES: Record<PolicyAnnexureKey, PolicyAnnexure> = {
  leave_policy: {
    key: "leave_policy",
    label: "Annexure A — Leave Policy",
    title: "Annexure A — Leave Policy",
    body: `Hire'in Solutions
Annexure A – Leave Policy

This Annexure sets out the Leave Policy applicable to all confirmed employees of Hire'in Solutions. Leave entitlements take effect upon successful completion of the probationary period unless otherwise stated.

1. EARNED LEAVE (EL)
Entitlement: 15 days per calendar year.
Accrual: EL accrues at the rate of 1.25 days per completed calendar month. Accrual commences from the first day of the month immediately following successful completion of the probation period.
During Probation: No EL accrues and no EL may be applied for or taken during the probationary period.
Carry-Forward: Unused EL up to a maximum of 15 days may be carried forward to the following calendar year. Any balance in excess of the carry-forward cap will lapse on 31 December each year.
Bonus Month Accrual: In recognition of tenure, employees who complete a full calendar year of service without taking leave in the months of January and July shall receive a bonus accrual of 1.25 days in those respective months.

2. SICK LEAVE (SL)
Entitlement: 8 days per calendar year.
Accrual: SL accrues at approximately 0.67 days per completed calendar month post-probation.
Medical Certificate: A medical certificate from a registered medical practitioner may be required for any absence exceeding two (2) consecutive days.
Carry-Forward: Sick Leave does not carry forward. Any unused SL balance lapses at the end of each calendar year.

3. EMERGENCY LEAVE
Entitlement: 3 days per calendar year (flat grant, not accrual-based).
Availability: Becomes available upon confirmation (after successful completion of probation).
Carry-Forward: Emergency Leave does not carry forward and lapses at the year-end.
Approval: Subject to prior manager approval except in genuine emergencies, in which case the employee must notify the reporting manager at the earliest opportunity.

4. LEAVE WITHOUT PAY (LWP)
Once all applicable leave balances (EL, SL, and Emergency Leave) have been exhausted, any further approved absence will be treated as Leave Without Pay.
LWP days result in a proportional deduction from the monthly salary for the period of absence.
LWP requires manager and HR approval and is reflected in the payroll for the relevant month.

5. WEEKEND AND HOLIDAY EXCLUSION
Saturdays, Sundays, and declared public holidays falling within a leave period are treated as non-working days and are excluded from the leave day count.

6. LEAVE APPLICATION
All leave requests must be submitted through the employee self-service portal with at least 24 hours' advance notice for planned leave, except in cases of emergency.
Leave is subject to manager approval and business requirements. Approved leave may be recalled in exceptional business circumstances with appropriate notice.

7. YEAR-END LAPSE
On 31 December each year, all SL balances and any EL in excess of the carry-forward cap are forfeited. Employees are encouraged to utilise their leave entitlements during the calendar year.

8. MATERNITY AND PATERNITY LEAVE
Maternity Leave: Female employees are entitled to Maternity Leave in accordance with the Maternity Benefit Act, 1961, as amended. Eligibility and duration are governed by applicable law.
Paternity Leave: As per Company policy communicated separately.

9. AMENDMENT
The Company reserves the right to amend this Leave Policy at any time, subject to applicable law. Employees will be notified of any changes through the HR portal.`,
  },

  attendance_policy: {
    key: "attendance_policy",
    label: "Annexure B — Attendance & Regularization Policy",
    title: "Annexure B — Attendance & Regularization Policy",
    body: `Hire'in Solutions
Annexure B – Attendance & Regularization Policy

This Annexure sets out the Attendance and Regularization Policy applicable to all employees of Hire'in Solutions.

1. STANDARD WORKING HOURS
Standard working hours are 8 hours per day, 5 days per week.
Working days, shift timing, and schedule are not fixed and will be aligned to the client/project the employee is serving and the prevailing business requirements. Specific shift details will be communicated by the Company and may be adjusted from time to time based on client and business needs.
Employees are expected to be available and productive for the full duration of their assigned shift unless a different schedule is approved in writing by HR.

2. ATTENDANCE RECORDING
Employees must record attendance by punching in and out each working day via the designated HR portal or application.
Punch-In Window: Employees should punch in within 15 minutes of their scheduled shift start time. A punch-in after this window is recorded as a late arrival.
Punch-Out: Employees must punch out at the end of their shift. Failure to punch out on two or more occasions in a calendar month may attract an attendance warning.

3. LATE ARRIVALS AND EARLY DEPARTURES
Late Arrivals: Arriving more than 15 minutes after the scheduled start time is considered a late mark.
Threshold: Accumulation of 3 or more late marks in a calendar month may result in half a day's LWP for each additional late mark beyond the threshold, at HR's discretion.
Early Departures: Leaving before completing 6 hours of the scheduled shift without prior manager approval is treated as a half-day absence.

4. REGULARIZATION OF ATTENDANCE
If an employee is unable to punch in or out due to a technical issue or approved work-from-client location, the employee must apply for Attendance Regularization within 3 working days of the missed punch.
Regularization requests submitted after 3 working days may be denied.
Regularization requests require manager approval and are subject to HR review.

5. MANAGER APPROVAL FLOW
Attendance regularization requests are routed to the employee's reporting manager for approval.
The manager must approve or reject the request within 2 working days of receipt.
Approved regularizations are reflected in the payroll for the relevant month.

6. BREAKS
Employees are entitled to the following breaks per shift:
  - Lunch Break: One (1) break of up to 30 minutes.
  - Tea/Refresh Break: Two (2) breaks of up to 15 minutes each.
Break time is not counted toward the 8-hour working requirement. Excessive or extended breaks beyond the permitted limits will be noted and may be treated as idle time.

7. ATTENDANCE THRESHOLDS AND DISCIPLINARY ACTION
An employee who is absent without leave (AWOL) for 2 or more consecutive working days without prior notification or manager approval will receive a formal notice.
An employee who is absent without authorized leave for 5 or more working days in a calendar month may be subject to disciplinary action, including a show-cause notice or termination.
Repeated attendance violations are grounds for escalation under the Code of Conduct.

8. REMOTE WORK ATTENDANCE
Employees working remotely are subject to the same punch-in/punch-out requirements via the HR portal. Physical presence at a registered office is not required for attendance recording unless specifically mandated.

9. AMENDMENT
The Company reserves the right to amend this Attendance Policy at any time. Employees will be notified of any changes through the HR portal.`,
  },

  code_of_conduct: {
    key: "code_of_conduct",
    label: "Annexure C — Code of Conduct",
    title: "Annexure C — Code of Conduct",
    body: `Hire'in Solutions
Annexure C – Code of Conduct
Applicable to: Employees, recruiters, sourcers, managers, consultants, contractors, trainees, interns, vendors, subcontractors, and any person working for or on behalf of Hire'in Solutions.

1. Purpose

Hire'in Solutions is built on trust, disciplined delivery, confidentiality, accountability, and long-term client and candidate relationships. This Code of Conduct defines the professional standards expected from every team member representing Hire'in Solutions in commercial staffing, healthcare staffing, IT staffing, state/MSP/VMS programs, executive search, recruitment delivery, HR operations, sales, account management, and internal business functions.

At Hire'in Solutions, delivery is the core discipline. Strong delivery, quality submissions, clean documentation, confidentiality, and respectful communication are expected from every team member. The Company believes that when delivery, trust, and ownership are protected, business growth will follow.

2. Core Principles

Every team member is expected to follow these principles:

Integrity First – Be truthful, transparent, and professional in all communications with candidates, clients, MSPs, vendors, internal teams, and leadership.
Delivery Ownership – Take responsibility for assigned work, deadlines, submissions, follow-ups, documentation, and handovers.
Confidentiality by Default – Treat all business, client, candidate, pricing, strategy, and internal company information as confidential unless authorized otherwise.
Quality Over Noise – Submit only qualified, properly screened, interested, available, and accurately represented candidates.
Respect and Professionalism – Maintain respectful conduct with colleagues, candidates, clients, vendors, partners, and leadership.
Compliance and Documentation – Follow client, MSP, VMS, healthcare, state, and internal process requirements carefully.
Accountability Without Excuses – Communicate issues early, document status clearly, and escalate blockers before they impact delivery.

3. Professional Conduct

Team members must:

Communicate professionally through approved Company channels.
Use clear, respectful, and business-appropriate language.
Be responsive to assigned work, client updates, candidate updates, and leadership requests.
Maintain accurate notes, candidate status, submission records, interview updates, offer updates, start-date updates, and handover documentation.
Avoid gossip, internal politics, rumor-spreading, blame-shifting, or behavior that damages team trust.
Protect Hire'in's reputation in all client, candidate, vendor, online, social media, and public interactions.
Never misrepresent experience, compensation, client requirements, job status, candidate availability, immigration status, credential status, location, or start-date readiness.

4. Candidate Handling Standards

Candidates must be treated with honesty, dignity, and professionalism. Recruiters and team members must:

Accurately explain role requirements, location, shift, duration, employment type, pay expectations, compliance requirements, and submission process.
Obtain candidate consent before submission where required.
Avoid duplicate submissions unless approved and clearly documented.
Do not pressure candidates to accept roles using misleading information.
Do not submit fake, recycled, incomplete, or unverified profiles.
Do not edit candidate resumes in a misleading way.
Do not falsify skills, credentials, employment dates, licenses, certifications, work authorization, references, or availability.
Keep candidate personal information secure and use it only for legitimate business purposes.
Maintain proper candidate communication notes and follow-up history.

5. Client, MSP, VMS, and Partner Conduct

Team members must follow all client, MSP, VMS, vendor, and program-specific rules. This includes:

Submission limits and format requirements.
Candidate ownership and right-to-represent rules.
Communication cadence and escalation path.
Rate, margin, pay package, and contract term confidentiality.
Credentialing and documentation requirements.
Interview coordination, offer coordination, onboarding, and start-date follow-through.
No direct communication with client contacts where prohibited by MSP/VMS rules.
No bypassing approved channels for personal advantage or unauthorized business gain.

Team members must not promise delivery, rates, candidate availability, joining dates, compliance clearance, or client approval unless confirmed and documented.

6. Equal Opportunity and Non-Discrimination

Hire'in Solutions is committed to fair, merit-based recruiting and employment practices. Employment agencies and staffing firms may not discriminate in referral practices or honor discriminatory client preferences.

Team members must not discriminate against employees, applicants, candidates, consultants, contractors, or referrals based on protected characteristics under applicable law, including race, color, religion, sex, pregnancy, national origin, age, disability, genetic information, or other legally protected status. The EEOC is responsible for enforcing federal laws that prohibit employment discrimination.

Team members must immediately escalate any client or internal request that appears discriminatory, unlawful, unethical, unsafe, or inconsistent with Hire'in standards.

7. Anti-Harassment, Respect, and Non-Retaliation

Hire'in Solutions does not tolerate harassment, bullying, intimidation, retaliation, threats, abusive language, sexual harassment, or hostile conduct. Employers are encouraged to prevent and correct unlawful harassment through clear policies, complaint processes, training, and prompt corrective action.

No employee or contractor may retaliate against anyone for raising a concern, reporting misconduct, participating in an investigation, refusing to follow an unlawful instruction, or exercising protected legal rights. The EEOC identifies retaliation as unlawful when an adverse action is taken because someone asserted protected EEO rights.

8. Healthcare, Credentialing, and Compliance Conduct

For healthcare staffing, team members must apply extra care because candidate documents, licenses, certifications, immunizations, background information, onboarding forms, and client requirements may involve sensitive personal or compliance-related information.

Team members must:

Verify role-specific license and certification requirements before submission where applicable.
Track credential expiration dates and missing documentation carefully.
Never alter or fabricate licenses, certifications, references, immunization records, skills checklists, background forms, or compliance documents.
Protect candidate personally identifiable information and any protected health information if received.
Follow HIPAA-related, client-specific, MSP-specific, and state program requirements where applicable. HHS provides HIPAA training and resources for professionals, and HIPAA business associate rules may apply when an entity performs functions involving protected health information.

9. State, Government, and Public Sector Program Conduct

For state, government, VMS, MSP, and public-sector programs, team members must maintain strict documentation discipline. This includes:

Accurate submission data.
Approved rate/pay information only.
No side agreements or unauthorized promises.
No falsified documents.
No gifts, kickbacks, referral payments, or personal benefits to influence submissions, awards, interviews, hiring, onboarding, approvals, or payments.
Proper handling of government-related communications, security rules, and program requirements.

Any suspected fraud, false claim, document manipulation, rate manipulation, candidate misrepresentation, or compliance concern must be escalated immediately.

10. Communication and Approved Channels

Team members must use approved Company communication systems for official work, including Company email, ATS/CRM, Teams, approved VOIP/SMS systems, VMS portals, and approved reporting tools.

Important business instructions, candidate status, client feedback, rate updates, submissions, interview details, onboarding notes, start dates, and handover details must be documented in the appropriate system. Verbal or informal communication alone is not sufficient for business-critical updates.

Use of personal email, personal storage drives, unauthorized WhatsApp groups, personal phone exports, or private databases for Company work is not allowed unless expressly approved in writing.

11. Attendance, Availability, and Responsiveness

Team members are expected to maintain agreed working hours, availability, and responsiveness based on their role, shift, and business need.

Team members must:

Be available during assigned work hours.
Inform the reporting manager/HR in advance for leaves, emergencies, or schedule conflicts.
Avoid unexplained absence, inactivity, or delayed communication.
Maintain proper work logs, status updates, and handover notes.
Attend required meetings, training, compliance reviews, and client/recruitment updates.
Respond promptly to priority client, candidate, MSP, VMS, and internal escalation matters.

12. Conflicts of Interest

Team members must avoid any personal, financial, or outside business interest that conflicts with Hire'in Solutions.

Without written approval, team members may not:

Work for a competing staffing/recruiting firm while employed or engaged with Hire'in.
Submit Hire'in candidates to outside clients for personal gain.
Use Hire'in client/job/candidate data for another business.
Accept personal payments, gifts, favors, referral cuts, or benefits from candidates, vendors, clients, or competitors.
Route candidates, clients, job orders, or business opportunities away from Hire'in.
Conduct personal business using Company tools, databases, email, portals, or contacts.

13. Use of Company Systems and Property

Company systems, tools, databases, candidate lists, job orders, client records, portal access, templates, business documents, email accounts, phone systems, AI tools, and internal playbooks are provided only for authorized Company business.

Team members must not:

Share passwords or access credentials.
Export data without approval.
Download candidate/client databases to personal devices.
Copy confidential files to personal cloud storage.
Use Company tools for unauthorized personal work.
Disable security controls.
Access data outside their role or business need.
Continue accessing systems after resignation, termination, role change, or authorization removal.

14. Social Media and Public Representation

Team members must not speak publicly on behalf of Hire'in Solutions unless authorized. This includes LinkedIn, job boards, forums, WhatsApp groups, Facebook groups, Reddit, public comments, vendor platforms, and industry communities.

Team members must not disclose client names, candidate details, internal rates, margins, submission strategies, screenshots, business disputes, employee matters, internal policies, confidential documents, or leadership discussions on social media or public platforms.

15. Leadership, Founder, and Business Planning Confidentiality

Because Hire'in is a growing company, team members may hear or participate in discussions involving future strategy, client development, pricing models, hiring plans, product ideas, AI tools, partnerships, financial decisions, internal restructuring, incentive plans, candidate ownership, vendor terms, and leadership decisions.

All such discussions are confidential. Team members must not share, discuss, forward, screenshot, summarize, or use this information outside approved Company purposes.

16. Reporting Concerns

Team members are expected to report concerns in good faith, including suspected misconduct, harassment, discrimination, fraud, falsification, data breach, compliance violation, conflict of interest, client/candidate mistreatment, safety concern, or unauthorized data use.

Reports may be made to HR, the reporting manager, senior leadership, or the Founder/CEO. Retaliation for good-faith reporting is prohibited.

17. Disciplinary Action

Violation of this Code of Conduct may result in corrective action, written warning, loss of system access, reassignment, suspension, termination of employment/engagement, withholding of discretionary benefits or incentives where permitted by law and policy, legal action, or reporting to appropriate authorities where required.

The Company may consider the severity of the issue, intent, impact, prior conduct, client/candidate harm, compliance risk, confidentiality breach, and business damage when determining action.

18. Acknowledgment

I acknowledge that I have read, understood, and agree to comply with the Hire'in Solutions Code of Conduct. I understand that compliance with this Code is a condition of my employment/engagement and that violations may result in disciplinary action, up to and including termination and legal action where applicable.`,
  },

  nda: {
    key: "nda",
    label: "Annexure D — Confidentiality & Non-Disclosure Agreement",
    title: "Annexure D — Confidentiality & Non-Disclosure Agreement",
    body: `Hire'in Solutions
Annexure D – Confidentiality and Non-Disclosure Agreement
Applicable to: Employees, recruiters, sourcers, managers, contractors, consultants, interns, trainees, vendors, subcontractors, and any person working for or on behalf of Hire'in Solutions.

1. Purpose

During employment or engagement with Hire'in Solutions, the individual may receive, access, create, discuss, process, or become aware of confidential, proprietary, sensitive, or trade secret information belonging to Hire'in Solutions, its affiliates, clients, candidates, employees, vendors, MSP/VMS partners, subcontractors, or business partners.

This Agreement is intended to protect Hire'in Solutions' confidential information, trade secrets, client relationships, candidate relationships, business strategies, pricing, delivery processes, technology, data, and reputation.

This Agreement does not create a non-compete and does not prevent any individual from engaging in lawful employment or business activity after separation, subject to the continuing obligation not to use or disclose Hire'in Solutions' confidential information, trade secrets, or protected data.

2. Definition of Confidential Information

"Confidential Information" includes any non-public information, whether written, verbal, electronic, visual, digital, operational, strategic, financial, technical, or business-related, including but not limited to:

A. Client, MSP, VMS, and Partner Information
Client names, client contacts, hiring manager details, facility details, business contacts, and program contacts.
MSP/VMS program information, login credentials, portal access, submission rules, client workflows, job order details, and escalation contacts.
Open requirements, upcoming requirements, client priorities, hiring forecasts, role calibration notes, interview feedback, and client decision-making patterns.
Client agreements, MSAs, SOWs, vendor agreements, supplier documents, pricing schedules, payment terms, service terms, and contract negotiations.
Bill rates, pay rates, markups, margins, gross margin, spread, approved rate flexibility, margin strategy, rebate/discount terms, and payment cycle information.
Client-specific submission templates, candidate packaging requirements, compliance requirements, and delivery SLAs.
Client relationship history, business development plans, account strategy, sales pipeline, negotiation approach, and partnership strategy.

B. Candidate, Applicant, and Consultant Information
Candidate names, phone numbers, email addresses, resumes, profiles, addresses, work history, references, immigration/work authorization information, compensation expectations, availability, and employment preferences.
Candidate licenses, certifications, credentialing documents, immunization records, background forms, onboarding documents, health-related records, skills checklists, interview notes, submission notes, and start-date information.
Candidate ownership records, right-to-represent records, submission history, interview status, offer status, onboarding status, fall-off risks, redeployment notes, and consultant performance notes.
Any candidate or applicant list developed, maintained, purchased, sourced, enriched, or managed by Hire'in Solutions.

C. Staffing and Recruiting Business Information
Recruiting playbooks, sourcing strategies, Boolean strings, outreach templates, call scripts, SMS scripts, email templates, rebuttal scripts, candidate engagement workflows, and follow-up cadence.
Submission strategy, screening standards, quality control checklists, recruiter productivity data, pipeline reports, aging reports, candidate status reports, and internal dashboards.
Commission plans, incentive plans, salary information, performance plans, internal targets, delivery metrics, recruiter scorecards, and department goals.
Internal client/candidate notes, job matching logic, rate negotiation strategies, candidate pay positioning, and account delivery strategy.

D. Technology, AI, Data, and Platform Information
Proprietary AI tools, prompts, automation workflows, datasets, training data, model outputs, fine-tuning approaches, and AI-generated business tools.
Internal platforms, portal login credentials, software configurations, database structures, API keys, workflow automations, and system integrations.
Internal dashboards, analytics reports, performance data, candidate sourcing tools, and business intelligence outputs.

3. Confidentiality Obligations

The individual agrees to: hold all Confidential Information in strict confidence; use Confidential Information solely for authorized Company purposes; not disclose Confidential Information to any third party without prior written authorization; take reasonable precautions to protect the secrecy of Confidential Information; and promptly notify the Company of any actual or suspected unauthorized disclosure or breach.

4. Non-Use Obligation

The individual must not use Confidential Information for any personal benefit, outside business, competing venture, personal enrichment, or any purpose other than the performance of assigned duties for Hire'in Solutions.

5. Obligations Survive Separation

Confidentiality and non-use obligations survive the end of employment or engagement and remain in effect until the information enters the public domain through no act or omission of the individual.

6. Remedies

Unauthorized disclosure or misuse of Confidential Information may cause irreparable harm. The Company may seek available legal remedies, including injunctive relief, damages, recovery of costs, disciplinary action, and termination.

7. Governing Law

This Agreement is governed by the laws applicable to the employment agreement and the jurisdiction stated therein.

Acknowledged and agreed.`,
  },

  marketing_nda: {
    key: "marketing_nda",
    label: "Annexure E — Marketing & Social Media Confidentiality, NDA & IP Agreement",
    title: "Annexure E — Marketing & Social Media Confidentiality, NDA & IP Agreement",
    body: `Hire'in Solutions
Annexure E – Marketing & Social Media Confidentiality, NDA & IP Agreement
Applicable to: All marketing, brand, social media, content, influencer, email, design, PR, campaign, and creator team members, employees, contractors, consultants, agencies, and interns working for or on behalf of Hire'in Solutions or its portfolio brands (including ProKred, Hire'in Solutions, and any associated ventures).

1. Scope of confidential information

The Team Member may access, create, process, or become aware of Confidential Information including: brand strategy, campaign plans, go-to-market plans, positioning, tone guidance, scripts, briefs, budgets, ad spend, audience targeting data, lead lists, client/candidate/partner contacts, unpublished content, creative assets, design files, performance analytics, engagement data, email lists, ad account credentials, social media account access, influencer relationships, partnership terms, pricing, and leadership/business strategy.

2. Non-disclosure and non-use

The Team Member must: hold all Confidential Information in strict confidence; use it only for authorized Company work; not disclose it to any third party, competitor, agency, or personal contact without written approval; not use it for personal brand benefit, freelance work, consulting, or competing business.

3. Platform credentials and account access

All social media accounts, advertising accounts, email platforms, CMS access, design tool accounts, and analytics platforms provided or shared are Company property. The Team Member must not share, export, screenshot, or retain any credentials, contacts, audience lists, or access after separation, and must cooperate with account recovery and access removal on request.

4. AI tools and content ownership

Any AI-generated content, prompts, outputs, automations, templates, datasets, or workflows created or used for Company purposes belong to the Company. The Team Member must not input Confidential Information, client/candidate information, credentials, internal strategy, unpublished campaign plans, private source documents, screenshots, or proprietary prompts into public AI tools, social media tools, design platforms, or third-party systems unless the Company has approved that tool and the specific use case.

5. Non-solicitation and conflict of interest

During employment/engagement and for the period permitted by applicable law after separation, the Team Member must not use Company information or relationships to solicit Company clients, candidates, employees, contractors, vendors, partners, prospects, or brand collaborators for personal or competing business purposes. The Team Member must disclose outside work, freelance projects, creator partnerships, or conflicts that may overlap with Company business, clients, campaigns, or competitors.

6. Work Product and intellectual property

All work created, developed, drafted, designed, edited, researched, conceptualized, posted, scheduled, or delivered by the Team Member for the Company is Company work product. This includes posts, captions, reels, scripts, blogs, images, campaigns, prompts, design files, templates, videos, ad copy, calendars, strategy notes, analytics reports, and derivative works.
To the fullest extent permitted by law, the Team Member assigns to the Company all rights, title, and interest in such work product, including copyrights, moral rights waivers where legally permitted, trade secrets, know-how, and other intellectual property rights. No separate payment is due for such assignment beyond agreed compensation unless required by law or a separate written agreement.

7. Portfolio use and attribution

The Team Member may not use Company work, client/candidate examples, unreleased concepts, ProKred/Hire'in strategy, analytics, screenshots, or campaign performance in any portfolio, resume case study, public post, interview assignment, freelance pitch, or personal brand content without prior written approval from the Company.

8. Return and deletion

Upon request or separation, the Team Member must return or delete all Company information, files, documents, credentials, notes, copies, drafts, screenshots, recordings, and work product from all personal devices, accounts, drives, tools, and storage locations, and certify completion if requested.

9. Non-solicitation and conflict of interest

During employment/engagement and for the period permitted by applicable law after separation, the Team Member must not use Company information or relationships to solicit Company clients, candidates, employees, contractors, vendors, partners, prospects, or brand collaborators for personal or competing business purposes. The Team Member must disclose outside work, freelance projects, creator partnerships, or conflicts that may overlap with Company business, clients, campaigns, or competitors.

10. Remedies

Unauthorized disclosure or misuse may cause serious harm. The Company may seek available remedies, including injunctive relief, recovery of damages, return/deletion of materials, disciplinary action, termination, and other remedies available under applicable law.

11. Survival

Confidentiality, IP ownership, return/deletion, non-use, portfolio restriction, and related obligations survive the end of employment/engagement.

12. Governing law

This Agreement will be governed by the laws and jurisdiction stated in the employment/engagement agreement or as determined by the Company's legal entity and applicable law. Insert final jurisdiction after counsel review: [Insert governing law and dispute forum].

Acknowledged and agreed.`,
  },

  marketing_content_policy: {
    key: "marketing_content_policy",
    label: "Annexure F — Marketing, Social Media & Content Policy",
    title: "Annexure F — Marketing, Social Media & Content Policy",
    body: `Hire'in Solutions
Annexure F – Marketing, Social Media & Content Policy

1. Policy purpose

This policy applies to all marketing, brand, social media, influencer, creator, content, PR, email, blog, website, video, design, and campaign work performed for the Company and its portfolio brands.

2. Brand and content approval rules

All external content must follow approved brand positioning, tone, values, compliance guidance, and leadership direction.
No post, campaign, article, reel, carousel, press note, ad, email, or public comment may be published without approval from the assigned reviewer or leadership.
Healthcare, staffing, credentialing, compliance, security, privacy, and SaaS claims must be reviewed carefully. Do not make unsupported legal, medical, compliance, HIPAA, TJC, security, or performance claims.
Avoid absolute statements such as "guaranteed compliance," "fully HIPAA compliant" unless approved by legal/leadership. Prefer risk-aware phrasing such as "supports audit readiness," "designed to reduce document-control risk," or "built with security-first controls."
Do not publish client, candidate, employee, recruiter, salary, placement, margin, internal performance, or private company information without written approval.

3. Content workflow

Brief: Understand objective, audience, channel, offer, CTA, brand, and approval owner.
Draft: Create original content with clear source references where factual claims are made.
Review: Submit drafts for review before posting or scheduling.
Approve: Only approved content may be published or sent.
Publish: Use approved Company accounts and approved tools only.
Measure: Track performance, engagement, reach, clicks, readership, and learnings as requested.
Archive: Maintain approved copies, campaign notes, asset links, and performance snapshots in Company-approved storage.

4. Social media account conduct

Company accounts, passwords, MFA devices, page roles, ad accounts, and analytics access must be treated as confidential and used only for approved work.
Do not change account ownership, admin roles, handles, bios, passwords, recovery email/phone, ad billing, or integrations without approval.
Do not respond to sensitive comments, complaints, legal threats, media inquiries, client disputes, candidate complaints, or security/privacy concerns without approval.
Do not delete comments, messages, posts, analytics, or campaign history unless authorized.
No personal opinions, political/religious commentary, offensive language, discriminatory content, harassment, or unapproved humor from Company accounts.

5. Personal social media and influencer activity

The Team Member may maintain personal social media accounts. However, personal accounts must not disclose Company Confidential Information, imply unauthorized representation, use Company intellectual property without approval, or discuss clients/candidates/internal plans. If Company asks the Team Member to appear in or promote content using a personal creator profile, the scope, content, approvals, usage rights, and any compensation/boosting arrangements should be documented separately.

6. AI-assisted content rules

AI may be used only for approved drafting, ideation, grammar, formatting, or research support.
Do not input Confidential Information, client/candidate data, credentials, resumes, strategy docs, pricing, internal screenshots, proprietary prompts, or unreleased product information into unapproved AI tools.
All AI-assisted content must be reviewed by a human before use. The Team Member is responsible for accuracy, originality, tone, and compliance.
Do not copy third-party copyrighted content, competitor copy, influencer scripts, or source material without permission or proper transformation and approval.

7. Content standards

Content must be truthful, professional, respectful, non-discriminatory, and aligned with Company values.
Content must not mislead candidates, clients, healthcare professionals, partners, or the public.
Use only licensed, Company-owned, approved, or properly attributed assets. Do not use random internet images, music, templates, or fonts in violation of license terms.
Avoid publishing sensitive or regulated claims without approval.
Respect privacy, confidentiality, and dignity of candidates, clients, employees, healthcare workers, and partners.

8. Violations

Violations may result in content removal, access restriction, disciplinary action, termination, legal action, or other remedies available under Company policy and applicable law.

Acknowledged and agreed.`,
  },

  marketing_code_of_conduct: {
    key: "marketing_code_of_conduct",
    label: "Annexure G — Marketing Code of Conduct, Data Security & Professional Standards",
    title: "Annexure G — Marketing Code of Conduct, Data Security & Professional Standards",
    body: `Hire'in Solutions
Annexure G – Marketing Code of Conduct, Data Security & Professional Standards

1. Professional conduct

Act with honesty, integrity, accountability, respect, and professionalism.
Represent the Company responsibly in internal and external communication.
Respect managers, team members, candidates, clients, partners, creators, and vendors.
Avoid harassment, discrimination, retaliation, bullying, intimidation, or unprofessional conduct.
Meet commitments, communicate blockers early, and maintain reliable responsiveness during working hours.

2. Security and access

Use only approved email, storage, communication, design, social media, and project tools for Company work.
Use strong passwords and MFA wherever available. Do not share passwords or OTPs.
Do not use unauthorized personal accounts, drives, WhatsApp groups, or consumer tools to store or transfer Company data.
Lock devices when away. Keep devices updated with reasonable security protections.
Immediately report phishing, suspicious links, account lockouts, lost devices, accidental disclosure, or unauthorized access.

3. Data handling

Access only information needed for assigned work.
Do not download/export bulk data unless authorized.
Do not copy sensitive information into content drafts, AI tools, personal notes, or external platforms.
Do not use client/candidate/employee data in examples, mocks, screenshots, testimonials, or case studies without written approval and required redaction/consent.
Use approved redaction or anonymization before sharing examples internally or externally.

4. Conflict of interest

The Team Member must disclose outside employment, freelance work, brand collaborations, influencer partnerships, affiliate promotions, consulting, or creator commitments that could conflict with Company work, overlap with Company clients/competitors, or affect availability, neutrality, or confidentiality.

5. Communications and approvals

Do not speak on behalf of the Company to media, clients, candidates, vendors, partners, or public audiences unless authorized.
Escalate legal, compliance, security, privacy, public relations, or candidate/client complaint matters to leadership.
Use professional written communication and avoid commitments that have not been approved.

6. Attendance, responsiveness, and remote work

The Team Member is expected to remain responsive during agreed working hours, attend scheduled meetings, update tasks, meet timelines, and communicate availability or blockers in advance. Remote work does not reduce confidentiality, productivity, conduct, or security obligations.

7. Disciplinary action

Failure to follow this Code may result in coaching, warning, access restriction, compensation review impact, termination, legal action, or other action depending on severity and applicable law.

Acknowledged and agreed.`,
  },

  eng_nda: {
    key: "eng_nda",
    label: "Annexure H — Confidentiality, Non-Disclosure & Proprietary Information Agreement",
    title: "Annexure H — Confidentiality, Non-Disclosure & Proprietary Information Agreement",
    body: `Hire'in Solutions — Engineering Pack
Annexure Eng-A: Confidentiality, Non-Disclosure & Proprietary Information Agreement
Applicable to: All engineering, software development, DevOps, QA, data, and technical personnel.

1. Purpose

This Agreement protects Hire'in Solutions' confidential and proprietary technical information, trade secrets, client data, business strategy, and intellectual property that the Engineer may access, generate, or encounter during their engagement.

2. Definition of Confidential & Proprietary Information

"Confidential Information" includes, without limitation:
— Source code, repositories, codebases, scripts, modules, libraries, APIs, SDKs, and build configurations.
— Algorithms, system architectures, data models, database schemas, query logic, and ML/AI models and prompts.
— Internal tools, automation workflows, CI/CD pipelines, infrastructure-as-code configurations, and deployment scripts.
— Client-facing and internal system credentials, API keys, tokens, secrets, environment variables, and authentication configurations.
— Product roadmaps, technical specifications, design documents, sprint plans, architecture decision records (ADRs), and internal wikis.
— Client data, candidate data, applicant records, employee data, business intelligence outputs, and analytics dashboards.
— Security controls, vulnerability assessments, penetration test findings, and incident reports.
— Vendor agreements, SaaS subscriptions, licensing terms, and commercial terms with technology providers.

3. Obligations

The Engineer agrees to:
— Hold all Confidential Information in strict confidence and take at least the same degree of care to protect it as they use for their own confidential information.
— Use Confidential Information solely for the performance of assigned duties for Hire'in Solutions.
— Not disclose Confidential Information to any third party, personal contact, or external system without explicit written authorization.
— Not copy, export, screenshot, cache, or transmit Confidential Information outside Company-approved systems.
— Promptly notify the Company of any actual or suspected unauthorized access, disclosure, or breach.

4. Exclusions

These obligations do not apply to information that: (a) is or becomes publicly known through no act of the Engineer; (b) was rightfully known to the Engineer prior to engagement and without restriction; (c) is received from a third party without restriction; or (d) must be disclosed by applicable law (with prompt prior written notice to the Company where permitted).

5. Post-Separation

All confidentiality and non-use obligations survive termination or expiry of employment/engagement and remain in effect until the information enters the public domain without fault of the Engineer.

6. Remedies

Unauthorized disclosure or misuse may cause irreparable harm. The Company may seek injunctive relief, damages, disciplinary action, and any other available legal remedy.

Acknowledged and agreed.`,
  },

  eng_ip: {
    key: "eng_ip",
    label: "Annexure I — Intellectual Property, Code Ownership & Work Product Assignment",
    title: "Annexure I — Intellectual Property, Code Ownership & Work Product Assignment",
    body: `Hire'in Solutions — Engineering Pack
Annexure Eng-B: Intellectual Property, Code Ownership & Work Product Assignment
Applicable to: All engineering, software development, DevOps, QA, data, and technical personnel.

1. Work Product Definition

"Work Product" means any and all inventions, discoveries, developments, improvements, software, code, scripts, algorithms, data models, AI/ML models, prompts, datasets, automation workflows, system designs, architecture decisions, technical documentation, research, prototypes, tools, and derivative works — whether or not patentable, copyrightable, or reduced to practice — that are:
(a) created, developed, or conceived by the Engineer (alone or jointly) during the term of employment/engagement; OR
(b) made using Company resources, systems, time, equipment, data, or Confidential Information; OR
(c) related to the Company's current or reasonably anticipated business, products, or research.

2. Assignment of Ownership

The Engineer hereby irrevocably assigns to Hire'in Solutions all rights, title, and interest in and to all Work Product, including all copyrights, patent rights, trade secret rights, moral rights (to the fullest extent waivable by law), and any other intellectual property rights worldwide. This assignment is perpetual, royalty-free, and without further consideration beyond agreed compensation.

3. Code Repositories & Commits

All code committed to Company or client repositories — including branches, forks, pull requests, and merge history — is Company Work Product. The Engineer must not: commit code containing personal projects, third-party code without proper licensing clearance, or open-source components without disclosing their license obligations to the Company.

4. Pre-Existing IP

The Engineer must disclose in writing any pre-existing inventions, code, or materials they wish to exclude from this assignment ("Prior IP"). Undisclosed Prior IP incorporated into Work Product may be treated as assigned to the Company.

5. Open Source

The Engineer must obtain written approval before incorporating any open-source code, libraries, or components into Company systems. License obligations (GPL, LGPL, AGPL, etc.) must be disclosed and reviewed before use.

6. AI-Generated Output

Any output generated using AI tools (including code, text, designs, or models) while performing Company work is Work Product and belongs to the Company. The Engineer must not use personal AI subscriptions funded by the Company to generate work stored exclusively outside Company systems.

7. Moral Rights Waiver

To the fullest extent permitted by applicable law, the Engineer waives all moral rights in Work Product in favour of the Company and its assignees and successors.

8. Further Assurances

The Engineer will, upon request, execute any documents or take any actions necessary to perfect or record the Company's ownership of Work Product, at the Company's expense.

Acknowledged and agreed.`,
  },

  eng_byod: {
    key: "eng_byod",
    label: "Annexure J — BYOD, Cloud-Only Development, Security & Data Access Policy",
    title: "Annexure J — BYOD, Cloud-Only Development, Security & Data Access Policy",
    body: `Hire'in Solutions — Engineering Pack
Annexure Eng-C: BYOD, Cloud-Only Development, Security & Data Access Policy
Applicable to: All engineering, software development, DevOps, QA, data, and technical personnel.

1. BYOD Policy

Engineers may use personal devices (laptop, desktop, mobile) for Company work subject to the following mandatory controls:
— Operating system must be maintained with current security patches and updates.
— Full-disk encryption must be enabled (BitLocker, FileVault, LUKS, or equivalent).
— Licensed antivirus/endpoint protection software must be installed and active.
— Screen-lock with password/PIN must be set to activate after a maximum of 5 minutes of inactivity.
— Personal devices used for Company work are subject to remote wipe of Company data/containers upon separation or security incident.

2. Cloud-Only Development Mandate

All development, testing, and production work must be conducted within Company-approved cloud environments, version control systems, and collaboration platforms. The Engineer must not:
— Store source code, credentials, client data, or Work Product exclusively on local device storage without a synchronized backup to an approved cloud repository.
— Run production workloads, databases, or client-facing services on personal hardware or unapproved infrastructure.
— Use personal cloud storage accounts (personal Google Drive, Dropbox, iCloud, OneDrive, etc.) to store Company code, data, credentials, or Work Product.

3. Approved Tools & Platforms

The Engineer must use only Company-approved IDEs, version control platforms, CI/CD tools, container orchestration systems, communication channels, and project management tools for work activities. Requests for new tools must be submitted to engineering leadership for approval before use.

4. Credential & Secret Management

— All credentials, API keys, tokens, secrets, and environment variables must be stored in Company-approved secrets management systems (e.g., Vault, AWS Secrets Manager, GitHub Secrets).
— Credentials must never be hard-coded in source code, committed to repositories, included in documentation, or transmitted via unencrypted channels.
— Shared or service account credentials must be rotated immediately upon any team member separation.

5. Network Security

— Personal Wi-Fi used for Company work must be secured with WPA2 or WPA3 encryption.
— Public or unsecured networks must not be used for Company work without an approved VPN.
— VPN and/or SSO must be used when accessing internal systems, admin panels, or production environments as required by the Company's security policy.

6. Data Access Controls

— Engineers must access only the data, systems, and environments required for their assigned tasks (principle of least privilege).
— Production data must not be accessed, copied, or used in development/test environments without explicit approval and appropriate anonymization.
— Access to production environments must be logged and must follow the Company's change management process.

7. Incident Reporting

Any device loss, theft, suspected breach, unauthorized access, or security incident involving Company data or systems must be reported to the IT/security team within 24 hours of discovery.

Acknowledged and agreed.`,
  },

  eng_data_protection: {
    key: "eng_data_protection",
    label: "Annexure K — Data Protection, Privacy & Client/Candidate Information Handling",
    title: "Annexure K — Data Protection, Privacy & Client/Candidate Information Handling",
    body: `Hire'in Solutions — Engineering Pack
Annexure Eng-D: Data Protection, Privacy & Client/Candidate Information Handling
Applicable to: All engineering, software development, DevOps, QA, data, and technical personnel.

1. Data Categories

The Engineer may encounter the following categories of data in the course of their work:
— Personal Data: Names, email addresses, phone numbers, addresses, dates of birth, national ID numbers (PAN, Aadhaar, SSN, etc.), passport details, and other personal identifiers.
— Candidate & Applicant Data: Resumes, employment histories, skills assessments, interview notes, compensation details, work authorization status, and onboarding records.
— Client Data: Client company information, contacts, contracts, rate information, submission records, and business correspondence.
— Sensitive Data: Financial records, health-related information, background check results, and any data classified as sensitive under applicable data protection law.
— Technical Data: System logs, audit trails, analytics, and behavioural data.

2. Data Minimization

The Engineer must access, process, and retain only the minimum data necessary to complete an assigned task. Bulk export, download, or aggregation of personal data beyond task requirements is prohibited without written authorization.

3. Development & Testing Data

Production data (real personal data) must not be used in development, testing, staging, or demonstration environments. The Engineer must use anonymized, synthetic, or mocked datasets for non-production purposes. Where production data is required for debugging, explicit written approval must be obtained and a record kept.

4. Data Retention & Disposal

The Engineer must not retain copies of personal data, client data, or candidate data beyond the period required for the assigned task. Upon task completion or separation, such data must be securely deleted from personal devices, local storage, and any unapproved systems.

5. Third-Party Data Sharing

Personal data must not be shared with third-party tools, APIs, AI services, analytics platforms, or external systems unless: (a) the Company has an approved Data Processing Agreement (DPA) with the third party; and (b) the sharing is explicitly authorized by the Company's data governance team.

6. Privacy by Design

The Engineer is expected to implement privacy-protective technical controls in all systems they design or build, including: appropriate encryption at rest and in transit; access controls and role-based permissions; audit logging for data access and modification; data retention policies enforced at the system level; and user consent mechanisms where required by applicable law.

7. Regulatory Compliance

The Engineer must be aware of applicable data protection obligations relevant to Company operations, which may include the Information Technology Act 2000 (India), the Digital Personal Data Protection Act 2023 (India), GDPR (where applicable), HIPAA (where applicable to healthcare data), and any client-specific data handling requirements communicated by the Company.

8. Breach Notification

Any actual or suspected data breach, unauthorized access, or loss of personal data must be reported to the engineering lead and compliance/security team immediately and in no case later than 24 hours after discovery.

Acknowledged and agreed.`,
  },

  eng_access_policy: {
    key: "eng_access_policy",
    label: "Annexure L — Access, Password, AI Tool & Communication Policy",
    title: "Annexure L — Access, Password, AI Tool & Communication Policy",
    body: `Hire'in Solutions — Engineering Pack
Annexure Eng-E: Access, Password, AI Tool & Communication Policy
Applicable to: All engineering, software development, DevOps, QA, data, and technical personnel.

1. Access Management

1.1 Provisioning: Access to Company systems, repositories, cloud environments, databases, admin panels, and third-party platforms is provisioned based on role and task requirements. The Engineer must not request, obtain, or retain access beyond what is required for assigned duties.

1.2 Principle of Least Privilege: The Engineer must operate with the minimum level of permissions necessary. Elevated privileges (admin, root, superuser) must be used only for specific tasks that require them and must not be retained as default access.

1.3 Shared Accounts: Sharing of individual access credentials is prohibited. Each Engineer must use their own uniquely provisioned credentials for all Company systems.

1.4 Access Review: The Engineer must cooperate with periodic access reviews and promptly respond to deprovisioning requests upon role change or separation.

2. Password & Authentication Policy

2.1 Password Complexity: All passwords for Company systems must meet the following minimum requirements: at least 12 characters; combination of uppercase, lowercase, numbers, and symbols; not reused from personal accounts or previous Company passwords.

2.2 Password Managers: Engineers are encouraged to use approved password manager tools for storing and generating strong, unique passwords. Storage of passwords in plain text (notes, spreadsheets, source code, or documentation) is prohibited.

2.3 Multi-Factor Authentication (MFA): MFA must be enabled on all accounts that support it, including: email, version control platforms, cloud provider consoles, CI/CD systems, VPNs, and any production system access. Use of SMS-based MFA is permitted but hardware tokens or authenticator apps are preferred.

2.4 Credential Rotation: Credentials must be rotated immediately upon: suspected compromise; team member separation; and periodically as required by Company security policy.

3. AI Tool Usage Policy

3.1 Approved Tools: Engineers may use AI coding assistants (e.g., GitHub Copilot, Cursor, or other Company-approved tools) subject to the conditions in this policy. Use of unapproved AI tools for Company work requires written authorization from engineering leadership.

3.2 Prohibited Inputs: Engineers must not submit the following to any AI tool (whether approved or otherwise): source code containing credentials, secrets, or tokens; personally identifiable information (PII) of candidates, clients, or employees; client data, business strategy, or proprietary algorithms; unpublished product roadmaps or architecture details; or any information classified as Confidential under this Agreement.

3.3 Output Review: All AI-generated code, logic, or content must be reviewed by the Engineer before use. The Engineer is responsible for the correctness, security, originality, and licensing compliance of AI-generated output incorporated into Work Product.

3.4 Licensing: Engineers must be aware that AI-generated code may carry licensing obligations depending on the training data. Any AI-generated output intended for production use must be reviewed for potential intellectual property conflicts.

4. Communication Policy

4.1 Approved Channels: All work-related communication must occur through Company-approved channels (e.g., Company email, approved messaging platforms, project management tools, and video conferencing tools). Use of personal email, personal WhatsApp, or unapproved platforms for business communication is prohibited.

4.2 Sensitive Information in Communication: Credentials, secrets, API keys, or personal data must not be transmitted via chat, email, or any messaging platform without encryption. Use approved secrets-sharing tools or secrets management systems for this purpose.

4.3 Code Review & Documentation: Pull requests, code reviews, technical documentation, and architecture discussions must be conducted through approved platforms and must not contain live credentials, PII, or sensitive business information.

4.4 Incident Communication: Security incidents, suspected breaches, or access anomalies must be reported immediately through the designated incident reporting channel, not via public group chats or informal messaging.

Acknowledged and agreed.`,
  },

  eng_exit_certification: {
    key: "eng_exit_certification",
    label: "Annexure M — Exit, Return, Deletion & Certification",
    title: "Annexure M — Exit, Return, Deletion & Certification",
    body: `Hire'in Solutions — Engineering Pack
Annexure Eng-F: Exit, Return, Deletion & Certification
Applicable to: All engineering, software development, DevOps, QA, data, and technical personnel.

1. Purpose

This Annexure sets out the Engineer's obligations upon the cessation of employment or engagement with Hire'in Solutions, whether by resignation, termination, contract expiry, or any other reason. Compliance with these obligations is a condition of final settlement and clearance.

2. System Access Revocation

2.1 The Engineer agrees to cooperate fully with the Company's IT/security team to facilitate the immediate revocation of all access upon separation, including:
— Version control platforms (GitHub, GitLab, Bitbucket, or equivalent).
— Cloud provider accounts (AWS, GCP, Azure, or equivalent) and their IAM roles/policies.
— CI/CD systems, container registries, and deployment pipelines.
— Databases, admin panels, internal tools, and SaaS platforms.
— VPN, SSO, and MFA-linked accounts.
— Communication platforms, project management tools, and collaboration systems.

2.2 The Engineer must not access any Company system after their last authorized working day, even if access has not yet been technically revoked.

3. Return of Company Property

The Engineer must return all Company-owned or Company-issued property within 3 working days of separation, including:
— Hardware devices (laptops, monitors, peripherals, access tokens, MFA devices).
— Physical media containing Company data or software.
— Any physical documents, printed materials, or notebooks containing Company information.
Failure to return Company property may result in cost recovery from final settlement as permitted by law.

4. Data Deletion Obligations

4.1 The Engineer must permanently delete all Company Confidential Information, Work Product, source code, credentials, client data, candidate data, and business information from:
— Personal devices (including laptops, phones, tablets, and external drives).
— Personal cloud storage accounts (Google Drive, Dropbox, iCloud, OneDrive, or equivalent).
— Personal email accounts, messaging applications, and note-taking tools.
— Any other personal or unapproved storage location.

4.2 Deletion must be performed using a secure deletion method (overwrite or equivalent) where technically feasible. Emptying the recycle bin or trash alone is not sufficient for sensitive data.

4.3 Local repositories cloned from Company version control systems must be deleted from personal devices.

5. Credential Handover

Before separation, the Engineer must:
— Transfer ownership of all Company accounts, repositories, and service accounts to the designated Company representative.
— Provide credentials or transfer administrative access for any Company-owned tools, services, or systems where the Engineer was the sole administrator.
— Remove personal SSH keys, GPG keys, and personal tokens from all Company repositories and systems.

6. Data Deletion Certificate

The Engineer must, upon request, provide a signed written declaration confirming that all Company data has been deleted from personal devices, accounts, and storage locations ("Data Deletion Certificate"). The Company may make final settlement conditional upon receipt of this Certificate.

7. Post-Separation Restrictions

The Engineer's obligations under Annexure Eng-A (Confidentiality), Annexure Eng-B (IP Assignment), and this Annexure survive the termination of employment/engagement and remain binding indefinitely with respect to Confidential Information and Work Product created during the engagement.

8. Cooperation

The Engineer agrees to cooperate with the Company during any post-separation audit, security review, or legal matter involving systems, code, or data they worked with during their engagement, for a reasonable period not to exceed 12 months.

Acknowledged and agreed.`,
  },
};

export const POLICY_ANNEXURE_LABELS: Record<PolicyAnnexureKey, string> = {
  leave_policy: "Annexure A — Leave Policy",
  attendance_policy: "Annexure B — Attendance & Regularization Policy",
  code_of_conduct: "Annexure C — Code of Conduct",
  nda: "Annexure D — Confidentiality & Non-Disclosure Agreement",
  marketing_nda: "Annexure E — Marketing & Social Media Confidentiality, NDA & IP Agreement",
  marketing_content_policy: "Annexure F — Marketing, Social Media & Content Policy",
  marketing_code_of_conduct: "Annexure G — Marketing Code of Conduct, Data Security & Professional Standards",
  eng_nda: "Annexure H — Confidentiality, Non-Disclosure & Proprietary Information Agreement",
  eng_ip: "Annexure I — Intellectual Property, Code Ownership & Work Product Assignment",
  eng_byod: "Annexure J — BYOD, Cloud-Only Development, Security & Data Access Policy",
  eng_data_protection: "Annexure K — Data Protection, Privacy & Client/Candidate Information Handling",
  eng_access_policy: "Annexure L — Access, Password, AI Tool & Communication Policy",
  eng_exit_certification: "Annexure M — Exit, Return, Deletion & Certification",
};
