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
- Be present and engaged during working hours (8:00 PM – 4:00 AM IST)
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

export async function seedOnboardingContent(createdBy: string): Promise<{ created: string[]; skipped: string[] }> {
  const tracks = [COMMON_ONBOARDING, HEALTHCARE_SOP, IT_SOP];
  const created: string[] = [];
  const skipped: string[] = [];

  for (const trackSeed of tracks) {
    // Check if already exists
    const existing = await db.select().from(learningTracks)
      .where(eq(learningTracks.title, trackSeed.title));

    if (existing.length > 0) {
      skipped.push(trackSeed.title);
      continue;
    }

    // Create track
    const [track] = await db.insert(learningTracks).values({
      title: trackSeed.title,
      description: trackSeed.description,
      targetRole: trackSeed.targetRole,
      status: "draft",
      createdBy,
    }).returning();

    // Create sections
    for (let i = 0; i < trackSeed.sections.length; i++) {
      const sectionSeed = trackSeed.sections[i];

      const [section] = await db.insert(trackSections).values({
        trackId: track.id,
        title: sectionSeed.title,
        body: sectionSeed.body,
        orderIndex: i,
        estimatedMinutes: sectionSeed.estimatedMinutes,
        minDwellSeconds: sectionSeed.minDwellSeconds,
      }).returning();

      // Create quiz
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

    created.push(trackSeed.title);
  }

  return { created, skipped };
}
