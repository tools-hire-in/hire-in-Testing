export interface PolicyAnnexure {
  key: string;
  label: string;
  title: string;
  body: string;
}

export const POLICY_ANNEXURE_KEYS = ["leave_policy", "attendance_policy", "code_of_conduct", "nda"] as const;
export type PolicyAnnexureKey = typeof POLICY_ANNEXURE_KEYS[number];

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

I acknowledge that I have read, understood, and agree to comply with the Hire'in Solutions Code of Conduct. I understand that compliance with this Code is a condition of my employment/engagement and that violations may result in disciplinary action, up to and including termination and legal action where applicable.

Employee/Contractor Name: ___________________________
Signature: ___________________________
Date: ___________________________
Company Representative: ___________________________`,
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
Internal systems, ATS/CRM data, portal designs, product workflows, AI tools, automation logic, prompts, scripts, code, system architecture, technical documentation, security controls, internal product roadmaps, and operational designs.
Proprietary tools or workflows used for healthcare staffing, IT staffing, candidate credentialing, document collection, resume formatting, candidate packets, compliance tracking, analytics, or recruiter productivity.
Credentials, API keys, tokens, encryption keys, system architecture, access logs, audit logs, security procedures, and internal data protection controls.

E. Financial, Strategic, and Leadership Information
Company revenue, expenses, profit margins, payroll information, cash flow, financial projections, investor discussions, expansion plans, acquisition plans, product plans, and business model decisions.
Founder/CEO discussions, leadership strategy, internal restructuring, hiring plans, compensation philosophy, client prioritization, vendor negotiation strategy, and confidential management decisions.
Any information disclosed during management meetings, leadership meetings, internal planning sessions, HR discussions, or business review meetings.

F. HR and Employee Information
Employee records, compensation, attendance, performance reviews, disciplinary matters, resignation details, internal complaints, investigation records, leave records, medical/accommodation information, personnel files, and internal HR decisions.
Confidential information related to employees, contractors, consultants, vendors, and internal team members.

3. Confidentiality Obligations

The individual agrees to:

Use Confidential Information only for authorized Hire'in Solutions business purposes.
Protect Confidential Information with the same level of care expected from a professional staffing, recruitment, healthcare, and technology-driven organization.
Not disclose Confidential Information to any person or entity without prior written authorization.
Not copy, download, export, transfer, screenshot, photograph, forward, print, or store Confidential Information except as required for authorized business purposes.
Not use Confidential Information for personal benefit, side business, competing business, external recruiting activity, or any unauthorized purpose.
Not share Confidential Information with family members, friends, former employees, competitors, candidates, clients, vendors, or other employees who do not have a legitimate business need to know.
Maintain confidentiality during and after employment/engagement.

4. Candidate and Client Data Ownership

All client data, job order data, candidate data, applicant data, consultant data, submission records, communication records, pipeline records, candidate lists, client lists, and related business information created, received, updated, enriched, stored, or processed during employment/engagement belong exclusively to Hire'in Solutions, unless otherwise governed by a client agreement or applicable law.

The individual may not use Hire'in client or candidate information after separation for personal recruiting, competing business, outside staffing work, third-party placement activity, vendor introductions, client solicitation, candidate solicitation using confidential data, or any unauthorized commercial purpose.

5. Employment Agency Customer and Applicant Lists

To the fullest extent permitted by applicable law, Hire'in Solutions considers its employer customer lists, job order history, client contact information, candidate/applicant lists, candidate ownership records, active pipelines, submission records, and related non-public business information to be confidential and proprietary.

This clause is intended to protect confidential information and trade secrets, not to unlawfully restrict lawful work after separation.

6. Healthcare, PHI, PII, and Compliance Data

Where the individual accesses healthcare-related candidate documents, credentialing files, onboarding records, immunization records, background documents, or any protected health information or personally identifiable information, the individual must:

Access only what is necessary for the assigned business purpose.
Follow Company, client, MSP/VMS, HIPAA-related, state, and healthcare compliance requirements.
Avoid sending sensitive documents through unauthorized channels.
Never store candidate documents in personal drives, personal email, personal devices, or unauthorized systems.
Immediately report suspected data loss, misdirected emails, unauthorized downloads, accidental disclosure, system compromise, or credential misuse.

7. System Access and Security

The individual must:

Keep all passwords, access credentials, portal credentials, and authentication methods confidential.
Use only approved devices, systems, applications, and communication channels for Company work.
Not share logins or allow another person to use Company systems under their identity.
Not bypass, disable, or weaken security controls.
Not access candidate, client, employee, or Company data beyond their role or business need.
Immediately notify the Company of any suspected unauthorized access, phishing attempt, lost device, password compromise, or security incident.

8. No Unauthorized Copying or Data Removal

Without written authorization, the individual may not:

Export ATS/CRM data.
Download candidate or client lists.
Copy resumes, licenses, certifications, or credentialing packets to personal folders.
Transfer files to personal email, personal cloud storage, USB drives, external hard drives, or unauthorized software.
Screenshot internal dashboards, rate cards, candidate lists, client lists, submissions, margin information, business discussions, or leadership communications.
Retain copies of Company documents after separation.

9. Return and Deletion of Company Information

Upon request, role change, resignation, termination, or end of engagement, the individual must immediately return, delete, and stop using all Company information, including:

Documents, files, records, notes, reports, resumes, candidate data, client data, rate data, business plans, HR records, and internal communications.
Company equipment, devices, access cards, phone numbers, software access, portal credentials, and accounts.
Any copies stored on personal devices, personal email, personal cloud accounts, messaging apps, or external storage.

The Company may require written confirmation that all such information has been returned or deleted.

10. Work Product and Company Materials

All work product created, contributed, modified, compiled, processed, or developed in connection with Hire'in Solutions business belongs to Hire'in Solutions, including but not limited to:

Candidate packets, resumes formatted for submission, screening notes, sourcing lists, outreach templates, business reports, client presentations, proposals, decks, pricing models, SOPs, training materials, AI prompts, automation workflows, documentation, spreadsheets, dashboards, and process designs.
Product concepts, platform workflows, internal portal documentation, recruiting tools, compliance checklists, and operational playbooks.

11. Public Information Exception

Confidential Information does not include information that becomes publicly available through no fault or unauthorized action of the individual. Information is not considered public merely because parts of it may be available from public sources if the Company has compiled, organized, enriched, analyzed, or maintained it in a non-public business format.

12. Protected Rights and Legal Exceptions

Nothing in this Agreement prohibits the individual from:

Discussing wages, hours, or working conditions as protected by applicable law.
Reporting discrimination, harassment, retaliation, wage violations, safety concerns, fraud, legal violations, or compliance concerns to a government agency.
Filing a charge or complaint with the EEOC, NLRB, OSHA, DOL, or another government agency.
Cooperating with a government investigation.
Making disclosures protected by whistleblower laws.
Exercising any legally protected rights.

Under federal trade secret law, an individual may have immunity from liability for confidential disclosure of a trade secret to a government official or attorney solely for reporting or investigating a suspected violation of law, or in a legal filing made under seal, as provided under 18 U.S.C. § 1833(b).

13. Duration of Confidentiality Obligations

The confidentiality obligations continue during and after employment/engagement. Trade secret obligations continue for as long as the information remains a trade secret under applicable law. Other Confidential Information must remain protected for as long as it remains non-public, sensitive, proprietary, or confidential, or for the maximum period permitted by applicable law.

14. Breach and Remedies

The individual understands that unauthorized disclosure, misuse, copying, export, retention, or destruction of Confidential Information may cause significant harm to Hire'in Solutions, its clients, candidates, employees, vendors, and business partners.

A breach may result in disciplinary action, termination of employment/engagement, loss of incentives or discretionary benefits where permitted by law and Company policy, removal of system access, legal action, injunctive relief, damages, recovery of Company property, and any other remedies available under applicable law.

15. No Waiver

Failure by Hire'in Solutions to enforce any provision of this Agreement at any time does not waive the Company's right to enforce the same or any other provision later.

16. Acknowledgment

I acknowledge that I have read and understood this Confidentiality and Non-Disclosure Agreement. I understand that confidentiality, data protection, client trust, candidate trust, and delivery discipline are core obligations of my employment/engagement with Hire'in Solutions.

I agree to comply with this Agreement during and after my employment/engagement with Hire'in Solutions.`,
  },
};

export const POLICY_ANNEXURE_LABELS: Record<PolicyAnnexureKey, string> = {
  leave_policy: "Annexure A — Leave Policy",
  attendance_policy: "Annexure B — Attendance & Regularization Policy",
  code_of_conduct: "Annexure C — Code of Conduct",
  nda: "Annexure D — Confidentiality & Non-Disclosure Agreement",
};
