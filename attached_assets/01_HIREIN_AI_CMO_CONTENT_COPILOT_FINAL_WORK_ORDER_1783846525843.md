# HIRE’IN AI CMO CONTENT COPILOT
## Final Replit MVP Work Order

## 1. Objective

Upgrade the existing Hire’in Content Studio agent into an AI CMO Content Copilot for the marketing team.

The copilot should help the team decide:

- Who the content is for
- What question or decision the content should address
- Which staffing domain applies
- Whether the context is commercial, state government or federal government
- Which content goal and platform are appropriate
- Which hook, structure and call to action should be used
- How the content should be adapted for each platform
- What should be measured after publication

The product should remain simple for the user and disciplined behind the scenes.

## 2. Existing System Must Be Preserved

Do not create a new agent.

Reuse the existing:

- Content Studio
- Article brief pipeline currently under development
- Prompt builder
- Prompt versioning and rollback
- Structured output
- Retry flow
- Draft metadata
- Social kit
- Quality review
- Peer review
- Publish approval
- Existing roles and permissions

Make the smallest correct changes required to add the intelligence and quality behavior in this work order.

## 3. Product Scope

### In scope

- Hire’in Insights articles
- Thought leadership
- Educational staffing content
- LinkedIn posts
- Instagram captions, carousels and reel concepts
- Facebook candidate and community content
- X posts and threads
- Social media content kits
- Job marketing posts
- Founder and leadership perspectives
- Recruiter and team perspectives
- Company point-of-view content

### Out of scope

- Formal capability statements
- Client proposals
- RFP or RFI responses
- Government bids
- Capture plans
- Formal partner pitches
- Evidence-backed case studies
- Sales proposals
- Seasonal planning
- Editorial calendar automation
- Campaign orchestration
- New analytics integrations
- Proof-card workflow
- New approval routing
- New user roles
- Vector search
- A new publishing system

## 4. Simple User Experience

Keep the main form limited to:

- Topic or instruction
- Content type or platform
- Optional facts or details to include

Place optional controls under Advanced Options:

- Audience override
- Staffing domain override
- Market context override
- Content goal override
- Tone
- Hook style
- Content structure
- Existing compliance mode

The user must be able to enter a topic and generate content without opening Advanced Options.

## 5. CMO Brief Before Writing

Use the existing article brief pipeline as the strategic layer of the copilot.

Before drafting, automatically resolve a concise content brief containing:

- Primary audience
- Audience question or decision
- Staffing domain
- Market context
- Content goal
- Business objective
- Single takeaway
- Recommended platform or requested platform
- Recommended call to action
- Three hook options
- Recommended hook
- Selected content structure

The brief should be visible and editable, but it should not become a mandatory multi-step blocker. Support a quick-generate path using the automatically resolved brief.

After generation, show a compact strategy summary such as:

`IT Staffing · Employer Audience · Commercial · Thought Leadership · LinkedIn`

## 6. Automatic Context Resolution

All dimensions default to automatic selection. Explicit user selection always wins unless it conflicts with safety or compliance controls.

### Audience

- `EMPLOYER_CLIENT`
- `MSP_VMS_PARTNER`
- `CANDIDATE`
- `RECRUITER_OPERATOR`

### Staffing domain

- `GENERAL_STAFFING`
- `IT_STAFFING`
- `HEALTHCARE_STAFFING`

### Market context

- `COMMERCIAL`
- `STATE_GOVERNMENT`
- `FEDERAL_GOVERNMENT`

### Content goal

- `THOUGHT_LEADERSHIP`
- `EDUCATIONAL`
- `JOB_MARKETING`
- `BRAND_PERSPECTIVE`

### Platform

- `ARTICLE`
- `LINKEDIN`
- `INSTAGRAM`
- `FACEBOOK`
- `X`
- `SOCIAL_KIT`

Store both the resolved value and how it was selected:

- `default`
- `inferred`
- `user`

## 7. Strategy-to-Studio Label Alignment

The strategy document uses H1, H2, I1 and I2 as planning shorthand. The Studio stores audience and domain separately.

Use this mapping:

- H1 = `EMPLOYER_CLIENT` + `HEALTHCARE_STAFFING`
- H2 = `CANDIDATE` + `HEALTHCARE_STAFFING`
- I1 = `EMPLOYER_CLIENT` + `IT_STAFFING`
- I2 = `CANDIDATE` + `IT_STAFFING`

Use `MSP_VMS_PARTNER` or `RECRUITER_OPERATOR` only when the content is specifically for those audiences.

The strategy brief, Studio selection and saved draft metadata must remain aligned.

## 8. Content Pillar and Goal Alignment

The five marketing pillars remain:

- Hiring Intelligence
- Career Enablement
- Jobs and Opportunities
- Process and Proof
- People and Perspective

Map them to the Studio as follows:

- Hiring Intelligence → Thought Leadership or Educational
- Career Enablement → Educational
- Jobs and Opportunities → Job Marketing
- Process and Proof → Educational or Brand Perspective
- People and Perspective → Brand Perspective

Brand Perspective means founder viewpoints, recruiter insights, team learning, company culture, candidate-care principles and responsible recruiting practices.

It is not capability or BD content.

## 9. Audience Intelligence

### Employer or Client

Focus on:

- Requirement clarity
- Candidate relevance
- Reduced rework
- Process visibility
- Communication
- Accountability
- Business impact

Use practical and operational language. Explain why the issue matters and provide a business-relevant next step.

### MSP, VMS or Staffing Partner

Focus on:

- Submission quality
- SLA responsiveness
- Candidate ownership
- VMS discipline
- Requisition aging
- Status updates
- Documentation
- Escalation
- Reliable handoffs

Avoid vague partnership language. Show understanding of supplier execution and program discipline.

### Candidate or Professional

Focus on:

- Role relevance
- Accurate job details
- Location and work arrangement
- Schedule or shift
- Compensation when supplied
- Interview expectations
- Recruiter communication
- Clear next steps

Use direct, respectful and warm language. Avoid false urgency and exaggerated opportunity language.

### Recruiter or Staffing Operator

Focus on:

- Intake quality
- Sourcing
- Screening
- Submission readiness
- Responsible AI use
- Communication
- Documentation
- Recruiter judgment
- Process improvement

Teach practical staffing methods and distinguish technology support from human judgment.

## 10. Staffing Domain Intelligence

### General Staffing

Use for cross-industry topics such as requirement clarity, candidate experience, submission quality, communication, interview coordination, transparency and responsible AI use.

The output must remain specific and practical rather than generic corporate writing.

### IT Staffing

The copilot should understand that:

- Titles do not prove technical depth
- Keyword presence does not prove experience
- Project context, ownership, scale and environment matter
- Recency may matter depending on the role
- Must-haves and preferences are different
- Skill adjacency may matter
- Candidate interest, availability, work authorization, location and compensation still matter

Relevant areas include software engineering, quality engineering, AI and machine learning, data, cloud, DevOps, infrastructure, cybersecurity, product, program management, architecture and enterprise applications.

Do not imply that AI matching replaces technical evaluation or human judgment.

### Healthcare Staffing

The copilot should understand specialty experience, care setting, shift, schedule, location, licenses, certifications, credential readiness, submission readiness and onboarding coordination.

Relevant areas include nursing, allied health, clinical support, non-clinical healthcare support, imaging, diagnostics, laboratory, rehabilitation and healthcare administration.

Healthcare content must not provide medical, legal, clinical or licensing advice. Use existing healthcare-safe controls for candidate guidance.

## 11. Market Context Intelligence

### Commercial

Emphasize business outcomes, hiring quality, candidate experience, workforce flexibility, project delivery, communication and responsiveness.

### State Government

Emphasize public accountability, documentation, process discipline, submission completeness, workforce continuity and program-specific requirements.

Use factual, responsible and low-hype language. Do not assume that one state’s rules apply to another.

### Federal Government

Emphasize mission support, auditability, documentation, security awareness, program discipline, workforce continuity and public accountability.

Use precise, readable and low-hype language. Do not invent contract vehicles, clearances, FedRAMP, FISMA, agency endorsement or federal certifications.

## 12. Content Goal Behavior

### Thought Leadership

- Present a clear point of view
- Explain a real staffing mechanism
- Challenge a weak assumption
- Help the audience make a better decision
- Avoid turning the post into a sales pitch

### Educational

- Teach something useful
- Use staffing-specific examples
- Provide a framework, checklist or practical takeaway
- Explain limitations and uncertainty clearly

### Job Marketing

- Use only facts supplied by the user or current approved job record
- Lead with candidate relevance
- Make must-haves clear
- State location, work arrangement, schedule and employment type when supplied
- Use a simple application call to action
- Avoid fake urgency and generic excitement

Never invent compensation, benefits, location, shift, schedule, sponsorship, client or facility name, start date, number of openings, required experience, license or certification.

### Brand Perspective

- Explain how Hire’in thinks about hiring, candidate experience, responsible AI, communication, requirement clarity and submission quality
- Use founder, leadership, recruiter or team perspective
- Demonstrate judgment without becoming a formal capability statement
- Remain claim-free unless the user supplies a company fact

## 13. Claim-Free-by-Default Behavior

The copilot must not create Hire’in-specific claims on its own.

When the user provides no company claim:

- Omit company claims
- Do not invent clients, results, metrics, certifications or product features
- Do not show `[NEEDS_PROOF]`
- Keep the content useful through insight, education and point of view

When the user explicitly supplies a fact or claim:

- Treat it as `user_provided`
- Preserve its qualifiers
- Do not strengthen, quantify or broaden it
- Do not add clients, locations, outcomes or certifications
- Do not convert “may” to “does” or “supports” to “guarantees”

Recommended metadata:

- `claimSource: none`
- `claimSource: user_provided`

## 14. Platform-Native Writing

### Article

Use one strong argument, clear sections, staffing depth, practical examples and a useful conclusion. Avoid filler introductions.

### LinkedIn

Use strong first lines, professional but human writing, easy scanning, one clear takeaway and a relevant call to action. Avoid brochure language.

### Instagram

Use concise hooks, visual-first concepts, carousel or reel-friendly structure, short sections and alt text when a visual is included.

### Facebook

Use warm, direct and community-friendly language for candidate or healthcare-community content. State eligibility, location and next action clearly. Do not duplicate Instagram copy.

### X

Use one sharp idea, minimal setup and high information density. Use a thread only when the idea needs multiple steps.

### Social Kit

Preserve the same core idea across platforms but write each version independently. Use different openings, structures and calls to action. Do not copy full sentences across platforms except fixed facts, links or required wording.

## 15. Creative Quality Requirements

Use the existing `HIREIN_CONTENT_CRAFT.md` and the supplied exemplar addendum.

For social content, return:

- Three distinct hook options
- The hook archetype used for each option
- One recommended hook
- A brief recommendation rationale
- One selected content structure

When the copilot selects automatically, it must not repeat the previous comparable content structure on the same platform.

When a user manually selects a recently used structure:

- Show a “Recently used on this platform” advisory
- Suggest two alternatives
- Allow the user to continue intentionally
- Store that the repeat was user confirmed

Load one relevant exemplar by default. Do not copy exemplar language or expose exemplar placeholders.

## 16. Prompt Loading Rule

Do not load the entire knowledge base into every request.

Load only:

- Shared Hire’in marketing rules
- Selected audience guidance
- Selected staffing domain guidance
- Selected market context
- Selected content goal
- Requested platform craft
- Relevant hook and content-structure guidance
- One relevant exemplar
- User-provided facts
- Full banned-language rules
- Mandatory self-edit rules

Keep the following close to the final generation instruction:

- Do not invent facts
- Do not invent company claims
- Do not amplify user-provided claims
- Follow the selected audience and platform
- Do not copy exemplar text
- Run the self-edit pass
- Follow the structured output contract

## 17. Required Output

Extend the existing structured output compatibly. Reuse equivalent existing fields where available.

The result should contain:

- Resolved strategy summary
- Audience question
- Business objective
- Single takeaway
- Three hook options
- Recommended hook
- Selected content structure
- Core draft
- Platform-specific version or versions
- Call to action
- Visual brief when relevant
- Alt text when a visual is included
- Resolved metadata

Recommended metadata includes:

- Audience and selection source
- Staffing domain and selection source
- Market context and selection source
- Content goal and selection source
- Platform
- Hook archetype
- Content structure
- Previous comparable structure
- User-confirmed repeat flag
- Claim source

## 18. Quality Review

Run the existing quality-review mechanism for affected content in normal and compliance modes.

Review for:

- Audience fit
- Domain accuracy
- Market-context fit
- Content-goal fit
- Generic or weak opening
- Banned or AI-like language
- Unsupported or invented company claims
- Amplified user-provided claims
- Invented job details
- Healthcare or government safety issues
- Platform mismatch
- Repetitive platform copy
- Weak call to action
- Missing alt text
- Exemplar placeholder leakage
- Missing strategy metadata

Use deterministic code checks for exact banned phrases, known placeholders, malformed output, missing hooks, invalid recommended-hook ID, prohibited consecutive structure repetition and exact duplicate sentences across social variants.

Reuse the existing retry path to correct failures. Do not save or publish invalid content silently.

## 19. Measurement and Learning

The MVP should record where each metric comes from.

### Native social-platform analytics

Source: LinkedIn, Instagram, Facebook or X.

Includes:

- Reach or impressions
- Reactions
- Saves
- Shares
- Comments
- Video views

The Studio does not generate these metrics. They may be entered manually during the MVP.

### Studio and website analytics

Source: Content Studio and website analytics.

Includes:

- Content brief and strategy metadata
- Publishing details
- CTA or tracked-link clicks when configured
- Article visits
- Referral traffic
- Page engagement

### ATS and recruiter records

Source: ATS, recruiter records, shared inbox or responsible owner.

Includes:

- Applications
- Recruiter contacts
- Qualified candidate conversations
- Employer inquiries
- Other downstream actions

### Manual MVP tracking

Includes:

- New audience questions
- Qualitative feedback
- Production time
- Approval delays
- Successful content reuse

Do not present Studio data as native social-platform reach.

## 20. Implementation Tasks

### Task 1: Audit and map the existing code

Document the current article brief, prompt builder, prompt versions, structured output, metadata, social kit, review flow, retry flow and publishing flow.

Confirm the smallest reuse-first implementation before editing.

### Task 2: Complete the article brief pipeline

Add automatic context resolution and editable brief fields without turning the brief into a blocking wizard.

Ensure briefs can be created, saved, reopened and edited.

### Task 3: Add prompt intelligence blocks

Add reusable prompt blocks for audiences, staffing domains, market contexts, content goals and platforms.

Conditionally load only the relevant blocks.

### Task 4: Upgrade prompt versions

Create new versions for existing article, shape-my-draft, social-kit, LinkedIn, Instagram, Facebook, X and quality-review prompts.

Keep all prior prompt versions available for rollback.

### Task 5: Add claim-free and creative controls

Implement claim-free-by-default behavior, three-hook generation, structure selection, recent-use advisory, exemplar loading, banned-language checks and self-edit behavior.

### Task 6: Add measurement source fields

Add simple metadata or manual fields sufficient for the MVP. Do not build social-platform API integrations or an advanced analytics dashboard.

### Task 7: Test and demonstrate

Run existing regression tests and the supplied acceptance tests. Demonstrate the complete flow before activating the new prompt versions.

## 21. Definition of Done

The MVP is complete when:

- The existing agent is preserved
- The article brief pipeline is complete
- Audience, domain, market context, goal and platform are resolved automatically
- Users can override selections
- Strategy labels and Studio values are aligned
- People and Perspective maps to Brand Perspective
- Three hooks and one recommendation are generated
- Platform versions are independently written
- Company claims are not invented
- User-provided claims are not amplified
- Job facts are not invented
- Normal-mode content receives quality review
- Recent content structures are not repeated automatically
- Measurement sources are clearly recorded
- Existing review and publishing gates remain unchanged
- Previous prompt versions can be restored
- All acceptance tests pass

## 22. Replit Completion Report

At completion, provide:

- Files changed
- Functions and schemas changed
- Prompt versions created
- Existing components reused
- Test results
- Rollback result
- Screenshots or recording of the demonstration
- Known limitations
- Any remaining blockers

## 23. Copy-and-Paste Replit Instruction

Read all files in this handoff package before editing the codebase.

Finalize the existing Hire’in Content Studio agent as an AI CMO Content Copilot for marketing, Hire’in Insights, social media, job marketing and brand perspective content.

Do not build a new agent. Continue and preserve the article-brief backend and frontend work already in progress. Reuse the existing prompt builder, prompt versions, structured outputs, retries, metadata, social kit, quality review, peer review and publish approval.

Implement automatic audience, staffing-domain, commercial/state/federal context, content-goal and platform resolution. Keep the main experience simple and place overrides under Advanced Options.

Use the article brief as a compact strategic layer that resolves the audience question, objective, takeaway, CTA, three hooks and content structure before drafting. Do not make it a blocking wizard.

Use claim-free-by-default behavior. Do not invent Hire’in claims or show NEEDS_PROOF markers. Use company facts only when the user explicitly supplies them, and never strengthen or broaden them.

Map People and Perspective to Brand Perspective. Align H1/H2/I1/I2 planning labels with the Studio’s audience and domain fields. Separate native social metrics from Studio, website, ATS and manual tracking.

Load only relevant prompt blocks and one relevant exemplar. Apply banned-language controls, self-editing, platform-native writing, structure rotation and universal quality review.

Do not add BD workflows, proof-card workflows, seasonal planning, new roles, new approval systems, vector search, social-platform integrations or an advanced analytics dashboard.

Complete all acceptance tests, preserve rollback and provide the completion report.
