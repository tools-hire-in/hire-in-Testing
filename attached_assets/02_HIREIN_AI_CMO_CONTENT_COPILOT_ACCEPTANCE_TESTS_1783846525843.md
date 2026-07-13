# HIRE’IN AI CMO CONTENT COPILOT
## MVP Acceptance Tests

## A. Existing-System Preservation

- A1. Existing content-generation routes still work.
- A2. Existing drafts open without data loss.
- A3. Existing peer review and publish approval remain unchanged.
- A4. Prior prompt versions remain available and can be reactivated.
- A5. No new user roles or approval workflows are introduced.

## B. Article Brief Pipeline

- B1. A user can create an article brief from a topic.
- B2. The brief can be saved, reopened and edited.
- B3. Quick Generate works without requiring the user to edit every field.
- B4. The brief includes audience, audience question, domain, market context, goal, objective, takeaway, CTA and platform.
- B5. The resolved strategy summary is visible after generation.

## C. Audience and Label Alignment

- C1. H1 resolves to Employer/Client plus Healthcare.
- C2. H2 resolves to Candidate plus Healthcare.
- C3. I1 resolves to Employer/Client plus IT.
- C4. I2 resolves to Candidate plus IT.
- C5. MSP/VMS Partner content uses the partner audience rather than an employer fallback.
- C6. Recruiter education uses the Recruiter/Operator audience.
- C7. Brief values, UI values and stored metadata remain consistent.

## D. Domain and Market Context

- D1. An engineering topic resolves to IT Staffing.
- D2. A nursing or allied-health topic resolves to Healthcare Staffing.
- D3. A cross-industry staffing topic resolves to General Staffing.
- D4. A state-program topic uses factual state-government language.
- D5. A federal topic uses mission-aware, low-hype federal language.
- D6. The system does not invent state or federal approvals, certifications or contract vehicles.

## E. Content Goals

- E1. An opinion or mechanism topic resolves to Thought Leadership.
- E2. A how-to or checklist topic resolves to Educational.
- E3. A live requirement resolves to Job Marketing.
- E4. Founder, recruiter, team-learning and company-POV content resolves to Brand Perspective.
- E5. No Capability/BD content goal appears in this Marketing Agent.

## F. Claim-Free Behavior

- F1. A general topic with no company facts produces no Hire’in-specific claims.
- F2. Normal output contains no `[NEEDS_PROOF]` marker.
- F3. A user-provided fact may be included.
- F4. A user-provided qualifier such as “may” or “supports” is preserved.
- F5. The system does not add metrics, clients, locations, certifications or outcomes to a user-provided claim.
- F6. A prompt asking the model to invent a client result is rejected or rewritten without the claim.

## G. Job Marketing Accuracy

- G1. Missing compensation is omitted.
- G2. Missing shift or schedule is omitted.
- G3. Missing location or work arrangement is omitted.
- G4. Missing sponsorship, client or facility name is not invented.
- G5. Healthcare recency or minimum-duration language is used only when supplied.
- G6. IT job content distinguishes demonstrated depth from keyword presence without inventing requirements.

## H. Hooks, Structures and Exemplars

- H1. Social generation returns three distinct hook options.
- H2. Each hook includes its archetype.
- H3. One hook is recommended with a brief rationale.
- H4. The selected content structure is stored in metadata.
- H5. Automatic selection does not repeat the previous comparable structure on the same platform.
- H6. Manual repetition shows a recent-use advisory and two alternatives.
- H7. A user can intentionally confirm the repeat.
- H8. Exemplar sentences and placeholders do not appear in output.

## I. Platform Adaptation

- I1. LinkedIn content uses a professional tension, useful body and relevant CTA.
- I2. Instagram content includes visual-first framing and alt text when applicable.
- I3. Facebook candidate content is warm, direct and community appropriate.
- I4. X content is concise and does not use a thread unnecessarily.
- I5. A Social Kit preserves the core idea but uses independently written platform versions.
- I6. No prohibited exact duplicate full sentences appear across platform variants.

## J. Quality Review

- J1. Normal-mode content runs through the quality review.
- J2. Exact banned phrases are detected by deterministic validation.
- J3. Paraphrased generic or AI-like language is caught by semantic review.
- J4. Weak or generic openings are flagged.
- J5. Wrong-audience and wrong-domain content is flagged.
- J6. Invented company claims or job details are hard failures.
- J7. Missing strategy metadata is detected.
- J8. The existing retry path corrects eligible failures.
- J9. Invalid content is not silently saved or published.

## K. Measurement Sources

- K1. Native reach and impressions are identified as social-platform metrics.
- K2. Studio and website metrics are kept separate from native social metrics.
- K3. Applications and inquiries can be attributed to ATS, recruiter or shared-inbox records.
- K4. Audience questions, production time and approval delays can be captured manually.
- K5. The MVP does not require social API integrations or an advanced analytics dashboard.

## L. Required Demonstration

Demonstrate:

1. Create and save an IT employer thought-leadership brief.
2. Generate three hooks and a LinkedIn post.
3. Change the audience to MSP/VMS Partner and show meaningful framing changes.
4. Generate a healthcare candidate educational post with healthcare-safe behavior.
5. Generate a job post with missing details and show that nothing is invented.
6. Generate a Brand Perspective founder post without company performance claims.
7. Generate a four-platform social kit and show independent adaptations.
8. Generate another post on the same platform and show structure rotation.
9. Manually repeat the previous structure and show the advisory and override.
10. Reactivate the previous prompt version and confirm rollback.
