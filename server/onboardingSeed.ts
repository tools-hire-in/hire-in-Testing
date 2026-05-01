import { db } from "./db";
import {
  learningTracks, trackSections, sectionQuizQuestions, sectionQuizOptions,
} from "@shared/schema";
import { eq } from "drizzle-orm";

interface SectionSeed {
  title: string;
  body: string;
  estimatedMinutes: number;
  minDwellSeconds: number;
  quiz: {
    questionText: string;
    explanation: string;
    options: { optionText: string; isCorrect: boolean }[];
  };
}

interface TrackSeed {
  title: string;
  description: string;
  targetRole: string | null;
  sections: SectionSeed[];
}

const COMMON_ONBOARDING: TrackSeed = {
  title: "Common Onboarding — Hire'in Solutions",
  description: "Essential onboarding content for all new employees covering company values, communication standards, documentation discipline, and attendance expectations.",
  targetRole: null,
  sections: [
    {
      title: "Welcome to Hire'in Solutions",
      estimatedMinutes: 5,
      minDwellSeconds: 45,
      body: `Welcome to Hire'in Solutions. Our mission is simple: making lives better, one placement at a time.

Every employee is expected to represent the company with professionalism, urgency, discipline, transparency, and care.

This onboarding program is designed for employees joining our recruitment teams — Healthcare Recruitment and IT Recruitment. Some sections are common for all employees, while others are team-specific.

What success looks like at Hire'in Solutions:

A successful recruiter at Hire'in Solutions:
- communicates clearly and professionally
- stays active and responsive during working hours
- uses Microsoft Teams as the official work platform
- documents work properly and consistently
- understands the requirement before sourcing
- screens candidates thoroughly
- avoids poor-fit or incomplete submissions
- protects company reputation with clients and candidates
- follows process discipline at every stage

We are a remote team, and that makes discipline, communication, and ownership even more critical. You are expected to take initiative, follow through on commitments, and escalate blockers early rather than waiting for things to resolve on their own.`,
      quiz: {
        questionText: "What does success look like for a recruiter at Hire'in Solutions?",
        explanation: "Success means combining professionalism, active responsiveness, thorough documentation, and strong process discipline — not just closing roles quickly.",
        options: [
          { optionText: "Closing as many roles as possible regardless of quality", isCorrect: false },
          { optionText: "Communicating clearly, documenting work properly, and following process discipline", isCorrect: true },
          { optionText: "Working independently without team coordination", isCorrect: false },
          { optionText: "Focusing only on candidate outreach and ignoring documentation", isCorrect: false },
        ],
      },
    },
    {
      title: "Core Work Principles",
      estimatedMinutes: 5,
      minDwellSeconds: 40,
      body: `At Hire'in Solutions, we work by the following principles. These are not suggestions — they are the standards by which your work will be evaluated.

1. Integrity over shortcuts
   Do the right thing even when it is harder. Never falsify records, misrepresent candidates, or cut corners in process.

2. Transparency over side conversations
   Important decisions and updates belong in team channels, not private DMs or WhatsApp. Visibility prevents confusion.

3. Speed with quality
   Urgency is valued, but not at the expense of accuracy. A fast but wrong submission hurts everyone.

4. Ownership with accountability
   If you own a task, you own it fully — including following up, escalating blockers, and keeping it updated.

5. Respect in communication
   Be professional, factual, and constructive. Avoid blame, defensiveness, or condescension.

6. Strong follow-through
   Starting a task is not the same as completing it. Follow through until the action is done and verified.

7. Clear documentation
   Undocumented work is treated as incomplete. If it is not recorded, it did not happen.

8. Early escalation of issues
   If something is blocked, unclear, or going wrong — escalate early. Silence on problems creates bigger problems.

These principles apply to all roles. They are not negotiable and are expected from Day 1.`,
      quiz: {
        questionText: "If you encounter a blocker on a critical task, what is the correct approach?",
        explanation: "Early escalation of blockers is a core principle. Waiting or staying silent is not acceptable — it creates delays and confusion for the entire team.",
        options: [
          { optionText: "Wait and see if it resolves on its own", isCorrect: false },
          { optionText: "Escalate early to the appropriate team member or channel", isCorrect: true },
          { optionText: "Work around it without informing anyone", isCorrect: false },
          { optionText: "Send a message on WhatsApp to your manager", isCorrect: false },
        ],
      },
    },
    {
      title: "Onboarding Timeline — Day 1 to Day 5",
      estimatedMinutes: 7,
      minDwellSeconds: 60,
      body: `Your first 5 days are structured to give you the knowledge and skills needed to start contributing effectively.

Day 1
- Company overview: services, mission, and values
- Review of companywide policies
- Microsoft Teams setup and working norms
- Outlook email signature setup
- Review of role expectations

Day 2
- Recruitment lifecycle overview
- Sourcing expectations and methods
- Screening expectations and quality standards
- Documentation expectations
- Communication templates training

Day 3
- Team-specific SOP training (Healthcare or IT)
- Step-by-step process walkthrough
- Sample requisition practice
- Candidate quality review

Day 4
- Mock sourcing exercise
- Mock screening exercise
- Mock submission exercise
- Internal escalation and discussion norms

Day 5
- Written assessment (30 questions)
- Practical assessment (3 exercises)
- Feedback and coaching session
- Final acknowledgement signoff

Final Onboarding Completion Criteria
An employee is considered fully onboarded only after:
- All onboarding documents have been studied
- Team-specific SOP has been reviewed
- Email signature is configured
- Written and practical assessments are completed
- Acknowledgement form is signed

You will not be considered ready for live work until all of the above are verified by your manager.`,
      quiz: {
        questionText: "When is an employee considered fully onboarded?",
        explanation: "Full onboarding requires completion of all documents, SOP review, signature setup, both assessments, and the signed acknowledgement. No single item alone is sufficient.",
        options: [
          { optionText: "After Day 1 orientation is complete", isCorrect: false },
          { optionText: "When the manager verbally approves", isCorrect: false },
          { optionText: "After all documents, assessments, and the acknowledgement form are completed", isCorrect: true },
          { optionText: "After the first successful submission", isCorrect: false },
        ],
      },
    },
    {
      title: "Official Communication Platform — Microsoft Teams",
      estimatedMinutes: 5,
      minDwellSeconds: 40,
      body: `Microsoft Teams is the ONLY official work communication platform at Hire'in Solutions.

This is non-negotiable. All work discussions, updates, clarifications, and decisions must happen in Teams. Personal messaging channels — WhatsApp, iMessage, personal texts — must not be used for work operations.

Why this matters:
- Documentation and visibility are mandatory. Important decisions need to be traceable.
- Remote teams depend on visible communication. What happens in a private thread does not exist for the team.
- Compliance and auditing require that work communications are on approved platforms.

Microsoft Teams Expectations:

Active Presence
- Be present and engaged during working hours (7:00 PM – 4:00 AM IST)
- Update your Teams status when away or unavailable
- Silence is not acceptable when awareness is expected

Message Acknowledgement
- Acknowledge relevant messages with a reaction or brief reply
- Never leave critical messages unread when you are online

Professional Communication
- Use threads to keep conversations organized
- Keep communication clear, concise, and respectful
- Share documents and updates in Teams channels — not email or personal storage

Pay Rate and Requisition Discussions
- If you have concerns about pay rates or open requisitions, bring them up in the designated team discussion channel
- Do not keep concerns in private silos
- Open discussion creates alignment and prevents confusion`,
      quiz: {
        questionText: "A colleague messages you on WhatsApp about a candidate submission. What should you do?",
        explanation: "All work communication must happen on Microsoft Teams. WhatsApp is not an approved platform for work. You should redirect the conversation to Teams immediately.",
        options: [
          { optionText: "Reply on WhatsApp since it is faster", isCorrect: false },
          { optionText: "Ignore the message", isCorrect: false },
          { optionText: "Ask them to send the message again on Microsoft Teams", isCorrect: true },
          { optionText: "Reply on WhatsApp and then copy-paste it to Teams later", isCorrect: false },
        ],
      },
    },
    {
      title: "Documentation Discipline",
      estimatedMinutes: 5,
      minDwellSeconds: 40,
      body: `At Hire'in Solutions, undocumented work is treated as incomplete. This is a firm standard, not a suggestion.

Why documentation matters:
- Another team member should be able to review your work at any time without needing verbal explanation from you.
- Clients and managers need visibility into pipeline status without having to ask.
- Audits and performance reviews depend on what is recorded, not what you remember.

What must be documented:
- Candidate interactions — outreach, screening notes, status updates
- Important updates that affect the pipeline or timeline
- Recruiter notes — must be useful, factual, and current
- Status fields — must be updated to reflect the real current state

Standards for recruiter notes:
- Notes must be specific, not vague. "Called candidate, interested" is not enough. "Called 10 March 2026, candidate confirmed interest in ICU contract, available from 25 March, pay expectation $62/hr, no compliance issues" is acceptable.
- Notes must be current. Stale notes are worse than no notes — they mislead.
- Notes must be honest. Do not record what did not happen.

Responsiveness expectations:
- Acknowledge internal messages promptly
- Respond to urgent candidate/client items quickly
- Inform the team early if a delay or blocker arises
- Do not allow critical communication to go unanswered`,
      quiz: {
        questionText: "Which of the following is an acceptable recruiter note?",
        explanation: "A good recruiter note includes specifics: what was discussed, when, and what the outcome or next step is. Vague notes like 'spoke to candidate' provide no value to anyone reviewing the record.",
        options: [
          { optionText: "Spoke to candidate, seems interested", isCorrect: false },
          { optionText: "Called 10 March, candidate confirmed interest in ICU contract, available from 25 March, pay expectation $62/hr, no compliance issues", isCorrect: true },
          { optionText: "Left a voicemail", isCorrect: false },
          { optionText: "Candidate is a maybe", isCorrect: false },
        ],
      },
    },
    {
      title: "Confidentiality and Professional Conduct",
      estimatedMinutes: 5,
      minDwellSeconds: 40,
      body: `Candidate and client information is strictly confidential. Mishandling this information can cause serious legal and reputational harm to the company.

Confidentiality expectations:
- Do not share resumes or candidate contact details outside approved channels
- Do not circulate pay rates or client-specific information casually
- Use only company-approved systems and storage for all documents
- Maintain confidentiality in all communications — verbal, written, and digital

What counts as confidential:
- Candidate names, contact details, resumes, compensation expectations
- Client names, bill rates, open requisitions, facility details
- Internal company decisions and financial information
- Employee information and HR records

Professional Conduct:
- Be respectful in all interactions — with candidates, clients, and colleagues
- Be clear and factual — avoid assumption and speculation
- Avoid blame-driven communication — focus on resolution and ownership
- Do not overpromise to candidates or clients
- Do not misrepresent rates, roles, or next steps — ever

Policy Violations:
Failure to follow communication, documentation, responsiveness, or process standards may lead to formal performance action. This includes verbal warnings, written notices, and, in serious cases, termination.

Attendance and Availability:
- Follow assigned working hours
- Record check-in and check-out accurately if a system is used
- Update availability status correctly to avoid reporting or payroll issues`,
      quiz: {
        questionText: "A colleague asks you to share a candidate's resume and contact details on WhatsApp for a quick referral. What do you do?",
        explanation: "Candidate information is confidential and must only be shared through approved company channels. Sharing via WhatsApp violates both the communication policy and confidentiality policy.",
        options: [
          { optionText: "Share it since it is just a colleague", isCorrect: false },
          { optionText: "Share only the name, not the full resume", isCorrect: false },
          { optionText: "Decline and direct them to use the approved system or Teams channel", isCorrect: true },
          { optionText: "Share it and then report it to HR later", isCorrect: false },
        ],
      },
    },
  ],
};

const HEALTHCARE_SOP: TrackSeed = {
  title: "Healthcare Recruitment SOP",
  description: "Step-by-step standard operating procedure for healthcare recruitment — from requisition intake through placement and onboarding. Required for all Healthcare team members.",
  targetRole: null,
  sections: [
    {
      title: "Step 1 — Requisition Intake",
      estimatedMinutes: 6,
      minDwellSeconds: 50,
      body: `Healthcare recruiting is highly sensitive because errors in specialty match, credential review, shift alignment, or compliance can quickly damage trust with the client and waste critical time.

Step 1: Requisition Intake

When a new requisition arrives, you must review and confirm the following before starting any sourcing activity:

Required information to confirm:
- Client or facility name
- Role title (exact clinical title, not a generic title)
- Specialty (be specific — e.g., ICU, ER, Med-Surg, Telemetry)
- Location (city, state, facility)
- Shift details (days/nights/evenings, hours per shift)
- Duration (contract length or permanent)
- Bill rate or pay guidance (or instructions to escalate if not provided)
- Years of experience required
- Mandatory certifications (e.g., BLS, ACLS, TNCC, PALS)
- Active license requirements and state
- EMR or specialty system experience (e.g., Epic, Meditech, Cerner)
- Start date
- Submission deadline

Definition of Done — Requisition Intake
A requisition is intake-complete ONLY when:
- Role title and specialty are clearly understood
- Location and shift are confirmed
- Required license/certifications are identified
- Compensation guidance is understood or has been escalated
- Submission timeline is known
- Must-have criteria are clear

If any of the above are missing, do NOT start sourcing. Escalate to get the information first.`,
      quiz: {
        questionText: "You receive a new requisition but the pay rate and bill rate fields are blank. What is the correct action?",
        explanation: "You must not start sourcing without compensation guidance. If it is not provided, escalate immediately. Starting sourcing without rate information wastes time and can lead to misaligned candidate expectations.",
        options: [
          { optionText: "Start sourcing immediately and clarify pay rates later", isCorrect: false },
          { optionText: "Assume a standard rate based on similar past roles", isCorrect: false },
          { optionText: "Escalate to get rate information before sourcing", isCorrect: true },
          { optionText: "Wait until candidates ask about pay to find out the rate", isCorrect: false },
        ],
      },
    },
    {
      title: "Step 2 — Sourcing",
      estimatedMinutes: 5,
      minDwellSeconds: 40,
      body: `Step 2: Sourcing

Once a requisition is intake-complete, you can begin sourcing.

Where to source from:
- Internal database (always check here first)
- Job boards (LinkedIn, Indeed, specialized healthcare boards)
- Prior redeployable candidates (previous contract completers)
- Referrals from active candidates
- Healthcare specialty talent pools and networks
- Previous pipelines for similar roles

Sourcing priorities:
1. Internal database — fastest and most cost-effective
2. Redeployable candidates — already credentialed and proven
3. Referrals — quality tends to be higher
4. Job boards — broadest reach but requires more screening

Definition of Done — Sourcing
Sourcing is complete for the current cycle when:
- A reasonable number of relevant candidates have been identified (typically 5–10 for initial pool)
- Outreach has started for top candidates
- Candidate pool is segmented by quality and readiness
- Sourcing effort is documented in the system (notes on who was contacted and when)

Quality over quantity. Ten relevant candidates are more valuable than fifty irrelevant ones. Always check specialty match, license state, and rough availability before spending time on a candidate.`,
      quiz: {
        questionText: "What is the correct first step when starting to source for a new requisition?",
        explanation: "The internal database should always be checked first. It is the fastest option and includes previously vetted candidates who may be available for redeployment.",
        options: [
          { optionText: "Post immediately on all job boards", isCorrect: false },
          { optionText: "Check the internal database for matching candidates first", isCorrect: true },
          { optionText: "Ask colleagues on WhatsApp for referrals", isCorrect: false },
          { optionText: "Reach out to candidates on LinkedIn before checking internal records", isCorrect: false },
        ],
      },
    },
    {
      title: "Step 3 — Candidate Screening",
      estimatedMinutes: 7,
      minDwellSeconds: 55,
      body: `Step 3: Candidate Screening

Screening is your quality gate. A poor screen wastes the client's time and damages your credibility as a recruiter.

What to validate during every healthcare screening:

Clinical fit:
- Specialty alignment (does their actual experience match the required specialty?)
- Recent relevant experience (how recent and how long?)
- EMR experience (specific systems required by the client)

Compliance:
- Active license status (verify state and expiry)
- Required certifications (BLS, ACLS, TNCC, PALS, etc.)
- No known compliance blockers (background, references, drug test readiness)

Logistics:
- Shift fit (can they work the required shift — days/nights, hours?)
- Location fit (are they willing to work at the specified location?)
- Travel readiness if applicable
- Start availability (specific date they can begin)

Compensation:
- Pay expectations (gross weekly, hourly, or annual depending on role type)
- Whether the rate fits within the budget
- Awareness of the compensation structure (contract vs perm, stipends, etc.)

Definition of Done — Screening
A healthcare screen is complete ONLY when:
- Major compliance items are checked (license, certifications)
- Availability is confirmed (specific start date)
- Candidate interest is confirmed in writing or by clear verbal agreement
- Pay expectations are discussed and are within range
- Recruiter notes are entered clearly in the system before the screening call ends

Do not submit a candidate who has not been fully screened. Partial screens lead to problems at the client stage.`,
      quiz: {
        questionText: "You finish a screening call but forget to confirm the candidate's pay expectations. The candidate seems qualified. What should you do?",
        explanation: "A screen is not complete without confirming pay expectations. An unconfirmed rate can cause the process to collapse later. Follow up and confirm before submitting.",
        options: [
          { optionText: "Submit the candidate and discuss pay later", isCorrect: false },
          { optionText: "Assume the candidate will accept the standard rate", isCorrect: false },
          { optionText: "Follow up to confirm pay expectations before proceeding", isCorrect: true },
          { optionText: "Ask a colleague to guess the candidate's expectations", isCorrect: false },
        ],
      },
    },
    {
      title: "Step 4 — Submission Preparation",
      estimatedMinutes: 6,
      minDwellSeconds: 50,
      body: `Step 4: Submission Preparation

A submission represents your judgment. If the submission is incomplete, inaccurate, or contains a poor candidate, it reflects on you and the company.

What a complete submission must include:
- Updated resume (current, no gaps unexplained, correct contact details)
- Candidate fit summary (explains why this candidate fits this specific role)
- License details (type, state, status, expiry)
- Certification details (BLS, ACLS, TNCC, etc.)
- Availability (confirmed start date)
- Compensation expectations (gross weekly or hourly as required by client)
- Recruiter notes (summarizing the screening, any known limitations)
- Known risks or limitations (flag anything that could cause a problem later)

Definition of Done — Submission
A submission is complete ONLY when:
- All client-required fields are complete and accurate
- The resume is current and clean (formatted, no errors)
- Specialty fit is clearly explained in the fit summary
- Compliance details (license, certifications) are not missing
- Notes are documented accurately before submission goes to the client

Common submission mistakes to avoid:
- Submitting an outdated resume
- Missing license or certification details
- No fit summary — just a bare resume drop
- Unexplained rate expectations
- Missing availability confirmation

Submitting an incomplete or inaccurate profile wastes the client's time and can result in losing the submission entirely.`,
      quiz: {
        questionText: "A candidate looks like a great match for a role, but their resume is 2 years old and their listed certifications may have expired. What do you do?",
        explanation: "Submitting outdated information is a compliance risk and damages client trust. The resume must be updated and certifications confirmed before any submission.",
        options: [
          { optionText: "Submit now and let the client verify certifications", isCorrect: false },
          { optionText: "Submit with a note saying the resume might be outdated", isCorrect: false },
          { optionText: "Get the candidate to update their resume and confirm all certifications are active before submitting", isCorrect: true },
          { optionText: "Use the old resume and update it after the client shows interest", isCorrect: false },
        ],
      },
    },
    {
      title: "Step 5 — Interview Coordination and Post-Placement",
      estimatedMinutes: 6,
      minDwellSeconds: 50,
      body: `Step 5: Interview Coordination and Post-Placement

Getting to the interview and placement stages requires the same discipline as sourcing and screening.

Interview Coordination — Recruiter Responsibilities:
- Confirm interview slot with both candidate and client
- Send calendar invite or confirmation to all parties
- Brief the candidate on interview format, interviewer names, and what to expect
- Confirm the candidate will attend 24 hours before the interview
- Follow up immediately after the interview for feedback from both sides
- Document the outcome in the system before end of day

Common interview coordination mistakes:
- Forgetting to confirm attendance the day before
- Not briefing the candidate on what the interview will cover
- Failing to capture post-interview feedback promptly

Offer and Placement:
- Verbally extend the offer clearly: rate, start date, shift, location
- Document the verbal offer immediately
- Obtain written acceptance or confirmation
- Coordinate all compliance and onboarding paperwork
- Confirm start date one week and one day before

Onboarding and Post-Placement:
- Check in with the candidate on their first day
- Check in again at the end of Week 1
- Flag any early concerns to the client before they escalate
- Update all placement records with final details

Definition of Done — Full Workflow
A placement is complete only when:
- Candidate has started on-site
- Compliance documents are submitted and accepted
- First week check-in is completed and documented
- All records are updated to reflect active placement status`,
      quiz: {
        questionText: "A candidate is scheduled for an interview tomorrow. What must you do today?",
        explanation: "Confirming attendance the day before is a required step. A no-show without prior warning is one of the most damaging outcomes in recruiting. Proactive confirmation prevents it.",
        options: [
          { optionText: "Nothing — the interview was already confirmed earlier", isCorrect: false },
          { optionText: "Confirm the interview time once more and brief the candidate on what to expect", isCorrect: true },
          { optionText: "Wait until after the interview to follow up", isCorrect: false },
          { optionText: "Send a Teams message to the client asking if they are ready", isCorrect: false },
        ],
      },
    },
  ],
};

const IT_SOP: TrackSeed = {
  title: "IT Recruitment SOP",
  description: "Step-by-step standard operating procedure for IT recruitment — from technical requisition intake through candidate submission, interview coordination, and placement. Required for all IT team members.",
  targetRole: null,
  sections: [
    {
      title: "Step 1 — IT Requisition Intake",
      estimatedMinutes: 6,
      minDwellSeconds: 50,
      body: `IT recruitment requires a strong technical understanding of the role. Misreading a technical requirement can lead to submitting completely wrong candidates and wasting everyone's time.

Step 1: IT Requisition Intake

Review and confirm the following before starting sourcing:

Role details:
- Job title (exact title — e.g., Senior Java Backend Engineer, not just "Developer")
- Primary technology stack (languages, frameworks, platforms)
- Years of experience required (be specific about what counts as relevant experience)
- Employment type (contract, contract-to-hire, full-time)
- Remote / on-site / hybrid status
- Location and time zone requirements if hybrid or on-site

Technical specifics:
- Required vs nice-to-have skills (this distinction is critical)
- Specific tools, platforms, or cloud providers (AWS, Azure, GCP, Kubernetes, etc.)
- Domain knowledge requirements (FinTech, Healthcare IT, E-commerce, etc.)
- Team size and structure (to understand integration fit)
- Interview process (technical screen, coding challenge, panel — know this upfront)

Compensation:
- Bill rate (C2C or W2) or salary band
- Work authorization requirements (e.g., US citizen only, GC acceptable, H1B sponsorship status)

Submission timeline:
- Client submission deadline
- Interview availability window

Definition of Done — IT Requisition Intake
A requisition is intake-complete ONLY when:
- Tech stack and seniority level are clearly understood
- Remote/location requirements are confirmed
- Required vs nice-to-have skills are separated
- Work authorization requirements are known
- Compensation range is understood or escalated
- Timeline is confirmed

Do not start sourcing without this information. Wasted sourcing effort is wasted time.`,
      quiz: {
        questionText: "A client sends a requisition for a 'Full Stack Developer' but does not specify the tech stack. What should you do?",
        explanation: "Tech stack is critical in IT recruiting. 'Full Stack Developer' means nothing without knowing the specific languages, frameworks, and platforms. You must get this clarification before sourcing.",
        options: [
          { optionText: "Search for generalist developers and present a range of profiles", isCorrect: false },
          { optionText: "Assume React and Node.js since those are common", isCorrect: false },
          { optionText: "Clarify the tech stack with the client before sourcing", isCorrect: true },
          { optionText: "Source multiple stacks to give the client options", isCorrect: false },
        ],
      },
    },
    {
      title: "Step 2 — IT Sourcing",
      estimatedMinutes: 5,
      minDwellSeconds: 40,
      body: `Step 2: IT Sourcing

Where to source IT candidates:
- Internal database (check first — always)
- LinkedIn (primary external source for IT)
- GitHub, Stack Overflow, and tech community platforms for passive candidates
- Job boards (Indeed, Dice, Glassdoor, Monster)
- Referrals from active candidates
- Previous pipelines for similar tech stacks

Sourcing efficiency tips:
- Use Boolean search on LinkedIn: combine primary tech skills + role title + location
- Filter by current title, not just keywords
- Look at candidate tenure — short stints everywhere may be a risk
- Check for relevant side projects or open-source contributions for senior roles
- Do not mass blast — personalize outreach based on their actual profile

Segmenting your pipeline:
Tier 1: Exact match — primary stack, correct years, correct location or remote
Tier 2: Partial match — missing one requirement but potentially trainable or flexible
Tier 3: Long shot — interesting but missing critical skill or not available

Always spend most of your time on Tier 1 candidates first. A small number of highly relevant candidates beats a large volume of questionable ones.

Definition of Done — IT Sourcing
Sourcing is complete for the current cycle when:
- Minimum 5 Tier 1 candidates identified and outreach started
- Pipeline is documented in the system with tier notes
- Initial response rate is being tracked
- Sourcing effort (platforms used, search terms) is recorded`,
      quiz: {
        questionText: "You have identified 3 exact-match candidates and 15 partial-match candidates. What is the correct approach?",
        explanation: "Exact-match candidates should always get priority. Submitting partial matches before exhausting strong candidates first wastes time and reduces submission quality.",
        options: [
          { optionText: "Contact all 18 candidates simultaneously for speed", isCorrect: false },
          { optionText: "Focus outreach on the 3 exact-match candidates first, then evaluate the partial matches", isCorrect: true },
          { optionText: "Focus on the 15 partial matches since there are more options", isCorrect: false },
          { optionText: "Submit the partial matches first while waiting for exact-match responses", isCorrect: false },
        ],
      },
    },
    {
      title: "Step 3 — IT Candidate Screening",
      estimatedMinutes: 7,
      minDwellSeconds: 55,
      body: `Step 3: IT Candidate Screening

Screening an IT candidate requires validating technical competency, not just availability and compensation.

What to validate during IT screening:

Technical competency:
- Depth of experience with the primary tech stack (years + hands-on project detail)
- Recency — when did they last use the required technology in a real project?
- Ability to explain their experience clearly (a candidate who cannot explain their work is a risk)
- Specific projects or systems they have built or contributed to

Work authorization and availability:
- Current work authorization status (US citizen, GC, H1B, OPT, etc.)
- If applicable: does the client accept H1B? Is the candidate currently on H1B?
- Notice period and earliest available start date

Logistics:
- Remote / on-site comfort level (do they prefer something different from the role requirement?)
- Time zone availability if the role requires overlap with specific teams
- Location if on-site or hybrid

Compensation:
- Rate expectation (C2C vs W2 distinction for contractors)
- If C2C: are they on their own entity or working through another vendor?
- For permanent roles: salary expectation and offer decision timeline

Red flags to watch during IT screening:
- Cannot explain what they worked on
- Resume does not match what they describe verbally
- Reluctant to confirm work authorization
- Rate expectation far outside range with no flexibility
- Short tenure at every employer without clear reason

Definition of Done — IT Screening
A screen is complete only when:
- Technical competency is confirmed through discussion (not just resume review)
- Work authorization is confirmed explicitly
- Availability and start date are confirmed
- Rate expectations are discussed and within range
- Notes are documented before ending the call`,
      quiz: {
        questionText: "A candidate's resume shows 5 years of Python experience, but during the screening they struggle to explain any Python project they worked on. What is the correct response?",
        explanation: "An inability to explain their own experience is a major red flag. The candidate may have exaggerated, been coached, or may not be who they say they are. This candidate should not be submitted without further investigation.",
        options: [
          { optionText: "Submit them — the resume speaks for itself", isCorrect: false },
          { optionText: "Submit them but add a note that the technical screen may be needed", isCorrect: false },
          { optionText: "Do not submit until the discrepancy is resolved — investigate further or move on", isCorrect: true },
          { optionText: "Ask a technical colleague to verify the resume", isCorrect: false },
        ],
      },
    },
    {
      title: "Step 4 — IT Submission Preparation",
      estimatedMinutes: 6,
      minDwellSeconds: 50,
      body: `Step 4: IT Submission Preparation

Every IT submission must be complete and compelling. The client's technical team will scrutinize the profile — a weak submission gets rejected immediately.

What a complete IT submission must include:
- Updated resume (formatted, no typos, reflects current skills and roles)
- Technical fit summary (2–4 sentences explaining why this specific candidate fits this specific role)
- Primary tech stack confirmation (explicitly call out what matches)
- Years of relevant experience
- Work authorization status
- Availability / start date
- Rate expectation (C2C or W2 as applicable)
- Known risks or limitations (flag anything honestly)

Technical fit summary — how to write it:
Bad: "John has 5 years of experience and is interested in this role."
Good: "John has 5 years of hands-on Java Spring Boot development, has worked with Kafka and Kubernetes in a financial services environment, is available from April 1st, and is seeking $65/hr W2. His most recent project involved building event-driven microservices at a mid-size FinTech firm, which aligns closely with the described architecture."

Definition of Done — IT Submission
- All required fields complete and verified
- Resume is current (updated within the last 3 months or candidate has reviewed it)
- Tech stack alignment is explicitly confirmed in the summary
- Work auth status is stated
- Rate and availability are confirmed
- Any known gaps or limitations are flagged

If any item above is missing, do not submit. Follow up with the candidate to complete it.`,
      quiz: {
        questionText: "Which technical fit summary is acceptable for a client submission?",
        explanation: "A good fit summary connects the candidate's specific, verifiable experience to the role's requirements. It includes technology names, years, project context, and relevant details — not generic statements.",
        options: [
          { optionText: "John is a strong developer with many years of experience and is interested in this opportunity.", isCorrect: false },
          { optionText: "John has 5 years of Java Spring Boot experience including event-driven microservices in a FinTech environment, available April 1st, seeking $65/hr W2 — aligns with the architecture described in the JD.", isCorrect: true },
          { optionText: "John has Java skills and is ready to interview.", isCorrect: false },
          { optionText: "Please see the attached resume for John's qualifications.", isCorrect: false },
        ],
      },
    },
    {
      title: "Step 5 — IT Interview Coordination and Placement",
      estimatedMinutes: 6,
      minDwellSeconds: 50,
      body: `Step 5: IT Interview Coordination and Placement

IT interviews often involve multiple stages — recruiter screen, technical screen, coding assessment, panel interview, and final decision. You must manage each stage actively.

Interview Preparation:
- Confirm the format with the client: async coding test? Live technical screen? Panel?
- Prep the candidate on what to expect: topics, format, duration, who will be on the call
- For coding assessments: confirm the platform, language allowed, and time limit
- Remind the candidate to prepare a brief project walkthrough (clients often ask this)

Day of the interview:
- Confirm attendance 24 hours before
- Confirm again the morning of (or afternoon for evening interviews)
- Ensure the candidate has all links, credentials, and contacts they need

Post-interview:
- Follow up with the candidate for their experience and any concerns
- Follow up with the client for feedback — do not wait
- Document outcome in the system before end of day
- If technical screen fails: document the feedback, decide if resubmission of a different candidate is appropriate

Offer and Placement:
- Extend offer verbally with full details: role title, start date, rate, location/remote
- Obtain written confirmation
- Coordinate background check, onboarding paperwork, and system access setup
- Confirm start date one week and one day in advance

Post-Start:
- Check in on Day 1 and end of Week 1
- Flag any client or candidate concerns immediately
- Update all records to reflect active status

Definition of Done — Full IT Workflow
Placement is complete when:
- Candidate has started in the role
- All compliance and onboarding documents are submitted
- First week check-in is done and documented
- Records reflect active status with all final placement details`,
      quiz: {
        questionText: "An IT candidate is scheduled for a live technical panel interview. What must you do the day before?",
        explanation: "Confirmation the day before is mandatory. Technical interviews involve multiple stakeholders — a no-show is costly and damaging. You must also ensure the candidate has all links and is prepared.",
        options: [
          { optionText: "Nothing — they already confirmed when you scheduled the interview", isCorrect: false },
          { optionText: "Confirm attendance, verify they have all required links and access, and check that they are prepared", isCorrect: true },
          { optionText: "Send a reminder email but do not call", isCorrect: false },
          { optionText: "Wait until after the interview to check how it went", isCorrect: false },
        ],
      },
    },
  ],
};

// ==========================================
// ADDITIONS FOR EXISTING TRACKS
// ==========================================

interface SectionAdditionSeed {
  trackTitle: string;
  sections: SectionSeed[];
}

const COMMON_ONBOARDING_ADDITIONS: SectionAdditionSeed = {
  trackTitle: "Common Onboarding — Hire'in Solutions",
  sections: [
    {
      title: "Outlook Email Signature Setup",
      estimatedMinutes: 8,
      minDwellSeconds: 60,
      body: `Setting up your Outlook email signature is a required Day 1 task. Every email you send externally represents the company. A missing or incomplete signature looks unprofessional to clients and candidates.

WHAT YOUR SIGNATURE MUST INCLUDE
- Full Name (as on your employment record)
- Job Title
- Company Name: Hire'in Solutions
- Your @hire-in.com email address
- Website: https://hire-in.com
- Location (city, state)

HOW TO SET UP IN OUTLOOK (DESKTOP)
1. Open Outlook
2. Click File → Options → Mail → Signatures
3. Click "New" and give the signature a name (e.g., "Hire'in Standard")
4. In the editor, paste or build the signature using the template below
5. Set it as the default for New Messages and Replies/Forwards
6. Click OK and send yourself a test email to verify it renders correctly

HOW TO SET UP IN OUTLOOK WEB (OWA)
1. Go to outlook.office.com and sign in with your @hire-in.com account
2. Click the Settings gear (top right) → View All Outlook Settings
3. Go to Mail → Compose and Reply
4. Scroll to Email Signature
5. Paste your signature into the editor
6. Enable "Automatically include my signature on new messages" and "on replies/forwards"
7. Click Save

YOUR SIGNATURE TEMPLATE
Copy this structure exactly and replace the placeholder text:

Name: [Your Full Name]
Title: [Your Job Title]
Company: Hire'in Solutions
Email: [yourname@hire-in.com]
Web: https://hire-in.com
Location: [City, State]

The official branded HTML version of this template is maintained by your manager. Request it via Microsoft Teams in your onboarding channel if you have not received it. Do not modify the branding or layout. Do not add personal quotes, logos, or non-standard contact details.

VERIFICATION
Once set up:
- Send a test email to yourself
- Check that it appears in both desktop and OWA correctly
- Notify your manager in Teams that your signature is configured
- Screenshot your sent test email and post it in the onboarding channel

Failure to configure your email signature by end of Day 1 will be flagged in your onboarding checklist as incomplete.`,
      quiz: {
        questionText: "Which of the following must be included in your Outlook email signature per company standards?",
        explanation: "The required fields are: full name, job title, company name (Hire'in Solutions), your @hire-in.com email, the company website, and your location. Personal quotes, non-company images, and alternate contact numbers are not permitted.",
        options: [
          { optionText: "Full name, personal mobile number, and favourite quote", isCorrect: false },
          { optionText: "Full name, job title, Hire'in Solutions, @hire-in.com email, website, and location", isCorrect: true },
          { optionText: "Only your name and email address is sufficient", isCorrect: false },
          { optionText: "Any format is acceptable as long as it looks professional", isCorrect: false },
        ],
      },
    },
    {
      title: "Recruitment Lifecycle Overview",
      estimatedMinutes: 8,
      minDwellSeconds: 65,
      body: `Understanding the complete recruitment lifecycle from start to finish is essential before you can work on any live requisition. Every recruiter at Hire'in Solutions must know all seven stages, who is responsible at each stage, and what "done" means.

STAGE 1: REQUISITION INTAKE
What happens: A new job order is received from the client or internal team. The recruiter reviews and confirms all required information before starting any work.
Who owns it: The assigned recruiter.
Done when: Role title, specialty, location, shift, pay guidance, must-have criteria, and submission deadline are all confirmed. If anything is missing, it is escalated before sourcing begins.

STAGE 2: SOURCING
What happens: The recruiter identifies relevant candidate profiles from the internal database, job boards, referrals, and talent networks. Outreach begins.
Who owns it: The assigned recruiter.
Done when: A target pool of relevant candidates has been identified, outreach has started, and the sourcing effort is documented in the system.

STAGE 3: SCREENING
What happens: The recruiter conducts a structured conversation with each candidate to validate fit, compliance, availability, and compensation expectations.
Who owns it: The assigned recruiter.
Done when: All required fields are confirmed (specialty/tech fit, compliance, availability, rate), and recruiter notes are entered in the system.

STAGE 4: SUBMISSION PREPARATION
What happens: The recruiter assembles a complete submission package — updated resume, fit summary, compliance details, availability, rate expectations, and recruiter notes.
Who owns it: The assigned recruiter.
Done when: All required components are present, accurate, and reviewed before the submission is sent to the client.

STAGE 5: INTERVIEW COORDINATION
What happens: The recruiter confirms the interview with both the candidate and client, briefs the candidate on format and expectations, confirms attendance 24 hours before, and follows up immediately after.
Who owns it: The assigned recruiter.
Done when: Interview outcome is documented, and next steps are clear.

STAGE 6: OFFER AND PLACEMENT
What happens: The recruiter extends the verbal offer (rate, start date, location, terms), obtains written confirmation, coordinates compliance and onboarding paperwork, and confirms the start date.
Who owns it: The assigned recruiter with manager oversight.
Done when: Written confirmation received, onboarding paperwork coordinated, start date confirmed.

STAGE 7: POST-PLACEMENT FOLLOW-UP
What happens: The recruiter checks in on Day 1, end of Week 1, and at 30/60/90-day milestones. Issues are flagged to the client before they escalate.
Who owns it: The assigned recruiter.
Done when: All placement records are updated to reflect active status, first-week check-in is documented.

KEY PRINCIPLE: Every stage has a clear "done" definition. Work does not move to the next stage until the current one is complete. Moving forward on incomplete information is a process violation, not initiative.`,
      quiz: {
        questionText: "Which stage comes immediately after sourcing in the recruitment lifecycle?",
        explanation: "After sourcing (identifying and reaching out to candidates), the next stage is screening — validating fit, compliance, availability, and compensation expectations through a structured conversation. Submission prep comes after a completed screen, not before.",
        options: [
          { optionText: "Submission preparation — build the profile and send it to the client", isCorrect: false },
          { optionText: "Screening — validate fit, compliance, availability, and rate expectations", isCorrect: true },
          { optionText: "Interview coordination — schedule the candidate for a client interview", isCorrect: false },
          { optionText: "Offer and placement — extend the offer immediately after sourcing", isCorrect: false },
        ],
      },
    },
    {
      title: "Communication Templates and Professional Standards",
      estimatedMinutes: 8,
      minDwellSeconds: 65,
      body: `Every recruiter must know how to communicate professionally at each stage of the recruitment lifecycle. Vague, rushed, or informal messages create confusion and damage trust with candidates and clients.

RESPONSE TIME EXPECTATIONS
- Internal Teams messages: same day, within working hours
- Candidate messages (urgent): within 2 hours
- Candidate messages (general): same day
- Client messages: within 2 hours or escalate to manager immediately

PROFESSIONAL TONE RULES
Always write messages that are:
- Clear and direct — say exactly what you mean
- Factual — do not speculate or over-promise
- Respectful — no sarcasm, blame, or condescension
- Specific — include names, dates, roles, and next steps

Never write messages that:
- Make commitments you cannot keep
- Use casual language in client-facing communication
- Leave the next step ambiguous
- Copy/paste generic scripts without personalising

TEMPLATE 1: FIRST OUTREACH TO CANDIDATE
"Hi [Name], this is [Recruiter] from Hire'in Solutions. I came across your background in [skill/specialty] and I'm reaching out about a [Job Title] opportunity in [location/work model]. Based on your experience, I thought it may be worth a quick conversation. Are you available for a brief call at [time] or [time]?"

TEMPLATE 2: SUBMISSION NOTIFICATION TO CANDIDATE
"Hi [Name], I wanted to let you know that your profile has been submitted to [client/facility] for the [Job Title] role. The client is reviewing submissions and I expect to hear back within [timeframe]. I'll keep you updated. In the meantime, please hold this opportunity as active and let me know if anything changes on your end."

TEMPLATE 3: INTERVIEW CONFIRMATION TO CANDIDATE
"Hi [Name], your interview has been confirmed for [date] at [time] [timezone]. The format is [phone/video/in-person] and you'll be speaking with [interviewer if known]. Please join/call [number/link] a few minutes early. I'll send a reminder the day before. Let me know if you have any questions."

TEMPLATE 4: OFFER COMMUNICATION TO CANDIDATE
"Hi [Name], I have an update on your application and would like to speak with you as soon as possible. Please call me at [number] or let me know when you're free. This is time-sensitive, so the sooner the better."

NOTE: Offer details should never be communicated fully by text or email until approved by your manager. Always extend verbally first, then confirm in writing.

TEMPLATE 5: INTERNAL ESCALATION TO MANAGER
"Hi [Manager Name], I have a blocker on [requisition/candidate/client situation]. The issue is [brief factual description]. I have already [what you've tried]. I need [what you need to move forward]. Available to discuss at your earliest. Thank you."

WHAT GOOD ESCALATION LOOKS LIKE
A good escalation: concise, factual, action-oriented.
A bad escalation: "I don't know what to do with this candidate, can you help?" (no context, no action taken, no clear ask)

SAVING TEMPLATES
All templates should be saved in your personal Microsoft Teams notes or Outlook drafts so you can access them quickly during live work. Do not store candidate or client information in personal notes apps outside of company systems.`,
      quiz: {
        questionText: "A candidate is submittable and has confirmed interest. Which template should you use to notify them that their profile has been sent to the client?",
        explanation: "Template 2 (Submission Notification) is the correct choice. It informs the candidate their profile has been submitted, sets an expectation for timeline, and asks them to keep the opportunity active — protecting your pipeline from silent dropout.",
        options: [
          { optionText: "Template 1 — First Outreach, because the candidate needs an introduction", isCorrect: false },
          { optionText: "Template 2 — Submission Notification, because the profile has been sent to the client", isCorrect: true },
          { optionText: "Template 4 — Offer Communication, because the client may make an offer soon", isCorrect: false },
          { optionText: "No template needed — the candidate already knows what is happening", isCorrect: false },
        ],
      },
    },
  ],
};

const HEALTHCARE_SOP_ADDITIONS: SectionAdditionSeed = {
  trackTitle: "Healthcare Recruitment SOP",
  sections: [
    {
      title: "Healthcare Staffing Fundamentals",
      estimatedMinutes: 10,
      minDwellSeconds: 80,
      body: `Healthcare staffing is one of the most credential-sensitive and compliance-driven areas in recruiting. A recruiter who does not understand the landscape cannot effectively screen, submit, or close candidates. This section covers the four foundational areas every healthcare recruiter must know before their first screening call.

ROLE FAMILIES
Understanding role families helps you match candidates to the right openings immediately.

Registered Nurse (RN): The most common travel and contract role. RNs work in units including ICU, ER, Med-Surg, Telemetry, OR, Labor & Delivery, NICU, and more. Specialty matters — an ICU RN cannot simply be placed in a pediatric oncology unit without the right experience.

LPN / LVN (Licensed Practical / Vocational Nurse): Work in a supporting clinical role. Common in SNFs (skilled nursing facilities), LTAC (long-term acute care), and clinics. Pay rates are lower than RNs.

CNA (Certified Nursing Assistant): Entry-level direct care. Common in SNFs, assisted living, and home health settings.

Allied Health: A broad category covering physical therapists (PT), occupational therapists (OT), speech-language pathologists (SLP), respiratory therapists (RT), radiology techs (X-ray, CT, MRI), sonographers, medical laboratory scientists (MLS/MLT), surgical techs, and more. Each Allied role has specific credentialing requirements — do not treat them as interchangeable.

Therapy: PT, OT, SLP. Common in hospitals, outpatient clinics, SNFs, and home health.

Imaging: Radiology techs, CT techs, MRI techs, sonographers, nuclear medicine techs. Each modality (X-ray, CT, MRI, ultrasound) requires specific certification and experience.

Lab: Medical laboratory scientists (MLS, formerly MT) and medical laboratory technicians (MLT). Work in hospital labs, reference labs, and clinics. ASCP certification is common.

Respiratory: Respiratory Therapists (RT/RRT/CRT). Work in ICUs, pulmonology, step-down units, and NICUs.

Physician / APP (if applicable): Physicians, Nurse Practitioners (NP), Physician Assistants (PA). Highest complexity in credentialing and compliance. Only recruit for these roles with specific manager guidance.

ASSIGNMENT TYPES
Travel Contract: A temporary assignment (typically 13 weeks) at a facility outside the candidate's home area. Candidates receive a stipend package (housing, meals/incidentals, travel) in addition to taxable hourly pay. The split between taxable and non-taxable pay has compliance rules — never guess on this.

Local Contract: Similar to travel, but the candidate works close to home. Often no housing stipend. Pay structure is different.

Per Diem: Day-by-day or as-needed work. No guaranteed hours. Often used for float pool and coverage needs.

Permanent Placement: Direct hire into a full-time or part-time role. No contract length — the candidate is employed by the facility.

CARE SETTINGS
Acute Care Hospital: Full-service hospital with emergency, surgical, and intensive care. Highest acuity. Candidates must have recent, relevant acute care experience.
ICU (Intensive Care Unit): Critical care for the most unstable patients. Requires ACLS at minimum; many clients require additional certifications.
ER (Emergency Room): Fast-paced, broad acuity, high volume. ACLS, TNCC, and ENPC are common requirements.
OR (Operating Room): Surgical environment. Requires specific OR experience — OR nurses and scrub techs are not interchangeable with floor nurses.
Med-Surg: General medical-surgical unit. Common, and often a starting point for less experienced nurses.
Telemetry: Cardiac monitoring unit. Requires ability to read cardiac rhythms; some clients require ACLS.
LTAC (Long-Term Acute Care): Extended stay for patients recovering from complex illnesses. Different from SNF — higher acuity.
SNF (Skilled Nursing Facility): Post-acute rehab and long-term care. Lower acuity than hospital settings; commonly used for PT, OT, CNA, and LPN roles.
Clinic / Outpatient: Lower acuity, scheduled appointments. Different pace and skill expectations from acute care.
Home Health: Visiting patients in their homes. Requires independence, strong clinical judgment, and a valid driver's license.

SHIFT MODELS
3x12: Three 12-hour shifts per week. Standard for most hospital RN positions. Understand days vs nights.
5x8: Five 8-hour shifts per week. Common in clinics, outpatient, and administrative roles.
Days: Typically 7am–7pm or 8am–4pm.
Nights: Typically 7pm–7am or 11pm–7am. Many candidates have shift preferences that are non-negotiable.
Rotating: Alternates between days and nights. Some candidates refuse rotating shifts — confirm this early.
Weekend-only or weekend-required: Some positions require at least two weekends per month. Always ask.

Always confirm shift and schedule in the first screening call. A candidate who cannot work the required shift cannot be submitted, no matter how qualified.`,
      quiz: {
        questionText: "A client needs an ICU Registered Nurse for a 13-week assignment in Chicago with housing stipend. What type of assignment is this?",
        explanation: "A 13-week temporary assignment that includes a housing stipend for a candidate working away from home is a travel contract. This is the most common format for healthcare staffing. Local contracts are similar but without the housing stipend, and per diem has no guaranteed hours.",
        options: [
          { optionText: "Per diem — the candidate works day-by-day as needed", isCorrect: false },
          { optionText: "Permanent placement — the candidate is hired full-time by the facility", isCorrect: false },
          { optionText: "Travel contract — a temporary assignment with housing stipend for out-of-area candidates", isCorrect: true },
          { optionText: "Local contract — same as travel but without any stipend", isCorrect: false },
        ],
      },
    },
    {
      title: "Credential and Compliance Essentials",
      estimatedMinutes: 9,
      minDwellSeconds: 70,
      body: `Healthcare is unlike any other industry when it comes to compliance. A recruiter who submits a candidate with an expired license or missing certification can damage the company's relationship with the client permanently. Know these rules before your first screen.

LICENSE STATUS — WHAT EACH MEANS

Active and unrestricted: The candidate is fully licensed to practice in the specified state. This is the only submittable status for most clients.

Active with restrictions: The candidate is licensed but with disciplinary conditions attached. Usually not submittable without specific client approval and manager guidance. Always escalate.

Pending: The candidate has applied for a new license or is waiting for endorsement in a new state. Cannot start work until the license is active. Some clients will accept a pending status for future start dates — always confirm with the client.

Expired: The candidate's license has lapsed. They cannot legally practice and cannot be submitted. They must renew before you can place them.

COMPACT LICENSING (NURSYS / NLC)
The Nurse Licensure Compact (NLC) allows a nurse with a license in one compact state to practice in other compact states without getting a separate license. As of 2024, over 40 states participate in the compact.

What this means in practice:
- If a nurse holds a license in Texas (compact state) and wants to work in North Carolina (also compact), they can do so under their Texas license — no separate NC license needed.
- If a nurse wants to work in California (NOT a compact state), they need a California license regardless of where their home state license is.

Always ask the candidate: "What state is your license in, and is it an active and unrestricted license?" Then verify whether the assignment state requires a separate license.

You can verify compact state participation at nursys.com.

CERTIFICATIONS — WHAT EACH MEANS AND WHICH ROLES REQUIRE THEM

BLS (Basic Life Support): CPR-level certification. Required for almost all clinical roles across nursing and allied health. Valid for 2 years. If BLS is expired, the candidate is generally not submittable.

ACLS (Advanced Cardiovascular Life Support): Required for ICU, ER, OR, Telemetry, cardiac step-down, and many acute care RN positions. Builds on BLS. Valid for 2 years.

PALS (Pediatric Advanced Life Support): Required for pediatric units, NICUs, pediatric ERs, and any role involving pediatric patients. Valid for 2 years.

NRP (Neonatal Resuscitation Program): Required for NICU and Labor & Delivery. Covers care of newborns in distress.

TNCC (Trauma Nursing Core Course): Often required for Level I and Level II trauma center ERs. Covers trauma assessment and management.

ENPC (Emergency Nursing Pediatric Course): Required in some ERs that see pediatric trauma patients.

CPI (Crisis Prevention Intervention): Required in behavioral health, psychiatric, and some pediatric units. Covers de-escalation techniques.

HOW TO VERIFY DURING A SCREENING CALL
Do not assume certifications are valid based on the resume alone. During the screen, ask:
"Which certifications do you currently hold, and when do they expire?"

If a certification is expiring within 2–3 months, flag it immediately. Some clients will not accept a candidate whose cert expires before or during the assignment.

WHAT HAPPENS IF COMPLIANCE IS INCOMPLETE
If a candidate is missing a required certification or has a license issue:
- Do not submit them. Period.
- If the candidate is otherwise excellent, note the issue clearly in your system and follow up to see if it can be resolved before the deadline.
- Escalate to your manager if you are unsure whether a compliance issue is a disqualifier for a specific client.

Submitting a non-compliant candidate — even once — erodes client trust that takes months to rebuild.`,
      quiz: {
        questionText: "A nurse holds an active, unrestricted license in Texas (a compact state) and wants to take a travel assignment in Florida (also a compact state). What license do they need to work in Florida?",
        explanation: "Under the Nurse Licensure Compact, a nurse with a license in a compact state can practice in any other compact state without a separate license. Since both Texas and Florida are compact states, the nurse can work in Florida using their Texas license. They would only need a separate Florida license if Florida were not a compact state.",
        options: [
          { optionText: "A separate Florida nursing license is required regardless of compact status", isCorrect: false },
          { optionText: "Their Texas license is sufficient since both states are in the compact", isCorrect: true },
          { optionText: "They need to apply for a temporary practice permit in Florida", isCorrect: false },
          { optionText: "The compact only applies to states adjacent to Texas", isCorrect: false },
        ],
      },
    },
    {
      title: "Healthcare Screening Template and Sample Questions",
      estimatedMinutes: 8,
      minDwellSeconds: 65,
      body: `A structured screening process is what separates a high-quality recruiter from an average one. A screen that misses key items wastes everyone's time and produces non-submittable candidates.

THE HEALTHCARE SCREENING CHECKLIST
Before ending any screening call, confirm and document all of the following:

1. Specialty match — Does the candidate's actual experience align with the required specialty? (e.g., ICU experience for an ICU opening, not general floor experience)
2. Active license — Is their nursing or allied license active and unrestricted in the relevant state?
3. Required certifications — Do they hold all certifications required for this specific role (BLS, ACLS, PALS, TNCC, etc.)? Are they current?
4. Recent relevant experience — How recent and how long? Is their experience genuinely in the required specialty, not tangential?
5. Unit/facility type match — Have they worked in the specific unit or setting type the client requires?
6. Shift flexibility — Can they work the required shift (days/nights/rotating)? Any hard limits?
7. Location willingness — Are they willing and able to work at the specified location? Travel readiness if applicable?
8. Start availability — What is their confirmed earliest start date?
9. Pay expectation — What is their gross weekly or hourly expectation? Does it fit within the budget?
10. Onboarding blockers — Any known background, drug test, reference, or compliance issues that could prevent a clean start?

SAMPLE SCREENING QUESTIONS (USE THESE VERBATIM OR ADAPT)

Opening:
"Before I walk you through the opportunity in detail, I'd like to ask a few quick questions about your background to make sure this is a good match for you. Is that okay?"

Specialty and experience:
"What unit are you currently working in, and how long have you been in that specific specialty?"
"How many years of recent experience do you have with [specialty]?"
"Is your most recent experience in the same type of unit this role requires, or has your focus shifted recently?"

Licensure:
"Is your [state] nursing license currently active and unrestricted?"
"Are you licensed in any other states, or have you applied for a license in [assignment state]?"

Certifications:
"Which certifications do you currently hold — BLS, ACLS, PALS, anything else?"
"When do your BLS and ACLS expire?"

Shift and location:
"This role is [shift details]. Is that something you're comfortable with, or do you have any scheduling constraints?"
"The assignment is in [city/state]. Are you open to that location? Do you have housing already, or would you need relocation support?"

Start date:
"What is the earliest date you could realistically start a new assignment? Do you have any notice period or compliance steps that would affect that?"

Pay expectations:
"What gross weekly compensation are you targeting for a travel assignment at this type of facility?"
"Are you factoring in the tax-exempt stipends, or is that your taxable income expectation?"

Closing the screen:
"Before we move forward, is there anything in your background — any compliance, reference, or licensing issue — that I should know about before I submit your profile?"

DOCUMENTATION AFTER THE SCREEN
Recruiter notes must be entered into the system immediately after the call ends. Do not wait. Notes must include:
- Date and time of call
- Specialty confirmed
- License status confirmed
- Certifications and expiry dates
- Availability and start date
- Pay expectation (gross weekly or hourly)
- Any flags or risks
- Candidate interest level and next steps

A screen with no notes is treated as an incomplete screen. The submission will not proceed until notes are on file.`,
      quiz: {
        questionText: "You finish a screening call with a strong ICU nurse candidate. They seem enthusiastic, their specialty matches, and their license is active. However, you forgot to ask about their pay expectations. The submission deadline is today. What is the correct action?",
        explanation: "A healthcare screen is only complete when ALL required items are confirmed — including pay expectations. Submitting without confirming pay can cause a breakdown later when the rate doesn't align. You must follow up and confirm before submitting, even if it means a short delay.",
        options: [
          { optionText: "Submit now and discuss pay expectations once the client shows interest", isCorrect: false },
          { optionText: "Assume a standard travel rate since they didn't object to the role", isCorrect: false },
          { optionText: "Follow up with the candidate immediately to confirm pay expectations before submitting", isCorrect: true },
          { optionText: "Ask your manager to handle the pay discussion after submission", isCorrect: false },
        ],
      },
    },
    {
      title: "Healthcare Red Flags, KPIs, and Recruiter Readiness",
      estimatedMinutes: 7,
      minDwellSeconds: 55,
      body: `Knowing when NOT to submit a candidate is as important as knowing when to submit. This section covers the warning signs, quality standards, and readiness criteria that define a healthcare recruiter who is ready for live work.

HEALTHCARE RED FLAGS — WHEN TO SLOW DOWN OR STOP

License issues:
- License is expired, restricted, or under investigation. Never submit. Escalate immediately.
- Pending license with no confirmed timeline — candidate cannot start without it. Flag risk and confirm timeline.
- License in a non-compact state for a compact-state opening — candidate needs a separate license. Confirm whether they have applied.

Experience problems:
- Specialty mismatch — candidate lists "ICU experience" but last ICU role was 5 years ago and they have been in a clinic since. Recent, relevant specialty experience is what counts.
- Old experience presented as current — resume leads with a specialty that is not their current focus. Always ask about their current unit.
- General experience in a high-specialisation role — a med-surg nurse cannot be submitted for a NICU role without genuine NICU experience.

Credential problems:
- Required certification is missing — BLS is expired, no ACLS for an ICU role, no PALS for a pediatric unit. Do not submit.
- Certification expiring during the assignment — some clients will not accept a candidate whose cert expires mid-contract. Flag it.
- Candidate is vague or evasive about certifications — treat this as a red flag.

Compliance and onboarding blockers:
- Known background issue — assess seriousness and escalate to manager before proceeding.
- Refusing a drug test or vaccine requirement — not submittable if the client requires it.

Behavioural red flags:
- Poor communication speed — if the candidate is unresponsive during recruitment, they will be unresponsive to the facility.
- Multiple submissions by different agencies without transparency — this creates problems with double submissions and conflicts.
- Pay instability — demanding rates far above market mid-process after initially agreeing.
- Reluctance on shift or location after initial interest — often a sign the candidate was not being honest during the screen.

HEALTHCARE RECRUITER QUALITY KPIs
Your performance as a healthcare recruiter will be evaluated on:
1. Qualified screens completed (not just calls made — screens that produce submittable candidates)
2. Submittals-to-interviews ratio (higher is better; low ratio means submissions are weak or poorly matched)
3. Interviews-to-offers ratio (reflects candidate quality and presentation)
4. Offers-to-starts ratio (reflects how well you manage candidates through to placement)
5. Falloff rate (candidates who accept and then drop out before or during the assignment)
6. Documentation accuracy (recruiter notes complete, accurate, and timely)
7. Credential mismatch rate (submissions rejected due to missing or incorrect compliance information)
8. Response time to new requisitions (how quickly you start sourcing after a req is assigned)

READINESS CRITERIA — WHAT YOU MUST BE ABLE TO DO BEFORE LIVE WORK
A healthcare recruiter is considered ready for live work when they can:
- Explain the difference between must-have and preferred requirements for a healthcare role
- Screen a nurse or allied profile without missing any key compliance check
- Write a clear, specific recruiter summary that any reviewer can understand without calling you
- Identify a non-submittable candidate quickly and without wasting the candidate's time
- Escalate a pay or compliance issue to the right person in the right way
- Demonstrate documentation that is specific, honest, and current

Until your manager has confirmed readiness, you will work under supervision on all live requisitions.`,
      quiz: {
        questionText: "A candidate lists 8 years of ICU experience on their resume. During the screen you learn that their most recent role — for the past 3 years — has been in a home health setting. Is this a red flag?",
        explanation: "Yes. Recent, relevant specialty experience is what counts in healthcare staffing. A candidate who has been in home health for 3 years is unlikely to meet the acuity and pace expectations of an ICU unit. Their ICU experience is now 3+ years stale. This should be flagged and escalated before any submission.",
        options: [
          { optionText: "No — 8 years of ICU experience is impressive enough to submit", isCorrect: false },
          { optionText: "No — the resume says ICU, so that is sufficient for submission", isCorrect: false },
          { optionText: "Yes — recent experience is what counts, and their last 3 years are in a different setting", isCorrect: true },
          { optionText: "Yes — but only if the client specifically asks about recent experience", isCorrect: false },
        ],
      },
    },
  ],
};

const IT_SOP_ADDITIONS: SectionAdditionSeed = {
  trackTitle: "IT Recruitment SOP",
  sections: [
    {
      title: "IT Role Families and Technical Vocabulary",
      estimatedMinutes: 10,
      minDwellSeconds: 80,
      body: `To recruit effectively for IT roles, you must speak the language. A recruiter who confuses a backend engineer with a data engineer, or does not understand what C2C means, will lose credibility with both candidates and clients quickly.

IT ROLE FAMILIES — WHAT EACH DOES

Software Engineering: Developers who build software applications. Subspecialties include frontend (what users see — React, Angular, Vue), backend (server-side logic — Java, Python, Node.js, .NET), full stack (both), mobile (iOS/Android), and embedded systems. Always ask what layer they work on.

QA / Testing: Quality assurance engineers who test software. Manual QA (writing test cases, exploratory testing) vs automated QA (writing test scripts using Selenium, Cypress, Playwright, etc.). Automation QA commands higher rates.

Data Engineering / Science / Analytics: Data engineers build data pipelines (ETL, Spark, Airflow, Kafka). Data scientists build models (Python, R, ML frameworks). Data analysts query and visualise data (SQL, Tableau, Power BI). These are distinct roles — do not conflate them.

DevOps / SRE / Platform: Engineers who manage infrastructure, CI/CD pipelines, deployment automation, and system reliability. Tools include Kubernetes, Docker, Terraform, Jenkins, GitHub Actions, and cloud platforms.

Cloud / Infrastructure: Cloud architects and cloud engineers working on AWS, Azure, or GCP. Focus on infrastructure, networking, security, and cloud-native services.

Cybersecurity: Security analysts, penetration testers, cloud security engineers, SOC analysts, and GRC professionals. Certifications like CISSP, CEH, and CompTIA Security+ are common.

Product Management: Define what software gets built and why. Not technical in the coding sense — they work with stakeholders and engineers to define requirements and prioritise roadmaps.

Project / Program Management: Manage delivery timelines, resources, and cross-team coordination. PMP, Agile, and Scrum certifications are common.

Technical Support / Helpdesk: L1/L2/L3 support, system administration, and IT operations. Often entry-level for IT. Do not pitch a senior developer role to a support engineer.

CONTRACT VOCABULARY — YOU MUST KNOW THIS
W2 (Employee): The candidate is paid as an employee, with taxes withheld by the employer. Simpler compliance, lower gross rate.

C2C (Corp-to-Corp): The candidate works through their own corporation (LLC or S-Corp) and invoices the staffing company. Higher gross rate because the candidate handles their own taxes and benefits. You must confirm the candidate has a valid entity. C2C candidates on H1B require additional verification — get manager guidance.

Contract: A time-limited engagement. Can be W2 or C2C.
Contract-to-Hire (CTH): Starts as a contract with the expectation of converting to full-time employment if the engagement goes well.
Full-Time / Permanent: The candidate is directly employed by the client.

WORK AUTHORIZATION — WHAT EACH MEANS
US Citizen or Lawful Permanent Resident (Green Card): No sponsorship or restrictions. Can work for any client, including ITAR-restricted or federal clients.

H1B: Employer-sponsored visa. The sponsorship is tied to the specific employer — if they leave, they need a new sponsor. You must confirm: (a) Is the client open to H1B candidates? (b) Is the candidate on a current valid H1B? (c) Does the candidate require future sponsorship (H1B transfer or new cap)?

OPT (Optional Practical Training): F-1 student visa graduates can work for a limited period (typically 12 months, or 36 months for STEM). Has a firm end date. Confirm the OPT end date before submitting.

TN: For Canadian and Mexican citizens under the USMCA (formerly NAFTA). Works for specific qualifying roles.

GC EAD / Other EAD: Employment Authorization Document. Confirm the type and expiry.

Always ask: "What is your work authorization status, and do you require sponsorship now or in the future?" Never assume.

REMOTE / HYBRID / ONSITE
Remote: Candidate can work from anywhere (or from their home country if a client restricts to domestic).
Hybrid: Some days in office, some remote. Ask how many days per week and which days.
Onsite: Fully in-person at the client's location. Confirm the candidate is willing and has the logistics to do this before you spend time on them.

Time zone: For remote roles with team collaboration requirements, ask what time zone the candidate is in and whether they can work during the client's core hours.`,
      quiz: {
        questionText: "A candidate says they work 'C2C.' What does this mean for how they are compensated?",
        explanation: "C2C (Corp-to-Corp) means the candidate operates through their own corporation and invoices the staffing company or client directly. They handle their own taxes and benefits. This is different from W2, where the candidate is paid as an employee with taxes withheld. C2C candidates typically bill at a higher rate because they absorb their own overhead.",
        options: [
          { optionText: "They are paid as a W2 employee with taxes withheld by the employer", isCorrect: false },
          { optionText: "They work through their own corporation and invoice the company — handling their own taxes and benefits", isCorrect: true },
          { optionText: "They are directly employed by the client as a permanent employee", isCorrect: false },
          { optionText: "C2C means they work on two contracts simultaneously", isCorrect: false },
        ],
      },
    },
    {
      title: "Reading Technical Job Descriptions",
      estimatedMinutes: 9,
      minDwellSeconds: 70,
      body: `The most important skill in IT recruiting is reading a job description accurately. A recruiter who misreads a JD wastes days sourcing the wrong candidates, ruins submissions, and loses client trust. This section teaches you how to do it right.

STEP 1: SEPARATE MUST-HAVE FROM NICE-TO-HAVE
Most IT JDs are written by HR teams or managers who list every technology they can think of. Your job is to identify what is actually required for the candidate to do the work.

Must-haves: Skills without which the candidate cannot perform the core job function. Usually found in the first 3–5 bullets, or described as "required."
Nice-to-haves: Bonus skills that are preferred but not disqualifying if absent. Usually phrased as "preferred," "a plus," or "familiarity with."

Example — Senior Java Backend Engineer JD:
"Required: Java, Spring Boot, REST API design, Kafka, AWS (S3, EC2, Lambda), PostgreSQL"
"Preferred: Kubernetes, Terraform, Go"
→ Must-haves: Java, Spring Boot, REST APIs, Kafka, AWS, PostgreSQL
→ Nice-to-haves: Kubernetes, Terraform, Go

If you source a candidate who has Java, Spring, and REST but no Kafka or AWS, they are likely a partial fit — not a strong submission.

STEP 2: EXPERIENCE DEPTH VS YEARS
"5 years of Python" does not mean the same thing to everyone. What matters is depth of recent use.
- A candidate who has used Python daily for 3 years in complex data engineering projects is stronger than one who used Python occasionally for 5 years in scripting tasks.
- Ask: "How recently have you used [skill] and in what context?"

Years are a proxy for depth. They are an imperfect proxy. Use them as a starting point, then validate depth during screening.

STEP 3: STACK COMBINATIONS MATTER
Different tech stacks define completely different engineering disciplines.
- React + Node.js + MongoDB: JavaScript full stack, web applications
- Java + Spring Boot + Kafka + AWS: Enterprise backend, distributed systems
- Python + Spark + Airflow + Snowflake: Data engineering
- React + Java + AWS: Full stack with Java backend — a specific combination

Do not source a Node.js engineer for a Java backend role. Even if both are "backend," the technology is different.

STEP 4: DOMAIN KNOWLEDGE REQUIREMENTS
Some JDs specify industry domain knowledge. This matters more than it sounds.
- FinTech (financial technology): Payments processing, banking regulations, high-transaction systems
- Healthcare IT: HL7/FHIR integration, EHR systems (Epic, Cerner), HIPAA compliance
- E-commerce: High-traffic systems, order management, inventory, recommendation engines

A candidate with 5 years of Java experience in a manufacturing company may struggle in a FinTech environment if domain knowledge is required. Ask about their industry background.

STEP 5: COMMON FALSE POSITIVES ON RESUMES
Keyword stuffing: A resume that lists 40 technologies to appear relevant. Probe depth in screening — if they cannot explain a specific tool, they may not truly know it.
"Exposure to" vs "worked with": Very different things. "Exposure" often means they saw it used, not that they can use it.
"Familiar with" vs "production experience": Production experience means they used it in a real system that serves users. Familiar means they read about it or tried it in a side project.
Short stints everywhere: Multiple jobs of 6–9 months each can indicate difficulty getting along in teams, performance issues, or volatility. Not always — but worth asking about.

STEP 6: CLARIFYING REQUIREMENTS WITH THE CLIENT OR MANAGER
If a JD is unclear, you must ask. Never make assumptions and source based on guesses.
Good clarifying questions:
"This JD mentions both AWS and Azure — is one preferred over the other?"
"Is Kubernetes a must-have or would strong Docker experience be acceptable?"
"What is the expected split between hands-on coding and architecture/design?"
"Is domain experience in [industry] required or a bonus?"

A 5-minute clarification conversation saves hours of wasted sourcing.`,
      quiz: {
        questionText: "A JD for a Senior Data Engineer lists 12 required skills and 8 preferred skills. You find a candidate who matches all 12 required skills but none of the 8 preferred. How should you evaluate this candidate?",
        explanation: "A candidate who matches all required (must-have) skills is a strong candidate regardless of preferred skills. Preferred items are bonuses — they improve a submission but their absence is not disqualifying. The candidate should be screened and submitted if they pass the screening checklist.",
        options: [
          { optionText: "Do not submit — they are missing 8 skills from the JD", isCorrect: false },
          { optionText: "This is a strong candidate — all must-have skills are met; preferred items are bonuses", isCorrect: true },
          { optionText: "Only submit if you cannot find anyone with all 20 skills", isCorrect: false },
          { optionText: "Ask the candidate to learn the 8 preferred skills before submission", isCorrect: false },
        ],
      },
    },
    {
      title: "IT Screening Template and Sample Questions",
      estimatedMinutes: 8,
      minDwellSeconds: 65,
      body: `Technical screening requires more than confirming a resume. You must validate that the candidate has real, hands-on, recent experience with the required technologies — not just the ability to list keywords.

THE IT SCREENING CHECKLIST
Before ending any IT screening call, confirm and document all of the following:

1. Current role and recent project — What are they actually working on right now?
2. Actual hands-on tools used — Not what they have listed, but what they use actively
3. Years of recent relevant experience — How long, and how recently?
4. Must-have skill match — For each required technology: have they used it, how recently, and in what context?
5. Domain fit — Is their industry background relevant to the client's domain?
6. Communication quality — Can they explain their work clearly? (critical for client-facing roles)
7. Work authorization — Current status, and do they require sponsorship now or in the future?
8. Location and work model — Are they in the right location? Can they work the required model (remote/hybrid/onsite)?
9. Notice period — How much advance notice is needed? When can they realistically start?
10. Compensation expectation — Hourly or salary, C2C or W2, and is it within range?

SAMPLE SCREENING QUESTIONS (USE VERBATIM OR ADAPT)

Opening:
"Before I go into the role details, I'd like to ask a few questions about your background to make sure this is worth your time. Is that okay?"

Current work and technical depth:
"What are you working on in your current role right now?"
"Which tools and technologies do you use hands-on today — not just technologies you've used in the past?"
"How recently have you used [must-have skill] and in what kind of project?"
"Can you walk me through a project where you used [key technology] from start to finish?"
"What percentage of your current work is hands-on coding vs architecture, design, or coordination?"

Must-have validation:
"The role requires strong [Kafka / Kubernetes / specific tech]. Have you worked with it in production, and what specifically have you built or managed with it?"
"Do you have hands-on AWS experience — specifically EC2, Lambda, S3 — or more architectural familiarity?"

Work authorization and availability:
"What is your current work authorization status?"
"Do you require any kind of sponsorship now or at any point in the future?"
"What is your notice period, and when is the earliest you could realistically start?"

Work model and location:
"This role is [hybrid/onsite/remote]. Is that something you're comfortable with?"
"If it's hybrid, are you located in [city] and able to commute in [X] days per week?"

Compensation:
"What is your expected compensation for this role — hourly rate or annual salary?"
"Are you looking for W2 or C2C, and if C2C, do you have your own entity set up?"
"Are you interviewing elsewhere right now, and if so, how would you compare this opportunity to what you're considering?"

Closing:
"Based on everything we've discussed, is there anything about your background or situation that you think I should know before I move your profile forward?"

DOCUMENTATION AFTER THE SCREEN
Note entries must include:
- Primary stack validated (with specific tools, not just role title)
- Work authorization status — exact type
- Availability and start date confirmed
- Rate expectation and payment type (W2 vs C2C)
- Communication quality observation (relevant for client-facing roles)
- Any flags, risks, or follow-up items
- Candidate interest level and next steps

An IT screen with no technical validation in the notes is not a completed screen.`,
      quiz: {
        questionText: "Which question best validates whether a candidate's Python experience is genuinely current and hands-on?",
        explanation: "Asking what they are working on right now and specifically what they have built with Python gives you verifiable, concrete evidence of current hands-on use. Asking 'how many years' or 'do you know Python' are easily exaggerated or misrepresented. Asking about a specific production project forces the candidate to demonstrate real depth.",
        options: [
          { optionText: "How many years of Python experience do you have?", isCorrect: false },
          { optionText: "Is Python listed on your resume?", isCorrect: false },
          { optionText: "Can you walk me through a Python project you've worked on recently in production — what you built, the tools involved, and your specific contribution?", isCorrect: true },
          { optionText: "Do you consider yourself an expert in Python?", isCorrect: false },
        ],
      },
    },
    {
      title: "IT Red Flags, KPIs, and Recruiter Readiness",
      estimatedMinutes: 7,
      minDwellSeconds: 55,
      body: `Knowing when to stop pursuing a candidate is a mark of a high-performing recruiter. This section covers the red flags that signal a submission risk, the quality standards you'll be measured against, and what it means to be ready for live IT requisitions.

IT RED FLAGS — WHEN TO SLOW DOWN OR STOP

Resume signals:
- Resume loaded with keywords but no project detail. During the screen, the candidate cannot explain what any of them mean in practice. Treat this as a potential mismatch or fabrication.
- Every job is 6–9 months long with no explanation. Ask directly: "I notice the tenure at each employer is relatively short — can you help me understand the context?" This is not always a problem, but it needs to be acknowledged.
- Old experience presented as current. A candidate who lists Java at the top of their resume but has been doing project management for the last 3 years is not a Java developer anymore.

Technical depth signals:
- Cannot explain what they actually built. Any competent developer can describe their project at a high level. If they cannot, the experience may not be genuine.
- Resume says 5 years of X but they cannot name a specific tool, version, or project. Push for specifics.
- "Exposure to" language when the JD requires "production experience." These are not the same.
- Claims ownership of the architecture on an entire platform but cannot explain any design decisions. Inflated ownership is a common resume embellishment.

Work model and compensation:
- Remote-only expectation for a clearly hybrid or onsite role. Confirm early — this kills submissions after the fact if not addressed.
- Rate expectation far above market with no flexibility. Note it, but do not assume — sometimes there is room. Escalate for guidance.
- Work authorization evasiveness. If a candidate is unclear or vague about whether they require sponsorship, do not submit until it is confirmed.

Communication signals:
- Weak or unclear communication for a client-facing role. A candidate who cannot explain their own work in a simple conversation will not perform well in a client interview.
- Slow response throughout the recruitment process. This is a preview of how they will behave post-placement.

IT RECRUITER QUALITY KPIs
Your performance as an IT recruiter will be measured on:
1. Qualified screens completed (screens that produce genuinely submittable candidates)
2. Submittals-to-interviews ratio (higher means your submissions are well-matched)
3. Interviews-to-offers ratio (reflects both candidate quality and your preparation)
4. Offers-to-join ratio (reflects how well you close candidates and manage competing offers)
5. Falloff rate (candidates who accept and then withdraw before starting)
6. JD understanding accuracy (do you correctly identify the must-haves before sourcing?)
7. Weak-submission rejection rate (submissions that are rejected as poor fits by the client)
8. Speed to first qualified candidate (how quickly you surface a submittable profile after receiving a req)

READINESS CRITERIA — WHAT YOU MUST DEMONSTRATE BEFORE LIVE WORK
An IT recruiter is ready for live requisitions when they can:
- Break a JD into must-have and nice-to-have buckets without help
- Explain in simple terms why a specific profile is a fit for a specific role — not just read resume bullets back
- Validate recent technical depth through screening questions, not just resume review
- Identify a weak-match profile quickly and redirect effort to stronger candidates
- Write a clear, specific candidate marketing summary that includes tech stack, project context, rate, availability, and work auth
- Surface work authorization, location, and rate risks before a submission is made

Until your manager confirms readiness through the mock drills in Week 4, you will shadow and observe live sourcing and screening sessions.`,
      quiz: {
        questionText: "A candidate's resume lists 5 years of AWS experience. During the screening call, they cannot name a single specific AWS service they have actually used in production. What is the correct response?",
        explanation: "An inability to name specific tools or describe actual usage is a major red flag in IT recruiting. AWS includes dozens of services — a candidate with genuine 5-year AWS production experience would instantly be able to name EC2, S3, Lambda, RDS, or similar. This discrepancy must be resolved before any submission. Do not submit and hope for the best.",
        options: [
          { optionText: "Submit them — the resume says 5 years so the client can verify in the technical interview", isCorrect: false },
          { optionText: "Submit with a note that the client should do a technical screen", isCorrect: false },
          { optionText: "Do not submit until the discrepancy is resolved — investigate further or move on to the next candidate", isCorrect: true },
          { optionText: "Ask a technical colleague to do a separate technical interview before deciding", isCorrect: false },
        ],
      },
    },
  ],
};

// ==========================================
// NEW TRACK: CANDIDATE OUTREACH PLAYBOOK
// ==========================================

const OUTREACH_PLAYBOOK: TrackSeed = {
  title: "Candidate Outreach & Communication Playbook",
  description: "Scripts, templates, and frameworks for every stage of candidate outreach — from first contact through offer and post-placement. Required for all recruiters before making live sourcing calls.",
  targetRole: null,
  sections: [
    {
      title: "Pre-Outreach Preparation",
      estimatedMinutes: 8,
      minDwellSeconds: 65,
      body: `Outreach should never start cold in your head. A recruiter who picks up the phone without preparation sounds unprepared in the first 20 seconds — and that kills trust immediately.

The goal of first outreach is not to close the candidate instantly.
The goal is to:
- get a response
- build credibility
- create enough interest for a conversation
- qualify quickly
- move the candidate to the next stage

WHAT TO REVIEW BEFORE ANY OUTREACH

Candidate basics — review before calling:
- Full name (say it correctly)
- Current job title and employer if known
- Location — are they in a relevant market?
- Years of relevant experience
- Top skills or specialty match to the role
- Any prior contact history in the ATS — were they contacted before by someone on the team?
- Whether a colleague has already reached out (check before calling — double outreach looks disorganised)

Job basics — know this before dialling:
- Exact job title
- Client name if shareable with candidates
- Location, work model (remote / hybrid / onsite)
- Compensation range or pay guidance
- Contract type (travel, contract, full-time, perm)
- Start timeline
- Top 3 must-haves
- Top 2 preferred items
- Biggest risk factor in the role (shift, location constraint, certification gap, etc.)
- One sentence on why the role is worth a conversation

Recruiter objective — know this before every outreach:
Before contacting a candidate, the recruiter must know exactly what they are trying to accomplish. Are they:
- Trying to get a callback from a first outreach?
- Trying to schedule a screen?
- Trying to confirm interest from a warm lead?
- Trying to re-engage a candidate who went quiet?
- Trying to recover a candidate who ghosted?

If you cannot answer that before reaching out, your outreach will be unfocused and unlikely to work.

WHAT RECRUITERS MUST NOT DO BEFORE OUTREACH
- Do not start without reviewing the profile for at least 60–90 seconds
- Do not call without knowing the compensation guidance
- Do not call without knowing the work model
- Do not call without knowing your objective for the call
- Do not reach out to the same candidate who was already contacted by a colleague this week
- Do not dump the entire JD on the candidate in the first call
- Do not ask 12 questions before earning the candidate's interest
- Do not hide key constraints (location, onsite requirement, shift) until the candidate is interested — this creates problems later and damages trust`,
      quiz: {
        questionText: "Before making a first outreach call, which of the following must a recruiter know about the role?",
        explanation: "A recruiter must know the exact job title, location and work model, compensation guidance or range, and the top 3 must-haves before making any call. Without these, they cannot personalise the outreach, cannot answer basic candidate questions, and risk wasting both parties' time. Going in blind signals a lack of preparation to the candidate within seconds.",
        options: [
          { optionText: "Only the job title — the details can be discussed if the candidate shows interest", isCorrect: false },
          { optionText: "The full JD word for word so they can read it to the candidate if needed", isCorrect: false },
          { optionText: "Job title, location and work model, compensation guidance, and the top must-have requirements", isCorrect: true },
          { optionText: "Just the client name and pay rate — that is what candidates care most about", isCorrect: false },
        ],
      },
    },
    {
      title: "Stage 1 — First Contact: Call, Voicemail, and SMS",
      estimatedMinutes: 9,
      minDwellSeconds: 70,
      body: `The first contact is where most recruiters fail. They sound scripted, lead with too much information, or do not earn the candidate's interest before asking for their time.

FIRST-TIME CALL OPENING (USE THIS STRUCTURE)
"Hi, is this [Candidate Name]?
This is [Recruiter Name] with Hire'in Solutions. I'm reaching out because I came across your background in [skill/specialty], and I'm working on an opportunity that looked relevant to your experience. Did I catch you at an okay time for a quick one-minute overview?"

Why this works:
- Identifies who you are and your company
- Gives a credible, specific reason for the call
- Shows relevance (you looked at their profile)
- Asks permission — this is respectful and professional

IF THE CANDIDATE SAYS THEY ARE BUSY
"No problem at all. I can be brief. The role is for a [Job Title] in [location/work model] and based on your background in [specific area], I thought it may be worth a short conversation. Would later today or tomorrow be better?"

Do not push. Offer a specific alternative. This respects their time and keeps the door open.

FIRST-TIME VOICEMAIL SCRIPT
"Hi [Candidate Name], this is [Recruiter Name] with Hire'in Solutions. I'm reaching out regarding a [Job Title] opportunity that looked relevant to your background in [skill/specialty]. Please call or text me back at [number]. Again, this is [Recruiter Name] with Hire'in Solutions at [number]. I'll also send you a quick text. Thank you."

Voicemail rules:
- Keep it 20 to 30 seconds maximum
- Say your number slowly — twice
- Mention relevance, not just "I have a job for you"
- Never leave a voicemail without sending an SMS immediately after
- Do not include rate or sensitive client details in a voicemail

FIRST-TIME SMS TEMPLATE
"Hi [Candidate Name], this is [Recruiter Name] from Hire'in Solutions. I tried calling regarding a [Job Title] opportunity in [location/work model]. Based on your background in [skill/specialty], it seemed relevant. Let me know if you'd be open to a quick conversation."

Why this works:
- Short and scannable
- Clear and credible
- Gives the candidate an easy yes/no response path
- Not aggressive or spammy

THE CALL + VOICEMAIL + SMS COMBINATION RULE
Every first outreach where you do not reach the candidate should follow this sequence:
1. Call
2. Leave a voicemail if no answer
3. Send an SMS within 5 minutes of the voicemail

Voicemail alone is weak — most candidates will not call back unless they were already interested.
SMS alone can feel impersonal without context.
Call + voicemail + SMS creates three touchpoints and gives the candidate multiple ways to respond. This combination generates the highest response rates.

WHAT NOT TO DO ON FIRST CONTACT
- Do not start with "Hi, how are you?" before identifying yourself — it sounds like a cold call script
- Do not read from a word-for-word script — you will sound robotic
- Do not dump the full JD in the first 60 seconds
- Do not ask 5 qualifying questions before the candidate knows why you called
- Do not oversell vague language like "this is an incredible opportunity" — be specific
- Do not hide a significant constraint (onsite required, specific shift, tight rate) until after the candidate is interested`,
      quiz: {
        questionText: "You call a candidate and they don't answer. You leave a voicemail. What is the required next action immediately after?",
        explanation: "The required next step after leaving a voicemail is to send an SMS within 5 minutes. Voicemail alone is weak and often not returned. The call + voicemail + SMS combination is the highest-converting sequence because it gives the candidate multiple ways to respond and reinforces the message across channels.",
        options: [
          { optionText: "Wait 24 hours and then call again", isCorrect: false },
          { optionText: "Send an SMS within 5 minutes of the voicemail to reinforce the message", isCorrect: true },
          { optionText: "Send an email with the full JD attached", isCorrect: false },
          { optionText: "Mark the candidate as unresponsive and move to the next profile", isCorrect: false },
        ],
      },
    },
    {
      title: "Stage 2 — Presenting the Job Opportunity",
      estimatedMinutes: 8,
      minDwellSeconds: 65,
      body: `This is where many recruiters fail. They either read the JD word for word (the candidate hears a list of requirements, not a compelling opportunity), or they are so vague the candidate does not understand what they are being considered for.

THE CORRECT ORDER FOR PRESENTING A ROLE
Present the opportunity in this sequence:
1. What the role is (title and brief description — 1 sentence)
2. Where it is and the work model (location/remote/hybrid — be factual)
3. Why it may fit the candidate (reference something specific from their profile)
4. One or two standout reasons to consider it
5. Qualifying question to check initial interest before going deeper

Then — and only then — go into detail.

EXAMPLE PRESENTATION STRUCTURE
"I'm working on a [Job Title] role with a [industry/client type if shareable]. It is [location/work model]. The reason I thought of your profile is your experience with [specific skill or specialty]. The role is focused on [brief role purpose — 1 sentence]. Before I go deeper, does that sound broadly aligned with what you'd consider?"

That final qualifying question is important. It prevents you from pitching for five minutes to someone who has already mentally said no.

HEALTHCARE-SPECIFIC ROLE PRESENTATION
Healthcare candidates respond first to specialty fit, shift fit, and location. Lead with these.
"This is a travel RN opportunity in [city, state], for a [unit type — ICU, ER, Med-Surg] position. The shift is [days/nights/3x12]. It's a 13-week contract starting [approximate date]. Based on your background in [specialty], I thought this could be a good match — does it sound broadly relevant?"

Do not lead with pay. This can come after you have confirmed clinical and logistical fit. Leading with pay before fit anchors the conversation in the wrong place.

IT-SPECIFIC ROLE PRESENTATION
IT candidates care first about the tech stack and work model. Lead with these.
"I'm working on a [Job Title] contract with a [industry] client. The tech stack is primarily [primary technology] — which looked relevant to your background. It's [remote/hybrid/onsite], [contract length or FTE]. Does that sound like something worth a few minutes to explore?"

Personalise one detail from their profile. "I noticed you've been working in Java Spring Boot" is far more engaging than "I have a Java opportunity."

WHAT NOT TO DO WHEN PRESENTING
- Do not read the JD line by line — summarise it
- Do not lead with 10 requirements before explaining what the role does
- Do not say "this is an amazing opportunity" without specifics — it sounds like a sales pitch
- Do not bury a significant constraint (mandatory onsite, demanding shift, below-market rate) at the end of a long pitch
- Do not commit to rate before understanding candidate expectations
- Do not promise interview timelines or start dates you have not confirmed with the client

AFTER THE CANDIDATE EXPRESSES INTEREST
Once the candidate confirms interest, move into the screening phase immediately. Do not pitch further. Ask the first screening question.

"Great — let me ask a few questions to make sure I can represent your profile accurately to the client. What are you currently working on?"`,
      quiz: {
        questionText: "When presenting a role, what is the purpose of asking 'does that sound broadly aligned with what you'd consider?' at the end of the initial overview?",
        explanation: "The qualifying question prevents the recruiter from spending 5 minutes presenting details to a candidate who is already not interested. If the candidate says no, the recruiter can quickly find out why (work model, location, contract type) and either address it or move on. It respects the candidate's time and keeps the conversation efficient.",
        options: [
          { optionText: "To test whether the candidate has been listening", isCorrect: false },
          { optionText: "To get a commitment before providing more details", isCorrect: false },
          { optionText: "To check initial interest before investing time in a detailed pitch — and to quickly identify objections", isCorrect: true },
          { optionText: "To make the candidate feel included in the process", isCorrect: false },
        ],
      },
    },
    {
      title: "SMS and Voicemail Templates by Stage",
      estimatedMinutes: 8,
      minDwellSeconds: 65,
      body: `Every stage of the recruiting process has a different communication objective. Your SMS and voicemail must be calibrated to the stage — what you say when scheduling a screen is different from what you say when confirming an interview.

STAGE 1: FIRST CONTACT

Voicemail:
"Hi [Name], this is [Recruiter] with Hire'in Solutions. I'm reaching out regarding a [Job Title] opportunity that looked relevant to your background. Please call or text me back at [number]. I'll send a quick text as well. Thank you."

SMS:
"Hi [Name], this is [Recruiter] from Hire'in Solutions. I came across your background in [skill/specialty] and wanted to connect regarding a [Job Title] opportunity. Let me know if you'd be open to a brief conversation."

STAGE 2: FOLLOW-UP AFTER NO RESPONSE — 24 HOURS LATER

SMS:
"Hi [Name], following up on the [Job Title] opportunity I mentioned. Based on your background, I thought it may be worth a short conversation. Let me know if you'd like details."

STAGE 3: NO RESPONSE — 48 TO 72 HOURS LATER

SMS:
"Hi [Name], just checking once more regarding the [Job Title] opportunity. If timing is not right, no problem at all. A quick yes, no, or later would be helpful."

Why this works: Removing pressure often triggers a response. Many candidates feel guilty ignoring messages and respond when they know it is okay to say no.

Voicemail:
"Hi [Name], this is [Recruiter] again from Hire'in Solutions following up on the [Job Title] role. I still think your background may be relevant, so please call or text me back at [number] if you'd like to explore it."

STAGE 4: SCREENING CONFIRMATION

SMS:
"Hi [Name], confirming our call at [time]. I'll walk you through the role and ask a few quick questions around your recent experience, availability, and expectations."

Keep this short. No need for detail — the screen will cover everything.

STAGE 5: INTERVIEW REMINDER

SMS:
"Hi [Name], just a reminder for your interview at [time]. Please join a few minutes early and keep your phone nearby in case of any issue."

Voicemail:
"Hi [Name], this is [Recruiter] with Hire'in Solutions — just a reminder for your interview tomorrow at [time]. Please confirm you have everything you need. Call me at [number] if anything comes up."

STAGE 6: POST-INTERVIEW FOLLOW-UP

SMS (send within 30 minutes of expected interview end):
"Hi [Name], hope the interview went well. Please send me a quick update when free on how it went and your interest level."

Do not wait hours for this. Momentum drops fast after an interview.

STAGE 7: OFFER STAGE

SMS:
"Hi [Name], I have an important update on the role. Please call me when you're free so we can go over the next steps carefully."

Do not put offer details in a text. Always discuss verbally first. SMS is only to prompt the callback.

WHAT TO INCLUDE IN EVERY SMS (CHECKLIST)
- Your name and company
- Role title (so the candidate knows which opportunity)
- A clear, single call to action
- Maximum 3–4 lines — never a paragraph

WHAT TO NEVER PUT IN AN SMS
- Full JD content
- Client names (unless pre-approved to share)
- Pay rates or bill rates
- Sensitive candidate information
- Long explanations or justifications`,
      quiz: {
        questionText: "Which combination of communication channels generates the highest response rate from candidates who did not answer your first call?",
        explanation: "The call + voicemail + SMS sequence creates three touchpoints across different formats and gives the candidate multiple low-friction ways to respond. Voicemail alone is often ignored. SMS alone can feel impersonal. The combination builds credibility and increases the chance of a response significantly.",
        options: [
          { optionText: "Email only — it is the most professional channel", isCorrect: false },
          { optionText: "Voicemail only — the message is clear and the candidate will call back", isCorrect: false },
          { optionText: "Call + voicemail + SMS — three touchpoints across formats with multiple response paths", isCorrect: true },
          { optionText: "SMS only — candidates always prefer text to phone calls", isCorrect: false },
        ],
      },
    },
    {
      title: "Objection Handling",
      estimatedMinutes: 8,
      minDwellSeconds: 65,
      body: `How you handle objections determines how many conversations convert to screens, and how many screens convert to submissions. A recruiter who gives up at the first sign of resistance misses opportunities that a better recruiter would close.

THE PHILOSOPHY OF OBJECTION HANDLING
Objections are usually not rejections. They are requests for more information, or signals that the recruiter has not yet demonstrated enough value or relevance. The goal is not to argue — it is to understand the objection and offer a genuine response that respects the candidate's position.

OBJECTION 1: "I'M NOT LOOKING RIGHT NOW"
Response:
"I understand completely. I'm not asking for a commitment right now — I just thought the role was relevant enough to be worth a two-minute conversation. If it doesn't fit, no harm done. If it does, then the timing works out well for you. Would a brief overview be okay?"

Why this works: You remove the pressure of commitment and make the conversation feel low-cost. Most candidates will agree to two minutes.

OBJECTION 2: "WHAT IS THE PAY?"
Response:
"I can absolutely discuss compensation. Before I quote a number that may not apply to your situation, I want to make sure the role itself is aligned on title, specialty, and core fit first — that way I'm not misrepresenting anything. Can I ask a quick question or two about your background first?"

Why this works: You defer the rate conversation until you have earned context, without being evasive. This also prevents the candidate from anchoring to a number before knowing whether the role fits.

OBJECTION 3: "SEND ME THE JD"
Response:
"Absolutely, I can send a summary. Before I do, I just want to make sure the basics align so I'm not wasting your inbox on something irrelevant. Let me ask two quick questions — [ask specialty/location/work model fit]. If that checks out, I'll send it right over."

Why this works: You qualify before sending. Sending JDs to everyone who asks creates a passive pipeline that never converts. A quick qualification first filters serious interest from tire-kickers.

OBJECTION 4: "I ONLY WANT REMOTE"
Response:
"Understood — that's a clear preference. This role is [hybrid/onsite], so I don't want to push you into something that's a hard no for you. Would it be helpful if I kept you in mind for fully remote openings in your specialty? I'll reach back out when something more aligned comes up."

Why this works: You respect the constraint, do not argue, and keep the relationship open. A candidate who says no today may be the right fit in 3 months.

OBJECTION 5: "I'M ALREADY INTERVIEWING ELSEWHERE"
Response:
"Thanks for sharing that — it's helpful to know. Would you still be open to a brief conversation about this? Sometimes it's useful to have multiple strong options in front of you, especially if the process timelines don't line up. I'll be quick."

Why this works: Multiple conversations are normal in a competitive market. The candidate knowing about your opportunity gives you leverage to move faster if needed.

OBJECTION 6: "I'LL THINK ABOUT IT / CALL YOU BACK"
Response:
"Of course — I don't want to rush you. Just so I can manage the timeline on my end, is there a specific question or piece of information I can answer now that would help you decide? I want to make sure I have the right context if I'm updating the client on your status."

Why this works: It redirects the conversation to a concrete next step rather than leaving it open-ended. An open-ended "I'll think about it" is a soft no that erodes over time.

WHAT NOT TO DO WITH OBJECTIONS
- Do not argue with the candidate's stated constraint
- Do not over-promise to overcome objections ("The pay is flexible, I'm sure we can work it out")
- Do not repeat yourself louder if the first response did not land
- Do not become desperate or apologetic
- Do not guilt-trip the candidate into interest they do not have`,
      quiz: {
        questionText: "A candidate says 'Send me the JD and I'll take a look.' What is the correct response before sending anything?",
        explanation: "Sending the JD without qualification creates a passive pipeline that rarely converts. The correct response is to ask one or two qualifying questions first (specialty match, work model, location) to confirm the role is worth their time. If those basics don't align, sending the JD helps no one. If they do align, you've earned the send.",
        options: [
          { optionText: "Send the full JD immediately — the candidate asked for it", isCorrect: false },
          { optionText: "Decline to send anything until the candidate agrees to a call", isCorrect: false },
          { optionText: "Ask one or two quick qualifying questions first, then send if the basics align", isCorrect: true },
          { optionText: "Tell the candidate you don't have the JD available and suggest a call instead", isCorrect: false },
        ],
      },
    },
    {
      title: "Follow-Up Cadence, Ghosting Playbook, and Post-Placement Standards",
      estimatedMinutes: 9,
      minDwellSeconds: 70,
      body: `Consistent, structured follow-up is what separates recruiters who convert at high rates from those who lose candidates mid-process. This section covers the complete cadence for follow-up, the ghosting recovery playbook, standard disposition codes, and post-placement touchpoint expectations.

THE 7-STAGE OUTREACH PROGRESSION MAP
Stage 1: First Contact — get response, spark interest
Stage 2: Live Opportunity Presentation — explain role, qualify fit
Stage 3: Screening — validate fit, readiness, and risk
Stage 4: Submission Readiness Confirmation — confirm candidate is truly submittable
Stage 5: Interview Coordination — manage scheduling, prep candidate, reduce falloff
Stage 6: Post-Interview Follow-Up — gather feedback, maintain candidate control
Stage 7: Offer / Close / Joining Control — reduce drop-off, protect conversion

Each stage requires a follow-up plan. Candidates who go quiet at any stage require immediate, structured follow-up.

THE GHOSTING / NO RESPONSE CADENCE

After first missed call:
1. Leave a voicemail
2. Send an SMS within 5 minutes

After 24 hours with no response:
Follow-up SMS: "Hi [Name], following up on the [Job Title] opportunity I mentioned. Based on your background, I thought it may be worth a short conversation. Let me know if you'd like details."

After 48 to 72 hours with no response:
Call again (try a different time of day), then SMS: "Hi [Name], just checking once more regarding the [Job Title] opportunity. If timing is not right, no problem at all. A quick yes, no, or later would be helpful."

That last line — "a quick yes, no, or later" — is highly effective. It removes pressure and often triggers a response from candidates who felt uncomfortable ignoring you.

After 72 hours with still no response:
Make a judgment call. For urgent roles: one more attempt. For lower urgency: mark as non-responsive and move to the next profile. Do not chase beyond three well-spaced attempts without a business reason.

STANDARD DISPOSITION CODES
Every outreach attempt must be dispositioned correctly in the system. Use these codes:
- No answer
- Voicemail left
- SMS sent
- Interested — screening scheduled
- Not interested — reason noted
- Callback scheduled — date/time noted
- Screened — notes entered
- Submitted — submission date noted
- Non-responsive — attempts documented

Undispositioned outreach is untraceable activity. If a candidate is not logged, the work did not happen as far as anyone reviewing your pipeline can tell.

TEAM OPERATING RULES
Before every outreach attempt:
1. Research the candidate enough to personalise one line
2. Know the role well enough to explain it in 30 seconds
3. Know your CTA (call-to-action) before dialling
4. Use the correct script for the correct stage
5. Document the outcome immediately after contact

These are not suggestions. They are the minimum standard for every recruiter doing live outreach.

POST-PLACEMENT TOUCHPOINT SCHEDULE
Your relationship with a placed candidate does not end on their start date. Retention and referral generation depend on continued contact.

Day 1 Touchpoint:
Check in to confirm they started, have everything they need, and no immediate issues.
"Hi [Name], just checking in on your first day. How is everything going so far?"

Week 1 Touchpoint:
"Hi [Name], wrapping up your first week — how has it been? Anything I should know from your end?"

30-Day Touchpoint:
Relationship check, role satisfaction check, escalate any early concerns.
"Hi [Name], checking in at the one-month mark. How are things going with the team and the role itself?"

60-Day Touchpoint:
Job satisfaction check, issue escalation, begin referral conversation if relationship is strong.

90-Day Touchpoint:
Milestone check-in, request testimonial or referral if appropriate, discuss long-term career goals.

Beyond 90 days for active contractors: Monthly check-ins.
Long-term placed candidates: Every 30 to 45 days.
Holiday/milestone touchpoints: Seasonal check-ins maintain the relationship without transactional pressure.

WHY THIS MATTERS
A recruiter who disappears after placement loses the candidate's trust, increases falloff risk, and misses the strongest source of new candidates — referrals from happy placements.`,
      quiz: {
        questionText: "You called a candidate, left a voicemail, and sent an SMS. Two full days pass with no response. What is the correct next step?",
        explanation: "After 48–72 hours with no response, the correct action is to make one more attempt: call again (ideally at a different time of day) and then send a low-pressure SMS that gives the candidate permission to simply say no. Phrasing like 'a quick yes, no, or later would be helpful' removes pressure and generates a response more often than repeating the same approach.",
        options: [
          { optionText: "Stop all contact — three attempts is too many", isCorrect: false },
          { optionText: "Leave another identical voicemail and SMS", isCorrect: false },
          { optionText: "Call again at a different time of day, then send a low-pressure SMS giving them an easy way to respond", isCorrect: true },
          { optionText: "Mark the candidate as unresponsive immediately and move on", isCorrect: false },
        ],
      },
    },
  ],
};

// ==========================================
// SEED FUNCTIONS
// ==========================================

async function insertSectionWithQuiz(
  trackId: string,
  sectionSeed: SectionSeed,
  orderIndex: number
): Promise<void> {
  const [section] = await db.insert(trackSections).values({
    trackId,
    title: sectionSeed.title,
    body: sectionSeed.body,
    orderIndex,
    estimatedMinutes: sectionSeed.estimatedMinutes,
    minDwellSeconds: sectionSeed.minDwellSeconds,
  }).returning();

  const [question] = await db.insert(sectionQuizQuestions).values({
    sectionId: section.id,
    questionText: sectionSeed.quiz.questionText,
    explanation: sectionSeed.quiz.explanation,
  }).returning();

  await db.insert(sectionQuizOptions).values(
    sectionSeed.quiz.options.map((o, idx) => ({
      questionId: question.id,
      optionText: o.optionText,
      isCorrect: o.isCorrect,
      orderIndex: idx,
    }))
  );
}

export async function seedOnboardingContent(createdBy: string): Promise<{ created: string[]; skipped: string[] }> {
  const tracks = [COMMON_ONBOARDING, HEALTHCARE_SOP, IT_SOP, OUTREACH_PLAYBOOK];
  const created: string[] = [];
  const skipped: string[] = [];

  for (const trackSeed of tracks) {
    const existing = await db.select().from(learningTracks)
      .where(eq(learningTracks.title, trackSeed.title));

    if (existing.length > 0) {
      skipped.push(trackSeed.title);
      continue;
    }

    const [track] = await db.insert(learningTracks).values({
      title: trackSeed.title,
      description: trackSeed.description,
      targetRole: trackSeed.targetRole,
      status: "draft",
      createdBy,
    }).returning();

    for (let i = 0; i < trackSeed.sections.length; i++) {
      await insertSectionWithQuiz(track.id, trackSeed.sections[i], i);
    }

    created.push(trackSeed.title);
  }

  return { created, skipped };
}

export async function seedSectionAdditions(createdBy: string): Promise<{ added: string[]; skipped: string[] }> {
  const additions = [COMMON_ONBOARDING_ADDITIONS, HEALTHCARE_SOP_ADDITIONS, IT_SOP_ADDITIONS];
  const added: string[] = [];
  const skipped: string[] = [];

  for (const addition of additions) {
    const [track] = await db.select().from(learningTracks)
      .where(eq(learningTracks.title, addition.trackTitle));

    if (!track) {
      // Track doesn't exist yet — skip, will be created by seedOnboardingContent
      for (const s of addition.sections) skipped.push(`[no track] ${s.title}`);
      continue;
    }

    const existingSections = await db.select().from(trackSections)
      .where(eq(trackSections.trackId, track.id));

    const existingTitles = new Set(existingSections.map(s => s.title));
    let nextOrderIndex = existingSections.length;

    for (const sectionSeed of addition.sections) {
      if (existingTitles.has(sectionSeed.title)) {
        skipped.push(sectionSeed.title);
        continue;
      }
      await insertSectionWithQuiz(track.id, sectionSeed, nextOrderIndex++);
      added.push(sectionSeed.title);
    }
  }

  return { added, skipped };
}
