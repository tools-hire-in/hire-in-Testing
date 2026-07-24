# Hire’in Solutions
# Verified Recognition Certificate System
## Product Requirements, UX, Data Model, Verification, and Replit Implementation Specification

**Document Type:** Implementation Specification  
**Product Area:** Employee Portal → My Growth → Praise  
**Primary Users:** Employees, Managers, HR/Admin, Super Admin  
**Implementation Platform:** Existing Hire’in Employee Portal  
**Recommended Output Format:** PDF certificate with public verification page and QR code  
**Version:** 1.0  

---

# 1. Purpose

This feature will convert eligible employee praise records into authenticated, verifiable recognition credentials.

The system must allow Hire’in Solutions to:

- recognize employees through badges and praise posts;
- generate a professional PDF recognition certificate;
- assign a unique, non-sequential certificate ID;
- create a public verification record;
- embed a QR code that opens the verification page;
- maintain audit history, versioning, correction, supersession, and revocation;
- prevent informal peer praise from being represented as a formal professional certification.

The primary certificate title will be:

# **Certificate of Verified Recognition**

This is a workplace recognition credential. It must not be represented as an academic degree, professional license, regulated certification, or skills certification unless a separate assessment-based certification process exists.

---

# 2. Product Principles

## 2.1 Recognition is not the same as certification

The system must distinguish between:

| Achievement Type | Output |
|---|---|
| Peer praise | Praise post and digital badge |
| Manager-verified praise | Verified Recognition Certificate |
| Repeated verified achievements | Achievement Certificate |
| Training completed without assessment | Certificate of Completion |
| Training completed with formal assessment | Professional Certification |

The Praise module must generate only recognition credentials unless a separate formal training and assessment workflow is used.

## 2.2 Authenticity must come from verification

The certificate must look professional, but its credibility must come from:

- unique certificate ID;
- public verification URL;
- QR code;
- issuer and approver information;
- document version;
- issue date;
- status management;
- audit trail;
- stored PDF hash.

## 2.3 Every praise can be appreciated; only verified praise becomes a certificate

The system must support immediate praise posting while applying controlled approval before generating a formal certificate.

---

# 3. Scope

## 3.1 In Scope

- Praise badge creation
- Peer and manager recognition
- Manager/HR verification workflow
- Certificate preview
- PDF certificate generation
- Unique certificate ID generation
- Public verification page
- QR code generation
- Certificate download
- Recognition audit history
- Correction, supersession, and revocation
- Privacy controls
- Recognition milestones
- Notifications

## 3.2 Out of Scope for This Phase

- External blockchain credentialing
- Third-party credential marketplaces
- Academic transcript generation
- Professional license verification
- Formal certification exams
- LinkedIn API publishing
- Open Badges 3.0 integration

These can be considered later.

---

# 4. User Roles and Permissions

## 4.1 Employee

Can:

- give praise to eligible colleagues;
- view company-visible praise;
- view their own recognition history;
- view and download their issued certificates;
- verify their certificate using the public verification page;
- report an incorrect certificate.

Cannot:

- approve their own recognition;
- edit an issued certificate;
- revoke a certificate;
- change certificate status.

## 4.2 Manager

Can:

- give praise;
- review praise involving direct reports;
- approve, reject, or return a recognition for clarification;
- edit the public certificate citation before approval;
- approve certificate generation, subject to policy;
- view team recognition records.

## 4.3 HR/Admin

Can:

- review all pending recognition requests;
- approve certificates;
- reject inappropriate or unsupported recognition;
- edit public citation text;
- correct certificates;
- supersede or revoke certificates;
- manage badge definitions;
- manage milestone rules;
- view audit history;
- regenerate PDFs when allowed.

## 4.4 Super Admin

Can:

- perform all HR/Admin actions;
- configure permissions;
- configure verification URLs and certificate numbering;
- manage certificate templates;
- access full audit records;
- restore configuration defaults.

---

# 5. Recognition Badge Catalog

The current badge catalog must be preserved and each badge must have controlled wording.

| Badge | Code | Controlled Certificate Statement |
|---|---|---|
| Above & Beyond | AB | For exceeding expected responsibilities and demonstrating exceptional ownership in support of the team, client, or organization. |
| Client Champion | CC | For representing client needs with responsiveness, professionalism, integrity, and consistent delivery discipline. |
| Culture Champion | CU | For strengthening a respectful, inclusive, accountable, and collaborative workplace through consistent actions. |
| Innovation | IN | For introducing a practical idea or improvement that enhanced quality, efficiency, experience, or business outcomes. |
| Leadership | LD | For demonstrating clear direction, sound judgment, accountability, and a positive influence on others. |
| Mentor | MT | For investing in the growth of colleagues through coaching, guidance, encouragement, and knowledge sharing. |
| Problem Solver | PS | For identifying the underlying cause of a challenge and delivering a thoughtful, practical, and effective solution. |
| Rising Star | RS | For demonstrating strong professional growth, initiative, learning agility, and increasing organizational impact. |
| Star Performer | SP | For consistently delivering high-quality results against important responsibilities, goals, and expectations. |
| Team Player | TP | For collaborating reliably, supporting colleagues, sharing ownership, and contributing to collective success. |

Badge names, codes, icons, descriptions, approval requirements, and certificate eligibility must be configurable by an authorized admin.

---

# 6. Recognition Workflow

## 6.1 Step 1: Give a Badge

The recognizer selects **Give a Badge** and completes the following fields.

### Required Fields

1. **Recognize Employee**
   - Search and select one active employee.
   - Self-recognition is not allowed.

2. **Recognition Badge**
   - Select one badge.

3. **What did the employee do?**
   - Minimum recommended length: 40 characters.
   - Prompt: `Describe the specific action, contribution, or behavior being recognized.`

4. **Why did it matter?**
   - Prompt: `Explain the positive impact on the team, client, candidate, process, quality, or business outcome.`

5. **Related To**
   - Client delivery
   - Candidate experience
   - Team collaboration
   - Process improvement
   - Quality and compliance
   - Learning and mentoring
   - Leadership
   - Other

6. **Recognition Visibility**
   - Company-wide
   - Department only
   - Recipient and manager only

7. **Certificate Eligibility Request**
   - Checkbox label: `Submit this recognition for a verified certificate.`
   - This checkbox may be automatically selected for manager-issued praise.

### Optional Fields

- Related project
- Related client
- Related goal
- Supporting evidence or attachment
- Private note to approver

## 6.2 Step 2: Validation

Before submission, validate that:

- recipient is active;
- recognizer is not the recipient;
- badge is active;
- required text is completed;
- content does not contain prohibited information;
- recipient visibility rules are respected;
- supporting evidence is present when required by badge policy.

## 6.3 Step 3: Praise Post Created

After submission:

- praise post appears according to its visibility setting;
- recipient receives an in-app notification;
- recipient receives the digital badge;
- certificate status becomes `pending_verification` when certificate eligibility is requested;
- otherwise, the praise remains an informal recognition only.

## 6.4 Step 4: Manager or HR Review

Reviewer sees:

- recipient;
- recognizer;
- badge;
- action statement;
- impact statement;
- evidence;
- visibility;
- proposed public citation;
- certificate preview.

Available actions:

- Approve and issue
- Approve with citation edit
- Return for clarification
- Reject certificate request
- Mark recognition private

Rejecting the certificate request must not automatically delete the praise post unless the content itself violates policy.

## 6.5 Step 5: Certificate Issuance

When approved:

1. Generate the certificate ID.
2. Generate the public verification token.
3. Create the public verification record.
4. Generate the QR code.
5. Generate the PDF.
6. Calculate and store the SHA-256 hash of the final PDF.
7. Save the PDF reference and metadata.
8. Record the issuance audit event.
9. Notify the recipient.

---

# 7. Certificate Eligibility Rules

## 7.1 Peer Praise

Peer praise must not automatically generate a certificate.

It becomes certificate-eligible only after manager or HR verification.

## 7.2 Manager Praise

Manager-issued praise may be automatically routed for certificate issuance, but approval must still be recorded.

Configuration options:

- manager can directly issue;
- manager approval plus HR approval;
- HR-only approval.

## 7.3 Higher-Control Badges

The following badges should support stricter approval rules:

- Leadership
- Star Performer
- Client Champion
- Above & Beyond

Recommended requirement:

- approval by manager or department head;
- evidence or specific outcome statement;
- HR approval for company-wide certificate issuance.

## 7.4 Milestone Certificates

The platform may automatically create certificate eligibility after configurable milestones such as:

- three verified recognitions from different colleagues;
- recognitions from two separate departments;
- a quarterly recognition threshold;
- verified client feedback;
- repeated mentoring contributions;
- recognition connected to completed goals.

Milestone thresholds must be configurable and must not be hard-coded.

---

# 8. Certificate Template

## 8.1 Document Format

- Orientation: Landscape
- Default size: US Letter, 11 × 8.5 inches
- Optional alternate size: A4 landscape
- Export: PDF
- Print-safe margins
- QR code must remain scannable in printed and digital versions

## 8.2 Brand Style

Use Hire’in brand styling:

- Brand Navy: `#1F3A6E`
- Brand Orange: `#F96D3E`
- Background: white or very light neutral
- Thin navy outer border
- Orange accent line
- Hire’in watermark behind recipient name
- Badge icon displayed within a seal
- QR code in black on white

Avoid:

- fake embossed seals;
- excessive gold effects;
- decorative stock signatures;
- wording that implies formal occupational certification.

## 8.3 Certificate Layout

### Header Left

- Hire’in Solutions logo
- `Employee Growth & Recognition Program`

### Header Right

- Verified status marker
- `VERIFIED DIGITAL CREDENTIAL`

### Main Title

# CERTIFICATE OF VERIFIED RECOGNITION

### Recipient Section

`This certificate is proudly presented to`

# [EMPLOYEE FULL NAME]

`In recognition of earning the`

## [BADGE ICON] [BADGE NAME]

### Controlled Recognition Statement

Use the configured badge statement.

Example:

`For representing client needs with responsiveness, professionalism, integrity, and consistent delivery discipline.`

### Recognition Citation

Label:

`Recognition Citation`

Content:

`“[APPROVED PUBLIC PRAISE MESSAGE]”`

Below the citation:

- Recognized by [Name, Position/Department]
- Verified by [Approver Name, Position]

### Footer Left

- Recognition date
- Issue date
- Certificate ID
- Version

### Footer Center

- Authorized digital signature or issuer seal
- Hire’in Solutions
- People & Culture / Authorized Issuer

### Footer Right

- QR code
- `Scan to verify authenticity`
- short verification URL if space permits

### Bottom Legal Statement

`This certificate recognizes a documented workplace contribution recorded through the Hire’in Solutions employee recognition system. It is not an academic degree, professional license, or regulated occupational certification.`

---

# 9. Master Certificate Copy

Use the following copy as the default template.

---

## CERTIFICATE OF VERIFIED RECOGNITION

### This certificate is proudly presented to

# [EMPLOYEE FULL NAME]

In recognition of earning the

## [BADGE NAME]

This recognition is awarded for demonstrating **[BADGE-SPECIFIC BEHAVIOR]** and for making a meaningful contribution to **[TEAM, CLIENT, PROJECT, DEPARTMENT, OR ORGANIZATIONAL OUTCOME]**.

### Recognition Citation

> “[APPROVED PRAISE MESSAGE]”

This recognition was submitted by **[RECOGNIZER NAME, TITLE]** and validated through the Hire’in Solutions employee recognition process.

**Recognition Date:** [DATE]  
**Issue Date:** [DATE]  
**Certificate ID:** [CERTIFICATE ID]  
**Version:** [VERSION]

**[AUTHORIZED APPROVER NAME]**  
[APPROVER TITLE]  
Hire’in Solutions

**Scan the QR code or visit the verification address shown on this certificate to confirm its authenticity.**

---

# 10. Certificate ID Standard

Use a non-sequential, human-readable certificate ID.

Recommended format:

`HIS-REC-[BADGE_CODE]-[YY]-[RANDOM_6]`

Example:

`HIS-REC-CC-26-7Q9M4K`

Rules:

- `HIS` = Hire’in Solutions
- `REC` = Recognition
- badge code = configured code
- year = two-digit issuance year
- random segment = uppercase alphanumeric random value
- random segment must not be based on employee ID or database sequence
- certificate ID must be unique
- certificate ID must be indexed in the database

Do not use predictable IDs such as `CERT-000001`.

---

# 11. Public Verification URL and QR Code

## 11.1 Verification URL

Recommended format:

`https://employee.hire-in.com/verify/recognition/[PUBLIC_TOKEN]`

The public token must:

- be cryptographically random;
- be non-sequential;
- contain no employee information;
- contain no certificate metadata;
- be stored as a hash when practical;
- not expose internal database IDs.

## 11.2 QR Code

The QR code must contain only the public verification URL.

It must not directly contain:

- employee ID;
- email;
- manager details;
- certificate content;
- internal record ID.

Recommended QR properties:

- black foreground;
- white background;
- minimum print size approximately 1.1 inches;
- medium or high error correction;
- no visual logo overlay unless scan reliability is tested.

---

# 12. Public Verification Page

## 12.1 Page Title

# Verified Recognition Record

## 12.2 Required Fields

- Status
- Recipient name
- Badge name
- Issuing organization
- Recognition date
- Issue date
- Recognized by
- Verified by
- Certificate ID
- Document version
- Recognition summary

## 12.3 Status Display

Supported public statuses:

- Valid
- Corrected
- Superseded
- Revoked

### Valid

Display a green verified indicator.

### Corrected

Display:

`This certificate was corrected. The currently valid version is shown below.`

### Superseded

Display:

`This certificate has been superseded by a newer version.`

Include a link to the current version.

### Revoked

Display:

`This certificate is no longer valid.`

Do not display sensitive revocation reasons publicly.

## 12.4 Verification Statement

Use:

`This record confirms that the displayed recognition certificate was issued through the Hire’in Solutions employee recognition system and has not been revoked or superseded.`

## 12.5 Public Actions

- View Certificate
- Download Verified PDF
- Copy Certificate ID

## 12.6 Privacy Rules

Do not publicly show:

- employee email;
- phone number;
- employee ID;
- home address;
- internal manager comments;
- HR notes;
- confidential client data;
- internal performance ratings;
- private evidence attachments.

---

# 13. Certificate Status Model

Use the following statuses:

```text
draft
pending_verification
returned_for_clarification
approved
issued
corrected
superseded
revoked
rejected
```

## Status Rules

### draft
Recognition is being created and is not visible.

### pending_verification
Praise is submitted and awaiting approval.

### returned_for_clarification
Reviewer requires more information.

### approved
Recognition is approved, but issuance has not completed.

### issued
Certificate and verification record are active.

### corrected
Certificate was corrected and remains part of version history.

### superseded
A newer certificate version replaced the current certificate.

### revoked
Certificate is no longer valid.

### rejected
Certificate request was rejected. Praise may remain visible depending on moderation decision.

---

# 14. Data Model

The names below may be adjusted to match the existing schema conventions.

## 14.1 `recognition_badges`

```sql
CREATE TABLE recognition_badges (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) UNIQUE NOT NULL,
  icon VARCHAR(255),
  description TEXT NOT NULL,
  certificate_statement TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  requires_manager_approval BOOLEAN NOT NULL DEFAULT TRUE,
  requires_hr_approval BOOLEAN NOT NULL DEFAULT FALSE,
  requires_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 14.2 `recognition_posts`

```sql
CREATE TABLE recognition_posts (
  id SERIAL PRIMARY KEY,
  recipient_user_id INTEGER NOT NULL REFERENCES users(id),
  recognizer_user_id INTEGER NOT NULL REFERENCES users(id),
  badge_id INTEGER NOT NULL REFERENCES recognition_badges(id),
  action_description TEXT NOT NULL,
  impact_description TEXT NOT NULL,
  public_citation TEXT,
  recognition_context VARCHAR(100),
  related_project VARCHAR(255),
  related_client VARCHAR(255),
  related_goal_id INTEGER,
  visibility VARCHAR(40) NOT NULL DEFAULT 'company',
  certificate_requested BOOLEAN NOT NULL DEFAULT FALSE,
  praise_status VARCHAR(40) NOT NULL DEFAULT 'published',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (recipient_user_id <> recognizer_user_id)
);
```

## 14.3 `recognition_evidence`

```sql
CREATE TABLE recognition_evidence (
  id SERIAL PRIMARY KEY,
  recognition_post_id INTEGER NOT NULL REFERENCES recognition_posts(id) ON DELETE CASCADE,
  evidence_type VARCHAR(50) NOT NULL,
  file_reference TEXT,
  external_reference TEXT,
  evidence_note TEXT,
  uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 14.4 `recognition_certificates`

```sql
CREATE TABLE recognition_certificates (
  id SERIAL PRIMARY KEY,
  recognition_post_id INTEGER NOT NULL REFERENCES recognition_posts(id),
  recipient_user_id INTEGER NOT NULL REFERENCES users(id),
  badge_id INTEGER NOT NULL REFERENCES recognition_badges(id),
  certificate_id VARCHAR(80) UNIQUE NOT NULL,
  public_token_hash VARCHAR(255) UNIQUE NOT NULL,
  public_token_last4 VARCHAR(4),
  title VARCHAR(255) NOT NULL DEFAULT 'Certificate of Verified Recognition',
  recognition_citation TEXT NOT NULL,
  impact_summary TEXT,
  recognized_by_user_id INTEGER NOT NULL REFERENCES users(id),
  verified_by_user_id INTEGER REFERENCES users(id),
  recognition_date DATE NOT NULL,
  issued_at TIMESTAMP,
  status VARCHAR(40) NOT NULL DEFAULT 'pending_verification',
  version INTEGER NOT NULL DEFAULT 1,
  pdf_file_reference TEXT,
  pdf_sha256_hash VARCHAR(64),
  superseded_by_certificate_id INTEGER REFERENCES recognition_certificates(id),
  corrected_from_certificate_id INTEGER REFERENCES recognition_certificates(id),
  revocation_reason_internal TEXT,
  revoked_by_user_id INTEGER REFERENCES users(id),
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 14.5 `recognition_certificate_audit`

```sql
CREATE TABLE recognition_certificate_audit (
  id SERIAL PRIMARY KEY,
  certificate_id INTEGER NOT NULL REFERENCES recognition_certificates(id) ON DELETE CASCADE,
  action VARCHAR(80) NOT NULL,
  performed_by_user_id INTEGER REFERENCES users(id),
  previous_status VARCHAR(40),
  new_status VARCHAR(40),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_hash VARCHAR(255),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 14.6 `recognition_certificate_views`

```sql
CREATE TABLE recognition_certificate_views (
  id SERIAL PRIMARY KEY,
  certificate_id INTEGER NOT NULL REFERENCES recognition_certificates(id) ON DELETE CASCADE,
  access_type VARCHAR(30) NOT NULL,
  ip_hash VARCHAR(255),
  user_agent TEXT,
  accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 14.7 Recommended Indexes

```sql
CREATE INDEX idx_recognition_posts_recipient ON recognition_posts(recipient_user_id);
CREATE INDEX idx_recognition_posts_recognizer ON recognition_posts(recognizer_user_id);
CREATE INDEX idx_recognition_posts_badge ON recognition_posts(badge_id);
CREATE INDEX idx_recognition_certificates_recipient ON recognition_certificates(recipient_user_id);
CREATE INDEX idx_recognition_certificates_status ON recognition_certificates(status);
CREATE INDEX idx_recognition_certificates_issued_at ON recognition_certificates(issued_at DESC);
CREATE INDEX idx_recognition_audit_certificate ON recognition_certificate_audit(certificate_id);
```

---

# 15. API Requirements

The endpoint names can be adapted to the existing route convention.

## 15.1 Badge APIs

### `GET /api/growth/recognition/badges`

Returns active badge definitions.

### `POST /api/admin/growth/recognition/badges`

Creates a badge.

### `PATCH /api/admin/growth/recognition/badges/:badgeId`

Updates badge configuration.

## 15.2 Praise APIs

### `POST /api/growth/recognition`

Creates a praise post.

Request example:

```json
{
  "recipientUserId": 42,
  "badgeId": 3,
  "actionDescription": "Identified a critical onboarding gap and coordinated resolution before the start date.",
  "impactDescription": "Prevented a client delay and improved candidate experience.",
  "recognitionContext": "quality_compliance",
  "visibility": "company",
  "certificateRequested": true
}
```

### `GET /api/growth/recognition`

Supports filters:

- recipient
- badge
- department
- date range
- visibility
- status

### `GET /api/growth/recognition/:recognitionId`

Returns recognition details based on authorization.

### `PATCH /api/growth/recognition/:recognitionId`

Allowed only before approval or when returned for clarification.

## 15.3 Review APIs

### `GET /api/manager/growth/recognition/pending`

Returns pending approvals for the manager.

### `POST /api/manager/growth/recognition/:recognitionId/approve`

Approves recognition and optionally issues the certificate.

### `POST /api/manager/growth/recognition/:recognitionId/return`

Returns for clarification.

### `POST /api/manager/growth/recognition/:recognitionId/reject`

Rejects certificate eligibility.

## 15.4 Certificate APIs

### `POST /api/admin/growth/recognition/:recognitionId/issue-certificate`

Creates verification record and PDF.

### `GET /api/growth/certificates/my`

Returns certificates belonging to the authenticated employee.

### `GET /api/growth/certificates/:certificateId`

Returns authorized certificate metadata.

### `GET /api/growth/certificates/:certificateId/download`

Downloads the issued PDF.

### `POST /api/admin/growth/certificates/:certificateId/correct`

Creates a corrected version.

### `POST /api/admin/growth/certificates/:certificateId/revoke`

Revokes the certificate.

### `POST /api/admin/growth/certificates/:certificateId/regenerate-pdf`

Regenerates only when permitted and preserves audit history.

## 15.5 Public Verification API

### `GET /api/public/verify/recognition/:publicToken`

Returns only public-safe fields.

It must:

- be rate-limited;
- never return internal IDs;
- never return private notes;
- never reveal email or employee ID;
- log access in a privacy-conscious manner.

---

# 16. Certificate Generation Service

Create a dedicated service, for example:

```text
server/services/recognitionCertificateService.ts
```

Recommended responsibilities:

- validate approval state;
- generate certificate ID;
- generate public token;
- create public token hash;
- build QR code;
- render certificate HTML;
- generate PDF using the portal’s existing PDF generation approach;
- calculate SHA-256 hash;
- store file reference and metadata;
- record audit event;
- trigger recipient notification.

Recommended service functions:

```typescript
generateCertificateId(badgeCode: string, issuedAt: Date): Promise<string>
generatePublicVerificationToken(): string
hashPublicToken(token: string): string
buildVerificationUrl(token: string): string
generateQrCodeDataUrl(url: string): Promise<string>
renderCertificateHtml(data: RecognitionCertificateTemplateData): Promise<string>
generateCertificatePdf(html: string): Promise<Buffer>
calculateSha256(buffer: Buffer): string
issueRecognitionCertificate(recognitionId: number, approverUserId: number): Promise<IssuedCertificate>
```

Issuance must be transactional where possible. A partial certificate must not appear as valid.

---

# 17. PDF Generation Requirements

The existing PDF generation infrastructure should be reused.

The PDF renderer must:

- use server-side rendering;
- embed approved fonts or use reliable system fonts;
- embed the QR code;
- include certificate ID and version;
- include issue and recognition dates;
- include the legal disclaimer;
- avoid loading remote third-party resources during generation;
- generate a stable layout across environments;
- save the final PDF hash.

Recommended file naming:

`Hirein_Verified_Recognition_[EmployeeName]_[CertificateID].pdf`

Sanitize the employee name before using it in the file name.

---

# 18. Audit Requirements

Audit the following events:

- recognition created;
- recognition edited;
- recognition published;
- certificate requested;
- review opened;
- returned for clarification;
- approved;
- rejected;
- certificate issued;
- certificate downloaded;
- public verification viewed;
- certificate corrected;
- certificate superseded;
- certificate revoked;
- PDF regenerated;
- badge configuration changed.

Audit records must include:

- actor;
- timestamp;
- action;
- previous status;
- new status;
- relevant metadata;
- privacy-safe IP reference when needed;
- user agent when needed.

Audit logs must not be editable from the UI.

---

# 19. Correction, Versioning, and Revocation

## 19.1 Correction

Do not overwrite an issued certificate.

When a correction is required:

1. Create a new certificate version.
2. Link the new version to the previous certificate.
3. Mark the previous version as `superseded` or `corrected`.
4. Preserve the previous PDF and hash.
5. Update the public verification page to point to the current valid version.
6. Record the reason internally.

## 19.2 Revocation

Only authorized HR/Admin or Super Admin users may revoke a certificate.

Required fields:

- internal revocation reason;
- revoking user;
- revocation timestamp.

Public page must show only:

`This certificate is no longer valid.`

## 19.3 PDF Regeneration

Regeneration must not silently change an issued document.

If certificate content changes, create a new version.

If only a technical file recovery is required and the rendered content is identical, regeneration may keep the same version only if the resulting hash is recorded and the action is audited.

---

# 20. Notifications

## Recipient Notification on Praise

Subject or in-app title:

`You received a [Badge Name] recognition`

Message:

`[Recognizer Name] recognized your contribution with the [Badge Name] badge.`

## Recipient Notification on Certificate Issuance

Title:

`Your verified recognition certificate is ready`

Message:

`Your Certificate of Verified Recognition for [Badge Name] has been issued. You can view, download, and verify it from My Growth.`

Actions:

- View Certificate
- Download PDF
- Open Verification Page

## Reviewer Notification

Title:

`Recognition awaiting verification`

Message:

`A [Badge Name] recognition for [Employee Name] is awaiting your review.`

---

# 21. UX Requirements

## 21.1 Praise Board

The current Praise page must continue to support:

- employee search;
- badge filters;
- My Pins;
- Give a Badge;
- empty state;
- praise feed.

Each issued recognition card should display:

- Verified label;
- badge;
- employee name;
- citation excerpt;
- recognition date;
- certificate action.

Possible action:

`View Verified Certificate`

## 21.2 My Pins

My Pins should show:

- badge name;
- number of times received;
- number of verified recognitions;
- most recent date;
- available certificates.

Do not imply that every badge count is a certificate count.

## 21.3 My Certificates

Add a section under My Growth or My Pins.

Recommended fields:

- Certificate title
- Badge
- Recognition date
- Issue date
- Certificate ID
- Status
- View
- Download
- Verify

## 21.4 Review Queue

Add manager/HR review tabs:

- Pending
- Returned
- Approved
- Issued
- Rejected
- Revoked

Filters:

- employee;
- manager;
- badge;
- department;
- date;
- status.

---

# 22. Recognition Writing Guidance

Display helper text in the form:

`A strong recognition explains the specific action, the impact, and the value demonstrated. Avoid general comments that do not describe a meaningful contribution.`

Example weak recognition:

`Great job!`

Example strong recognition:

`Priya proactively identified missing onboarding documentation, coordinated with the candidate and compliance team, and prevented a delay in the planned start date.`

An optional AI writing assistant may:

- improve grammar;
- shorten text;
- improve clarity;
- create a public citation from submitted text.

It must not:

- invent results;
- add unsupported impact;
- change the meaning;
- introduce confidential information.

The user must review and approve any AI-edited citation.

---

# 23. Privacy and Security Requirements

- Enforce authorization on every recognition and certificate endpoint.
- Prevent employees from accessing private praise for others.
- Never expose internal numeric IDs in public verification URLs.
- Use cryptographically secure random tokens.
- Hash public tokens when practical.
- Rate-limit public verification requests.
- Sanitize certificate text before rendering HTML.
- Prevent HTML/script injection in praise content.
- Use server-side access checks, not only hidden UI controls.
- Do not include private evidence in the public certificate.
- Audit certificate access and status changes.
- Store PDFs in approved secure storage.
- Do not allow a user to approve their own recognition.
- Prevent a recognizer from issuing a certificate when policy requires independent approval.

---

# 24. Validation Rules

- Recipient must exist and be active.
- Recognizer and recipient must be different users.
- Badge must be active.
- Action description is required.
- Impact description is required for certificate eligibility.
- Public citation must not be empty before issuance.
- Approver must have permission.
- Issuance must be idempotent.
- Duplicate clicks must not issue duplicate certificates.
- Certificate ID must be unique.
- Public token must be unique.
- Issued certificates cannot be directly edited.
- Revoked certificates cannot return to valid without a newly issued version.

---

# 25. Acceptance Criteria

## Praise Creation

- User can search and select an employee.
- User can select one badge.
- User can submit action and impact statements.
- Self-recognition is blocked.
- Praise appears according to visibility.
- Recipient receives a notification.

## Approval

- Authorized reviewer can see pending requests.
- Reviewer can edit the public citation.
- Reviewer can approve, reject, or return.
- User cannot approve their own recognition.
- Approval action is audited.

## Certificate Issuance

- Approved recognition generates one certificate.
- Duplicate requests do not generate duplicates.
- PDF contains correct recipient, badge, dates, citation, issuer, ID, and QR code.
- QR code opens the correct verification page.
- PDF hash is stored.
- Certificate appears in the employee’s My Certificates section.

## Public Verification

- Public token opens a mobile-friendly page.
- Valid status is clearly displayed.
- No private employee data is exposed.
- Revoked certificate shows invalid status.
- Superseded certificate points to current version.
- Verification access is rate-limited.

## Correction and Revocation

- Correction creates a new version.
- Previous version is retained.
- Revocation changes public status.
- Revocation reason remains internal.
- All actions are audited.

---

# 26. Test Scenarios

## Functional

1. Employee gives praise to a colleague without requesting a certificate.
2. Employee gives praise and requests certificate verification.
3. Manager approves without edits.
4. Manager edits citation and approves.
5. Manager returns recognition for clarification.
6. HR rejects certificate but leaves praise visible.
7. Certificate is issued successfully.
8. Employee downloads PDF.
9. QR code opens verification page.
10. HR corrects an issued certificate.
11. Previous certificate becomes superseded.
12. HR revokes a certificate.

## Authorization

1. Employee attempts to approve their own praise.
2. Employee attempts to access another employee’s private certificate.
3. Manager attempts to approve a recognition outside their scope.
4. Unauthorized user attempts certificate revocation.
5. Public user attempts to enumerate tokens.

## Security

1. Praise text contains script tags.
2. Citation contains malicious HTML.
3. Invalid public token is used repeatedly.
4. Duplicate issue requests are submitted simultaneously.
5. Public page is checked for leaked email or employee ID.
6. Revoked certificate PDF link is tested.

## PDF

1. Very long employee name.
2. Long citation.
3. Special characters.
4. Missing optional approver signature image.
5. QR scanning from printed page.
6. Mobile PDF rendering.

---

# 27. Recommended Implementation Sequence

## Phase 1: Foundation

- Add badge configuration table.
- Add praise records.
- Add certificate records.
- Add audit records.
- Add permissions.

## Phase 2: Praise Workflow

- Build Give a Badge form.
- Build Praise Board feed.
- Build My Pins.
- Add visibility rules.
- Add notifications.

## Phase 3: Approval Workflow

- Build manager/HR review queue.
- Add approve, reject, and return actions.
- Add citation editor and preview.

## Phase 4: Certificate and Verification

- Implement ID and token generation.
- Implement QR code.
- Create certificate HTML template.
- Generate PDF.
- Create public verification page.
- Add My Certificates.

## Phase 5: Governance

- Add correction and versioning.
- Add revocation.
- Add audit viewer.
- Add milestone rules.
- Add reporting.

---

# 28. Definition of Done

The feature is complete when:

- employees can give controlled praise;
- manager or HR can verify recognition;
- eligible praise generates a professional PDF;
- every certificate has a unique certificate ID;
- every certificate has a QR code;
- QR code opens a public verification page;
- public verification does not expose private employee information;
- certificate versioning and revocation work;
- all sensitive actions are audited;
- duplicate certificate issuance is prevented;
- certificates are available from My Growth;
- all acceptance criteria and security tests pass.

---

# 29. Final Product Language

Use this positioning throughout the product:

> **Every contribution can be appreciated. Meaningful contributions can be formally verified.**

For certificate credibility:

> **Authentic. Attributable. Specific. Verifiable.**

For employees:

> **Your verified recognition is part of your professional growth record.**

---

# 30. Replit Build Instruction

Implement this feature within the existing Hire’in Employee Portal. Reuse the current authentication, RBAC, user, employee, audit, notification, PDF generation, and document verification infrastructure wherever possible.

Do not create a separate authentication system or a separate public verification service unless the existing document verification module cannot support recognition certificates.

Before coding:

1. Inspect the existing Praise Board implementation.
2. Inspect the existing document verification flow used for relieving, performance, or other employee letters.
3. Reuse the existing verification URL pattern, token strategy, QR generation method, PDF rendering service, and audit conventions.
4. Map this specification to the current database and naming standards.
5. Generate database migrations rather than manually changing production tables.
6. Preserve existing Praise Board functionality.
7. Add automated tests for certificate issuance, verification, authorization, and revocation.

The implementation must be production-safe, auditable, privacy-conscious, and backward-compatible with existing praise records.
