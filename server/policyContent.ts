export interface PolicyPage {
  page: number;
  body: string;
}

export interface PolicyData {
  title: string;
  pages: PolicyPage[];
}

export const POLICY_DOCUMENTS: PolicyData[] = [
  {
    title: "Code of Conduct",
    pages: [
      {
        page: 1,
        body: `CODE OF CONDUCT — RAYOMIND SOLUTIONS LLP

1. PURPOSE AND SCOPE

This Code of Conduct establishes the standards of professional behaviour expected of all employees, contractors, interns, and associates of Rayomind Solutions LLP ("the Company"). It applies to all work-related activities, including interactions with clients, candidates, colleagues, and any third parties.

The Company is committed to maintaining a workplace built on integrity, respect, and accountability. Every individual associated with the Company is expected to uphold these values and to act in a manner that reflects positively on the organisation at all times.

2. INTEGRITY AND HONESTY

Employees must conduct themselves with honesty and transparency in all professional dealings. This includes:

a) Providing accurate information to clients, candidates, and colleagues at all times.
b) Disclosing potential conflicts of interest promptly to your reporting manager or HR.
c) Never misrepresenting your qualifications, experience, or the Company's capabilities.
d) Accurately recording time, attendance, and work outputs. Falsifying timesheets or attendance records is a serious misconduct offence.
e) Protecting confidential business information and not sharing it with unauthorised parties.

Dishonest behaviour — including falsification of records, fraud, or deliberate misrepresentation — will result in immediate disciplinary action, up to and including termination and legal proceedings.

3. PROFESSIONALISM AND RESPECT

The Company expects all employees to treat colleagues, clients, and candidates with dignity and respect. Specifically:

a) Maintain a courteous and professional tone in all written and verbal communications.
b) Respond to emails and messages within agreed response windows.
c) Attend scheduled meetings punctually and prepared.
d) Disagreements with colleagues or clients must be resolved through appropriate channels and never through personal attacks or public confrontation.
e) Dress appropriately for client-facing meetings and video calls.`,
      },
      {
        page: 2,
        body: `4. EQUAL OPPORTUNITY AND NON-DISCRIMINATION

Rayomind Solutions is an equal opportunity employer. We are committed to providing a work environment free from discrimination, harassment, and victimisation. Discrimination on the basis of gender, religion, caste, nationality, age, disability, sexual orientation, marital status, or any other protected characteristic is strictly prohibited.

Any employee who believes they have been subjected to discrimination must report it to HR immediately. Retaliation against any person who reports discrimination in good faith is itself a disciplinary offence.

5. PREVENTION OF SEXUAL HARASSMENT (POSH)

The Company has a zero-tolerance policy toward sexual harassment in the workplace. Sexual harassment includes, but is not limited to:

a) Unwelcome physical contact or advances.
b) Sexually suggestive remarks, jokes, or gestures.
c) Display of sexually explicit material in the workplace or on Company devices.
d) Any conduct that creates a hostile or intimidating work environment based on gender.

All complaints of sexual harassment will be investigated promptly and confidentially by the Internal Complaints Committee (ICC). Employees found to have engaged in sexual harassment will face serious disciplinary action, including termination.

6. CONFLICT OF INTEREST

Employees must avoid situations where personal interests conflict — or appear to conflict — with the interests of the Company. A conflict of interest exists when an employee's personal, financial, or other interests could interfere with their ability to act in the best interest of the Company.

Employees must disclose promptly to HR any potential conflict of interest, including:
a) Secondary employment with a competitor or client organisation.
b) Personal relationships with candidates being evaluated for placement.
c) Financial interests in client or supplier organisations.
d) Receipt of gifts or hospitality above the Company's declared threshold (₹1,000 per instance).

Undisclosed conflicts of interest may lead to disciplinary action.`,
      },
      {
        page: 3,
        body: `7. USE OF COMPANY RESOURCES

Company resources — including laptops, software licences, communication tools, ATS subscriptions, and client portals — are provided for business purposes. Employees must:

a) Use Company resources responsibly and only for work-related activities.
b) Not install unauthorised software on Company or BYOD devices used for work.
c) Safeguard login credentials and never share access with unauthorised individuals.
d) Report lost or stolen devices or suspected security breaches within 24 hours.
e) Return or securely delete all Company data and resources upon exit.

Personal use of Company resources must be minimal and must not interfere with work obligations.

8. CONFIDENTIALITY AND DATA PROTECTION

Employees have access to sensitive business, candidate, and client information as part of their roles. This information must be treated with the utmost confidentiality. Specifically:

a) Do not share candidate personal data (including resumes, contact details, employment history) with any unauthorised third party.
b) Do not discuss client business details in public or on unsecured communication channels.
c) Comply with all applicable data protection laws, including the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023.
d) Upon leaving the Company, do not retain copies of any confidential data.

Breaches of data confidentiality are treated as serious misconduct and may result in legal action.

9. SOCIAL MEDIA AND PUBLIC COMMUNICATION

Employees must exercise caution when posting about their professional activities on social media platforms. The following guidelines apply:

a) Do not post confidential Company, client, or candidate information on any social media platform.
b) Do not make disparaging or defamatory statements about the Company, clients, competitors, or colleagues.
c) When expressing personal opinions on professional topics, clarify that the views are your own and not those of Rayomind Solutions.
d) Do not represent the Company officially on social media without prior written authorisation from management.

10. DISCIPLINARY PROCESS

Violations of this Code of Conduct will be addressed through the Company's disciplinary process, which may include:
a) Verbal or written warning.
b) Suspension (with or without pay, depending on the severity).
c) Termination of employment.
d) Legal action where applicable.

The severity of the response will be proportionate to the nature of the violation, prior record, and any mitigating circumstances.`,
      },
      {
        page: 4,
        body: `11. REPORTING CONCERNS AND WHISTLEBLOWING

Employees are encouraged to report any concerns about unethical behaviour, policy violations, or legal non-compliance. Reports can be made to:

a) Your direct reporting manager.
b) The HR department.
c) The Company's designated Compliance Officer (where appointed).

The Company is committed to protecting employees who raise concerns in good faith from retaliation. All reports will be treated confidentially to the extent possible.

Anonymous reporting may be made via email to hr@rayomind.com with the subject line "Confidential Concern."

12. AMENDMENTS

This Code of Conduct may be amended from time to time. Employees will be notified of any material changes and may be required to re-acknowledge the updated policy. The most current version shall prevail.

13. ACKNOWLEDGEMENT

By signing this document, I confirm that I have read, understood, and agree to comply with the Rayomind Solutions Code of Conduct. I understand that violations of this Code may result in disciplinary action, up to and including termination of my employment.

This acknowledgement is legally binding and forms part of my employment conditions. I agree to seek clarification from HR if I am ever uncertain about the application of these standards to a specific situation.`,
      },
    ],
  },
  {
    title: "Confidentiality & NDA Policy",
    pages: [
      {
        page: 1,
        body: `CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT (NDA) POLICY
RAYOMIND SOLUTIONS LLP

1. INTRODUCTION

This Confidentiality and Non-Disclosure Agreement Policy ("Policy") sets out the obligations of all employees, interns, contractors, and associates ("Employee") of Rayomind Solutions LLP ("Company") with respect to confidential and proprietary information.

Given the nature of the Company's business — which involves recruitment, staffing, and HR services across Healthcare, IT, Engineering, and Professional Services sectors — employees routinely access sensitive information belonging to the Company, its clients, and the candidates it serves. Protecting this information is a fundamental obligation of employment.

2. DEFINITION OF CONFIDENTIAL INFORMATION

"Confidential Information" includes any information, whether written, oral, electronic, or in any other form, that is not generally known to the public and relates to:

a) Business Information: financial data, revenue figures, pricing strategies, business plans, strategic initiatives, expansion plans, and partnership agreements.

b) Client Information: client names, contact details, contractual terms, client requirements, open positions, hiring processes, and any other information shared by clients in confidence.

c) Candidate Information: resumes, contact details, employment history, salary expectations, interview performance, placement outcomes, and any other personal data shared by or about candidates.

d) Operational Information: ATS configurations, sourcing strategies, AI prompt libraries, search methodologies, recruiter workflows, and system access credentials.

e) Technical Information: software, code, databases, algorithms, and proprietary tools developed or used by the Company.

f) HR Information: salary structures, employee performance data, internal disciplinary records, and other personnel information.`,
      },
      {
        page: 2,
        body: `3. EMPLOYEE OBLIGATIONS

As an employee of Rayomind Solutions LLP, you agree to:

a) Keep all Confidential Information strictly confidential and not disclose it to any third party without prior written authorisation from Company management.

b) Use Confidential Information solely for the purposes of performing your job duties, and for no other purpose.

c) Not copy, reproduce, transmit, or create derivative works from Confidential Information except as required for legitimate work purposes.

d) Access Confidential Information only through secure, authorised channels and using Company-approved tools and systems.

e) Immediately notify HR and your reporting manager if you become aware of any actual or suspected breach of confidentiality, loss of data, or unauthorised access.

f) Not use Confidential Information for personal gain or to benefit any third party, competitor, or external organisation.

4. CANDIDATE DATA PROTECTION

Given the highly personal nature of candidate information, the following specific obligations apply:

a) Candidate resumes, contact details, and interview notes must be stored exclusively in the Company's designated ATS (Ceipal) or approved document management systems. Storing candidate data on personal devices, personal email accounts, or cloud services not approved by the Company is strictly prohibited.

b) Candidate data may only be shared with clients with the explicit consent of the candidate, or as otherwise required by applicable law.

c) Upon request by a candidate, their data must be handled in accordance with applicable data protection law, including the right to erasure.

d) Candidate placement fees and contractual details must not be disclosed to other candidates or third parties.

5. CLIENT CONFIDENTIALITY

Clients share sensitive organisational information with the Company in confidence. Employees must:

a) Not disclose client hiring plans, team structures, or compensation benchmarks to other clients or the public.
b) Not solicit or attempt to recruit employees directly from clients for personal benefit.
c) Not use client information to benefit a competing organisation.
d) Maintain all client-related communications and documents in secure, Company-managed systems.`,
      },
      {
        page: 3,
        body: `6. DURATION OF CONFIDENTIALITY OBLIGATIONS

Confidentiality obligations under this Policy apply:

a) During the entire period of your employment with the Company.
b) After the termination of employment — for a period of two (2) years from the date of leaving — in respect of all Confidential Information accessed during employment.
c) Indefinitely — in respect of trade secrets and information that constitutes the Company's core intellectual property.

The obligations in this Policy are in addition to, and do not replace, any confidentiality obligations that may be contained in your employment agreement.

7. INTELLECTUAL PROPERTY

All work product, inventions, discoveries, writings, software code, databases, workflows, and other materials created by you in the course of your employment — whether during or outside working hours, and whether on personal or Company devices — that relate to the Company's business, are the exclusive property of Rayomind Solutions LLP.

You hereby assign to the Company all rights, title, and interest in such work product. You agree to execute any documents necessary to perfect such assignment upon request.

You must not use open-source software in Company projects without prior approval from the designated technical lead, as this may introduce licensing obligations.

8. NON-SOLICITATION

For a period of twelve (12) months after the termination of your employment, you agree not to:

a) Solicit, recruit, or attempt to induce any employee of the Company to leave their employment.
b) Solicit any client or candidate of the Company with whom you had direct dealings during your last twelve months of employment, for the purpose of providing services that compete with those of the Company.

This restriction is limited to direct solicitation and does not prevent you from working in the staffing or HR industry generally.`,
      },
      {
        page: 4,
        body: `9. RETURN OF COMPANY PROPERTY AND DATA

Upon termination of employment — for any reason — you must immediately:

a) Return all Company property, including laptops, access cards, and other physical assets.
b) Permanently delete all Confidential Information from personal devices, personal email accounts, and personal cloud storage services.
c) Certify in writing (Data Deletion Certificate) that you have complied with the above.
d) Provide all passwords and access credentials for Company systems to your reporting manager or HR.

Failure to return Company property or delete Confidential Information may result in legal action and forfeiture of any outstanding dues.

10. CONSEQUENCES OF BREACH

Any breach of this Policy — including unauthorised disclosure of Confidential Information, misuse of candidate or client data, or failure to return Company property — may result in:

a) Immediate termination of employment.
b) Civil action for damages suffered by the Company as a result of the breach.
c) Criminal proceedings under applicable law, including the Information Technology Act, 2000 and the Indian Penal Code (as applicable).

The Company reserves all its rights and remedies at law and in equity.

11. DISCLOSURE REQUIRED BY LAW

Nothing in this Policy prevents you from disclosing Confidential Information if required to do so by a court order, regulatory authority, or applicable law. However, you must give the Company as much prior written notice as possible before making any such required disclosure, so that the Company may seek a protective order if appropriate.

12. ACKNOWLEDGEMENT

By signing this document, I confirm that I have read and fully understood the Rayomind Solutions Confidentiality and Non-Disclosure Agreement Policy. I agree to be bound by its terms for the duration of my employment and for the periods stated thereafter. I understand that breach of these obligations may result in disciplinary action, termination of employment, and legal proceedings.`,
      },
    ],
  },
  {
    title: "Leave Policy",
    pages: [
      {
        page: 1,
        body: `LEAVE POLICY
RAYOMIND SOLUTIONS LLP

1. PURPOSE

This Leave Policy defines the types of leave available to employees of Rayomind Solutions LLP, the entitlements associated with each leave type, the accrual methodology, and the procedures for applying and approving leave. The policy is designed to support employee wellbeing while maintaining operational efficiency.

This Policy applies to all full-time employees. Contractual staff, interns, and part-time employees have separate leave arrangements as specified in their respective agreements.

2. LEAVE YEAR

The leave year runs from 1 January to 31 December of each calendar year. Leave balances are generally computed and tracked on a calendar-year basis.

3. TYPES OF LEAVE AND ENTITLEMENTS

3.1 Earned Leave (EL)

Entitlement: 15 days per calendar year.

Accrual: EL accrues at the rate of 1.25 days per completed calendar month. Accrual begins from the first day of the month immediately following successful completion of the probationary period. No EL accrues during the probationary period.

Carry-Forward: Unused EL up to the Company's defined carry-forward cap may be carried over to the following calendar year. Any balance in excess of the cap will lapse on 31 December each year.

Usage: A minimum notice of 5 working days is required for EL applications (except emergencies). EL must be approved by the reporting manager. Employees cannot take EL during their probationary period.

3.2 Sick Leave (SL)

Entitlement: 8 days per calendar year.

Accrual: SL accrues at approximately 0.67 days per completed calendar month post-probation.

Medical Certificate: A medical certificate from a registered medical practitioner is required for any sick leave exceeding two consecutive days.

Carry-Forward: Sick Leave does not carry forward. Any unused SL balance lapses at the end of each calendar year.`,
      },
      {
        page: 2,
        body: `3.3 Emergency Leave (EML)

Entitlement: 3 occurrences per calendar year.

Nature: Emergency Leave is a flat grant — not accrual-based. It becomes available upon confirmation (i.e., after successful completion of the probationary period). It is intended for genuine emergencies such as family bereavement, serious illness of an immediate family member, or other unforeseen urgent circumstances.

Carry-Forward: Emergency Leave does not carry forward. Any unused balance lapses at the end of the calendar year.

Approval: EML requires manager approval. In genuine emergencies where prior approval is not possible, the employee must inform their manager at the earliest available opportunity, and a retrospective application must be submitted within 48 hours.

3.4 Leave Without Pay (LWP)

LWP applies when an employee is absent and has exhausted all available paid leave balances (EL, SL, and EML). LWP days result in a proportional deduction from the monthly salary for the relevant pay period.

LWP must be approved by both the reporting manager and HR. Unapproved absences may be treated as LWP at the Company's discretion and may also attract separate disciplinary action.

4. LEAVE APPLICATION PROCEDURE

Step 1: Employees must submit leave requests via the Company's HR portal (Employee Self-Service) at least 5 working days in advance for planned leave (EL). For sick leave and emergency leave, application must be made as soon as reasonably possible.

Step 2: The reporting manager reviews the application and approves or rejects it within 2 working days.

Step 3: The applicant receives a notification of the decision via the HR portal. Approved leave is reflected in the attendance records.

Step 4: If leave is rejected, the reason will be provided by the manager. Employees may escalate to HR if they believe a rejection was unreasonable.`,
      },
      {
        page: 3,
        body: `5. HOLIDAY CALENDAR

5.1 National and Public Holidays

The Company observes all declared national holidays (Republic Day, Independence Day, Gandhi Jayanti) and applicable gazetted holidays. The full list of observed holidays for each year is issued in an annual Holiday Calendar published by HR.

5.2 Regional and Optional Holidays

Employees may be eligible to observe additional regional holidays based on their state of residence. HR will publish a list of optional regional holidays at the start of each year. Employees wishing to observe an optional holiday must register their selection in the HR portal by the date specified in the Holiday Calendar.

5.3 Weekend Treatment

Saturdays and Sundays are non-working days and are excluded from leave day counts. Leave spanning a weekend will count only the working days within that period.

6. PUBLIC HOLIDAYS FALLING DURING LEAVE

If a declared public holiday falls within an approved leave period, the holiday is not counted as a leave day. The leave balance will reflect only working days consumed.

7. MATERNITY AND PATERNITY LEAVE

7.1 Maternity Leave: Eligible female employees are entitled to maternity leave as prescribed under the Maternity Benefit Act, 1961. HR must be notified at least 8 weeks before the expected date of delivery.

7.2 Paternity Leave: The Company provides 5 working days of paid paternity leave to be taken within 30 days of the birth of the child. Paternity leave is not carried forward.

8. LEAVE ENCASHMENT

The Company does not currently provide a leave encashment scheme. Unused EL up to the carry-forward cap is carried forward; all other leave lapses at year end. Upon separation, accrued but unused EL may be encashed subject to management approval on a case-by-case basis.`,
      },
      {
        page: 4,
        body: `9. LEAVE BALANCE ADJUSTMENTS

In exceptional circumstances, the HR Manager may approve a manual adjustment to an employee's leave balance. All adjustments must be documented with a reason and are subject to approval by the HR Head.

Adjustments may be positive (granting additional days) or negative (clawing back excess leave taken). Negative adjustments will be reflected as salary deductions in the relevant pay period.

10. LEAVE DURING NOTICE PERIOD

Leave during the notice period (including leaves of all types) is generally not permitted except in cases of medical emergency with supporting documentation. The Company reserves the right to require an employee to work throughout their notice period.

Where an employee is on approved leave on the date their notice period begins (e.g., they submitted resignation while on leave), the notice period will commence on the date they return to work, unless otherwise agreed in writing.

11. PROBATION PERIOD — LEAVE RESTRICTIONS

During the probationary period:
a) Earned Leave does not accrue and cannot be taken.
b) Sick Leave accrues from the first full month of employment but may only be taken after the first 30 days.
c) Emergency Leave may be granted at management discretion in genuine cases.
d) Taking unapproved leave during probation may result in extension of the probationary period or termination.

12. REPORTING ABSENCES

If you are unable to attend work, you must notify your reporting manager — by phone call or via the HR portal — no later than 30 minutes after your scheduled shift start time. Failure to report absences promptly may result in the absence being classified as LWP and may attract separate disciplinary action for absenteeism.

13. POLICY REVIEW

This Leave Policy is reviewed annually by HR in consultation with management. Employees will be notified of any material changes and may be required to re-acknowledge the updated policy. The version in effect at the time of any dispute shall prevail.

I acknowledge that I have read, understood, and agree to comply with the Rayomind Solutions Leave Policy as described in this document.`,
      },
    ],
  },
  {
    title: "Attendance & Regularization Policy",
    pages: [
      {
        page: 1,
        body: `ATTENDANCE AND REGULARIZATION POLICY
RAYOMIND SOLUTIONS LLP

1. PURPOSE

This Attendance and Regularization Policy establishes the attendance standards expected of all employees of Rayomind Solutions LLP, the methods of recording attendance, and the procedure for regularizing discrepancies. Consistent attendance is critical to the operational excellence and client service standards of the Company.

2. SCOPE

This policy applies to all full-time employees, regardless of role, seniority, or work arrangement (in-office, remote, or hybrid). Contractual staff are subject to the attendance terms specified in their individual agreements.

3. STANDARD WORKING HOURS

Standard working hours are 8 hours per working day, 5 days per week (Monday to Friday). Employees working in the Healthcare Recruitment vertical typically operate in U.S. time zones, with standard shift hours of 7:00 PM to 4:00 AM IST. Other verticals and departments may have different shift schedules as specified in the relevant employment letter.

Employees are expected to be available and responsive during their designated working hours. Brief personal breaks (including the designated lunch and tea breaks) are permitted within the shift window.

4. ATTENDANCE RECORDING — PUNCH IN/OUT

All employees are required to record their attendance using the Company's HR portal (Employee Self-Service):

a) Punch In: Employees must punch in at the start of their shift via the HR portal. Punch-ins must be made within 15 minutes of the scheduled shift start to avoid being marked as "Late."

b) Punch Out: Employees must punch out at the end of their shift. Forgetting to punch out is not an acceptable excuse for attendance discrepancies.

c) Minimum Hours: A minimum of 8 hours (inclusive of permissible breaks) must be recorded to count as a "Full Day Present." Recording fewer than 4 hours will result in marking as "Half Day" or "Absent" at the discretion of the reporting manager.

d) Remote Work: Employees working remotely must follow the same punch-in/out requirements as in-office employees. VPN connectivity may be verified.`,
      },
      {
        page: 2,
        body: `5. BREAK POLICY

5.1 Lunch Break: One lunch break of 30 minutes per shift is permitted. The break must be initiated and concluded via the Break Widget in the HR portal.

5.2 Tea Break: Two tea breaks of 15 minutes each per shift are permitted.

5.3 Break Overruns: Break durations that materially exceed the permitted limits will be flagged in the attendance system. Repeated overruns may be treated as loss of productive time and may affect attendance records.

5.4 Break Outside Shift: Breaks taken before punch-in or after punch-out are not tracked by the system and are at the employee's own discretion.

6. LATE ARRIVALS AND EARLY DEPARTURES

Employees who punch in more than 15 minutes after their scheduled shift start time will be marked as "Late." Repeated late arrivals — defined as more than 3 instances in any calendar month — will be escalated to the reporting manager for review.

Employees who punch out before completing the minimum required hours without prior manager approval will be marked as a "Short Day" and the deficit hours may be treated as LWP or deducted from leave balances.

7. ABSENTEEISM

7.1 Unplanned Absence: Any absence not pre-approved via a leave request must be reported to the reporting manager by phone or message no later than 30 minutes after the scheduled shift start.

7.2 Consecutive Absences: Three or more consecutive unplanned absences without notification or leave approval will be treated as "Abandonment of Post" and may result in immediate termination.

7.3 Chronic Absenteeism: Employees whose attendance falls below 75% of working days in any calendar month — after accounting for approved leave and holidays — will receive a formal warning. Persistent absenteeism is a disciplinary matter.`,
      },
      {
        page: 3,
        body: `8. ATTENDANCE REGULARIZATION

8.1 What is Regularization?

Regularization is the process of correcting attendance records where a discrepancy has occurred due to technical failure, forgotten punch-in/out, or other genuine reasons. It is not a mechanism to cover unauthorised absences.

8.2 Who Can Request Regularization?

Any employee who has a genuine attendance discrepancy may request regularization. The regularization window is 7 calendar days from the date of the discrepancy. Regularization requests for older records will not be accepted except in extraordinary circumstances approved by HR.

8.3 Regularization Procedure

Step 1: The employee logs a regularization request via the HR portal, specifying the date, the discrepancy (e.g., missing punch-in, incorrect punch-out time), and the reason.

Step 2: The reporting manager reviews the request within 2 working days and approves or rejects it with a comment.

Step 3: If approved, HR processes the correction and updates the attendance record accordingly.

Step 4: If rejected, the discrepancy stands as-is in the record. The employee may escalate to HR, which will review and make a final determination.

8.4 Limits on Regularization

The Company limits regularization to a reasonable number of instances per month. Employees who regularly request regularization (more than 4 times per month) may be subject to additional scrutiny and a formal discussion with their reporting manager.

8.5 Manager-Initiated Corrections

Reporting managers with appropriate access may directly correct attendance records for team members in certain circumstances (e.g., system downtime confirmed by IT). All manager-initiated corrections are logged in the audit trail and reviewed by HR monthly.`,
      },
      {
        page: 4,
        body: `9. OVERTIME AND COMPENSATORY OFF

9.1 Pre-Approval Required: Overtime work — work performed beyond the standard 8-hour shift — must be pre-approved by the reporting manager. Unapproved overtime will not be compensated.

9.2 Compensatory Off (Comp Off): Employees who work on declared holidays or weekends with prior written approval may be entitled to a Compensatory Off to be taken within 30 days of the overtime day. Comp Offs are subject to manager and HR approval and may not always be available during high-demand periods.

9.3 No Automatic Overtime Pay: The Company does not currently operate an overtime pay scheme. Approved overtime is compensated exclusively through Comp Off days.

10. ATTENDANCE AND PAYROLL

Monthly attendance data is used to calculate salary for the relevant pay period. Deductions for LWP days and absent days without approved leave will be applied to the salary for that month. Employees should review their attendance summary before the payroll cut-off date (25th of each month) and raise any discrepancies promptly.

11. WORK FROM HOME (WFH) POLICY

Remote work is the default arrangement for most roles at Rayomind Solutions. The same attendance standards apply to remote employees as to in-office employees. Employees working from home must:

a) Be reachable on all designated communication channels during shift hours.
b) Participate in all scheduled meetings with video on (unless exempt by manager).
c) Maintain a professional work environment during client or internal calls.
d) Punch in and out via the HR portal as normal.

12. ACKNOWLEDGEMENT

By signing this policy, I confirm that I have read, understood, and agree to comply with the Rayomind Solutions Attendance and Regularization Policy. I understand that non-compliance with attendance standards may result in salary deductions, formal warnings, and in serious cases, termination of employment. I agree to maintain the attendance standards described in this document throughout my employment.`,
      },
    ],
  },
  {
    title: "Cybersecurity Credential Management Policy",
    pages: [
      {
        page: 1,
        body: `CYBERSECURITY CREDENTIAL MANAGEMENT POLICY
RAYOMIND SOLUTIONS LLP

1. PURPOSE AND SCOPE

This Cybersecurity Credential Management Policy ("Policy") establishes mandatory requirements for how all employees, contractors, interns, and associates of Rayomind Solutions LLP ("the Company") handle, store, share, and manage credentials — including passwords, API keys, access tokens, SSH keys, and any other authentication material for Company systems, client systems, and third-party services.

Credential theft and mismanagement are among the leading causes of data breaches. A single compromised credential can result in unauthorised access to client data, financial systems, ATS records, and candidate information. This Policy exists to eliminate that risk by standardising credential hygiene across the organisation.

This Policy applies to all credentials for systems accessed in the course of employment, whether those systems are owned by the Company, a client, or a third party. It applies regardless of whether the employee is working on-site, remotely, or from a personal device.

2. THE COMPANY VAULT — AUTHORISED CREDENTIAL STORE

The Company operates a centralised, encrypted Credential Vault ("the Vault") accessible through the HR and Operations portal. The Vault is the single authorised location for storing and sharing all Company credentials.

2.1 All passwords, API keys, access tokens, SSH keys, two-factor backup codes, and equivalent authentication material for Company and client systems must be stored exclusively in the Vault.

2.2 No credential may be stored in any other location, including but not limited to:
a) Personal or shared email accounts (including drafts or sent mail).
b) Messaging platforms including WhatsApp, Slack, Teams, Telegram, or similar.
c) Personal or shared cloud storage (Google Drive, Dropbox, OneDrive, iCloud, etc.).
d) Local files on personal or Company devices, including text files, spreadsheets, notes apps, or browser-saved passwords.
e) Physical media including sticky notes, notebooks, whiteboards, or printed sheets.
f) Shared documents or wiki pages that are not the Vault.

2.3 Browser password managers and personal password managers (e.g., LastPass, 1Password personal accounts) are not authorised substitutes for the Vault. They do not provide the audit trail, access control, or rotation enforcement required by this Policy.`,
      },
      {
        page: 2,
        body: `3. VAULT-ONLY SHARING

Credentials must only be shared through Vault grants. The Vault's access-grant mechanism is the sole authorised method for providing a colleague with access to a shared credential.

3.1 Prohibited sharing methods include, without limitation:
a) Sending a password, token, or key via any email, messaging, or chat platform.
b) Sharing credentials verbally in a meeting or call without an accompanying Vault entry.
c) Screensharing or photographing a credential — including a brief "just this once" reveal.
d) Writing a credential on any physical medium and handing it to a colleague.
e) Posting credentials in shared documents, wikis, or project management tools.

3.2 When a new colleague requires access to a system, the process is:
Step 1 — Locate the credential in the Vault (or create a new entry if it does not exist).
Step 2 — Use the Vault's "Grant Access" feature to share the credential with the specific individual.
Step 3 — Set an appropriate access expiry if the need is temporary.
Step 4 — Revoke the grant in the Vault when the access is no longer required.

3.3 If a system does not support individual accounts and a shared credential is unavoidable, the shared credential must be stored in the Vault and access granted exclusively through the Vault grant mechanism. Shared credentials must be rotated whenever a team member who had access leaves or changes roles.

3.4 Credentials received from clients or third parties must be entered into the Vault immediately upon receipt. The original message, email, or document containing the credential must be deleted after the Vault entry is confirmed.

4. CREDENTIAL HYGIENE STANDARDS

4.1 Password Strength: All passwords created or managed under this Policy must be at minimum 16 characters, random, and unique to each system. Do not reuse passwords across systems.

4.2 Rotation: Credentials must be rotated in accordance with the rotation schedule set in the Vault for each entry. Employees who receive a rotation-due notification from the Vault must complete the rotation within 5 working days.

4.3 Immediate Rotation Required: If a credential is shared in an unauthorised manner (e.g., sent via email in error), or if an employee suspects a credential may have been exposed, they must:
a) Rotate the credential immediately (or request an authorised person to do so).
b) Notify the Operations team and HR within 24 hours.
c) Update the Vault entry with the new credential.

4.4 MFA: Where a system supports multi-factor authentication (MFA), it must be enabled. MFA backup codes must be stored in the Vault, not on personal devices or email.`,
      },
      {
        page: 3,
        body: `5. EXCEPTION PROCESS

The Company recognises that in rare and exceptional circumstances, a deviation from this Policy may be operationally necessary. Exceptions are not granted routinely and must be formally approved.

5.1 Requesting an Exception:
a) Submit a written request to the Operations team describing the specific credential, the system involved, why Vault storage or Vault sharing is not feasible in this instance, and the proposed alternative control.
b) The request must be submitted at least 48 hours before the deviation is required (except in genuine emergencies where retrospective approval must be sought within 24 hours of the deviation).
c) The Operations team will assess the request and, where appropriate, approve a time-limited exception with compensating controls.
d) All approved exceptions must be logged and reviewed quarterly by HR and Operations.

5.2 No self-declared exceptions: An employee may not unilaterally decide that their situation warrants an exception. Using an unauthorised storage or sharing method without a formal exception is a Policy breach regardless of intent or urgency.

5.3 Temporary system unavailability: If the Vault is temporarily unavailable and a credential must be accessed or shared urgently:
a) The credential may be shared through an encrypted, ephemeral channel (e.g., a self-destructing message in an approved tool) for the minimum time required.
b) Once the Vault is available, the credential must be entered or verified in the Vault immediately.
c) The incident must be reported to Operations within 4 hours, including details of the alternative channel used.

6. OFFBOARDING AND ROLE CHANGES

6.1 When an employee leaves the Company or changes roles, all Vault grants assigned to them must be revoked by their manager or HR within 24 hours of departure or role change.

6.2 The departing employee must not retain copies of any credentials accessed during employment. The Data Deletion Certificate (required under the Confidentiality Policy) covers credentials specifically.

6.3 Any shared credentials to which the departing employee had access must be rotated within 5 working days of their departure and updated in the Vault.

6.4 Employees must not transfer any Vault credentials to a personal password manager or external storage upon departure. Doing so constitutes a breach of both this Policy and the Confidentiality and NDA Policy.`,
      },
      {
        page: 4,
        body: `7. RESPONSIBILITIES

7.1 All Employees:
a) Store every credential in the Vault immediately upon creation or receipt.
b) Share credentials exclusively through Vault grants.
c) Rotate credentials as required and upon any suspected exposure.
d) Report suspected credential exposure to Operations and HR within 24 hours.
e) Comply with MFA requirements on all systems that support it.
f) Complete this Policy acknowledgement and access the Vault to verify your onboarding.

7.2 Managers:
a) Ensure direct reports are onboarded to the Vault and understand this Policy.
b) Revoke Vault access for departing or role-changing team members promptly.
c) Approve exception requests before deviations occur.
d) Escalate suspected credential breaches to Operations immediately.

7.3 Operations & IT:
a) Maintain the availability and integrity of the Vault.
b) Conduct quarterly reviews of all Vault grants and remove stale access.
c) Review and log all exception requests.
d) Investigate and respond to reported credential exposure incidents.

8. CONSEQUENCES OF BREACH

Breaches of this Policy — including storing credentials outside the Vault, sharing credentials through unauthorised channels, or failing to report a suspected exposure — will be treated as serious misconduct. Consequences may include:

a) A formal written warning.
b) Suspension pending investigation.
c) Termination of employment.
d) Legal action, where the breach results in a data or security incident causing harm to the Company, clients, or candidates.

The Company will consider the nature of the breach, whether it was deliberate or negligent, and any prior warnings when determining the appropriate response.

9. ACKNOWLEDGEMENT

By signing this document, I confirm that I have read, understood, and agree to comply with the Rayomind Solutions Cybersecurity Credential Management Policy. I understand that:

a) The Company Vault is the sole authorised location for storing and sharing all credentials.
b) Storing or sharing credentials through any other channel — email, chat, local files, personal password managers, or physical media — is a breach of this Policy.
c) I am required to access the Vault and verify my onboarding as my next step after signing.
d) Breaches may result in disciplinary action up to and including termination of employment.

I agree to access the Company Vault immediately after signing this acknowledgement and to maintain full compliance with this Policy throughout my employment and, where applicable, after my departure.`,
      },
    ],
  },
];
