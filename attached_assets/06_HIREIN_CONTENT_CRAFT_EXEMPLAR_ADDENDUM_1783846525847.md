# Hire’in Content Craft — Exemplar Addendum v1.2
## Job Marketing and Capability / Business Development

**Version:** 1.2  
**Purpose:** Close the two missing exemplar categories required by the Hire’in Content Agent Intelligence Pack.  
**Status:** Approved creative-source extension pending insertion into the main `HIREIN_CONTENT_CRAFT.md`.

These exemplars are quality anchors. They are not reusable factual claims.

---

# Exemplar F — Job Marketing

## Classification

- **Content Goal:** Job Marketing
- **Primary Platform:** LinkedIn
- **Audience:** Candidate / Professional
- **Domain:** IT Staffing
- **Hook Pattern:** Candidate-Fit Filter
- **Content Archetype:** Role Reality Check
- **Purpose:** Attract relevant candidates while discouraging weak-fit applications
- **Proof dependency:** Job facts only; every bracketed field must come from the current approved job record

## Exemplar

```text
[ROLE_TITLE] | [LOCATION] | [WORK_ARRANGEMENT]

This role is for someone who has actually owned [CORE_RESPONSIBILITY] in a production environment—not someone whose experience is limited to exposure or support.

You may be a strong fit when you have:

• [MUST_HAVE_1]
• [MUST_HAVE_2]
• [MUST_HAVE_3]
• Experience working in [RELEVANT_ENVIRONMENT_OR_SCALE]

The work will involve [RESPONSIBILITY_1], [RESPONSIBILITY_2], and close coordination with [STAKEHOLDER_OR_TEAM].

Before applying, please confirm that [LOCATION / SCHEDULE / WORK AUTHORIZATION / OTHER MATERIAL REQUIREMENT] works for you.

Interested candidates can send a resume to [APPROVED_CONTACT] with “[ROLE_TITLE]” in the subject line.

Missing information is intentionally not filled in. Compensation, benefits, sponsorship, client identity, and timing should appear only when confirmed in the approved job record.
```

## Why this works

- Opens with a fit filter rather than generic enthusiasm
- Distinguishes demonstrated ownership from keyword exposure
- Makes must-haves visible
- Uses only known job facts
- Helps candidates self-qualify
- Avoids false urgency
- Uses a clear, low-friction CTA
- Does not invent compensation, benefits, sponsorship, or client details

## Do not copy

Do not reuse the phrases:

- “This role is for someone who…”
- “You may be a strong fit when…”
- “Before applying…”

The Agent should reproduce the pattern, not the wording.

## Placeholder control

Every bracketed item is a required source field.

If a field is unavailable:

- Omit the sentence or bullet, or
- Mark the field for confirmation

Never output the bracketed placeholder itself in published content.

## Healthcare adaptation for Exemplar F

The Job Marketing mechanism remains the same—help the right candidate self-qualify—but the fit language must change for healthcare roles.

Do not use “owned in a production environment” framing for nurses, allied-health professionals, or clinical-support candidates.

Use a healthcare-specific fit filter such as:

```text
[ROLE_TITLE] | [LOCATION] | [WORK_ARRANGEMENT]

This opportunity is best suited to a candidate with [EXPERIENCE_RECENCY_OR_DURATION: recent / minimum X years / omit] [SPECIALTY_OR_ROLE] experience in a [CARE_SETTING] environment who is comfortable with [SHIFT / SCHEDULE / PATIENT_POPULATION / CORE_RESPONSIBILITY].

You may be a strong fit when you have:

• [REQUIRED_LICENSE_OR_CERTIFICATION]
• [SPECIALTY_EXPERIENCE]
• [CARE_SETTING_OR_PROCEDURE_EXPERIENCE]
• Availability for [SHIFT / SCHEDULE / START_EXPECTATION]

Before applying, please confirm that the location, schedule, and required credentials align with your current situation.

Interested candidates can send a resume to [APPROVED_CONTACT] with “[ROLE_TITLE]” in the subject line.
```

### Healthcare-specific rules

- Lead with specialty and care-setting fit
- Confirm license/certification only from the approved job record
- Never imply credentialing is complete unless verified
- Never invent shift, schedule, patient population, facility, start date, compensation, or travel terms
- Use “recent experience” only when the approved job requirement supports it
- Otherwise use the approved minimum duration, or omit recency/duration language entirely
- Never infer recency from specialty, setting, urgency, or recruiter preference
- Keep the tone respectful and candidate-centered
- Apply existing healthcare-safe controls

---


# Exemplar G — Capability / Business Development

## Classification

- **Content Goal:** Capability / Business Development
- **Primary Platform:** LinkedIn
- **Audience:** MSP / VMS / Staffing Partner
- **Domain:** General Staffing, with IT and Healthcare relevance
- **Market Context:** Commercial
- **Hook Pattern:** Operational Contrast
- **Content Archetype:** Mechanism Explainer
- **Purpose:** Explain Hire’in’s delivery approach without unsupported sales claims
- **Proof dependency:** Any Hire’in-specific capability or outcome must use an approved PC-## card

## Exemplar

```text
More submissions do not fix a poorly calibrated requisition. They multiply the noise.

For niche IT and healthcare roles, the quality of the delivery process is often decided before sourcing begins.

A disciplined workflow starts by clarifying:

• Which requirements are genuinely non-negotiable
• Which skills can be adjacent or transferable
• What the candidate must have done—not merely listed
• Which location, schedule, compensation, credential, or availability constraints could stop the process later

Technology can support that work.

[PC-##: approved KlerHire capability wording] may help simplify the job description, identify resume alignment, and surface gaps. A recruiter still has to validate depth, interest, communication, availability, and the context behind the resume.

The same discipline should continue after submission:

• Complete handoff notes
• Clear candidate ownership
• Timely status updates
• Early escalation when a requirement or timeline changes

[PC-##: approved Hire’in delivery or communication claim]

For MSPs, VMS teams, and staffing partners, the useful question is not “How many resumes can a supplier send?”

It is: “Can this supplier help us make the next decision with less ambiguity?”

To explore a pilot, share one difficult requisition and the submission standard your program expects.
```

## Why this works

- Leads with the load-bearing creative decision: an operational truth instead of a company introduction
- Challenges the volume-equals-quality assumption without overexplaining
- Speaks to the MSP/partner decision
- Explains the mechanism behind quality
- Positions AI as support for human judgment
- Makes communication and transparency concrete
- Uses proof placeholders where Hire’in-specific claims would appear
- Ends with a credible, specific CTA
- Avoids unsupported superlatives and generic partnership language

## Do not copy

Do not reuse the exact opening, list structure, or CTA.

The Agent should reproduce:

- Decision-focused framing
- Operational specificity
- AI-plus-human balance
- Proof-aware company claims
- Low-hype commercial CTA

## Placeholder control

`[PC-##: ...]` is a prompt-only proof placeholder.

During generation:

- Replace it only with wording authorized by a supplied proof card
- Otherwise render `[NEEDS_PROOF: ...]`
- Never output the exemplar placeholder verbatim in final content

---

# Integration Instructions

Add these as new approved entries in `HIREIN_CONTENT_CRAFT.md` §6:

- **Exemplar F — Job Marketing**, including its healthcare adaptation
- **Exemplar G — Capability / Business Development**

After insertion, the exemplar coverage preflight should report:

```text
Thought Leadership: FOUND
Educational / Explainer: FOUND
Job Marketing: FOUND
Capability / Business Development: FOUND
```

The Agent should load only the exemplar relevant to the selected content goal and platform.

---

# Quality Standard

These exemplars establish the minimum pattern quality for their categories:

```text
Specific audience
+ real staffing mechanism
+ accurate facts
+ proof-aware claims
+ platform-native structure
+ clear next action
```


---

# v1.2 Change Note

This revision removes the hardcoded healthcare “recent experience” assumption.

The exemplar now requires one of three source-controlled options:

- Recent experience, only when explicitly required
- Approved minimum duration
- Omit recency/duration language
