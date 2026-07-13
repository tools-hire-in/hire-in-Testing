Status: Current-state practitioner reference
Generated from: client/src/App.tsx, Phase 1 SYSTEM_LANDSCAPE.md, PRODUCT_CAPABILITY_MAP.md, WORKFLOW_STATE_MACHINES.md
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 1

---

# Website User Flows

Flow diagrams for confirmed user journeys through the public site and the public-to-portal entry point. All flows are confirmed from `client/src/App.tsx` and route/API behavior documented in Phase 1. No speculative flows are included.

---

## Flow 1: Job Seeker Journey

A candidate discovers open positions, reads a job description, and submits an application. The application is stored and pushed to Ceipal ATS.

```mermaid
flowchart TD
    Start([Candidate visits site]) --> Home["/\nHome Page"]
    Home --> |Clicks 'View Open Jobs'| Jobs["/jobs\nJob Board"]
    Jobs --> |Applies filters\nkeyword / location / category| Jobs
    Jobs --> |Clicks job card| JobDetail["/jobs/:id\nJob Detail"]
    JobDetail --> |Clicks 'Apply Now'| ApplicationForm["Inline Application Form\n(name, email, phone, resume)"]
    ApplicationForm --> |Submits| API_Apply["POST /api/applications\nStored in applications table"]
    API_Apply --> |Async push| CeipalATS["Ceipal ATS\n(applicant pushed)"]
    API_Apply --> Success["Confirmation message shown\n'Application submitted successfully'"]
    API_Apply --> |Push fails| PartialSuccess["Application stored locally\nCeipal push retried by HR manually"]
```

**Confirmed steps:**
- `/jobs` calls `GET /api/jobs` — returns all active jobs. `CONFIRMED_IN_ROUTE`
- Application submit calls `POST /api/applications` — stores in `applications` table. `CONFIRMED_IN_ROUTE`
- Ceipal push via `pushApplicantToCeipal()` in `server/ceipalService.ts` — called asynchronously on submit. `CONFIRMED_IN_CODE`
- Failed Ceipal pushes are flagged in the admin Recruitment view for manual retry. `CONFIRMED_IN_CODE`

---

## Flow 2: Candidate or Client Contact / Inquiry Flow

A visitor — either a job seeker or a prospective client — submits an inquiry through the Contact form. The inquiry is stored and routed to the appropriate team.

```mermaid
flowchart TD
    Start([Visitor on any page]) --> |Clicks 'Contact Us'| Contact["/contact\nContact Page"]
    Contact --> InquiryType{"Select inquiry type"}
    InquiryType --> |Candidate| CandidateForm["Candidate form\n(name, email, phone, message)"]
    InquiryType --> |Employer / Client| ClientForm["Employer form\n(name, email, company, phone, message)"]
    CandidateForm --> |Submits| API_Contact["POST /api/contacts\nStored in contacts table"]
    ClientForm --> |Submits| API_Contact
    API_Contact --> Confirmation["Confirmation message shown"]
    API_Contact --> AdminView["Admin Contacts queue\n(/admin/contacts)"]
```

**Confirmed steps:**
- Contact form submits to `POST /api/contacts`. `CONFIRMED_IN_ROUTE`
- Submission stored in `contacts` table. `CONFIRMED_IN_SCHEMA`
- Admin views inquiries at `/admin/contacts` filtered by status and type. `CONFIRMED_IN_ROUTE`

---

## Flow 3: Public Letter Verification Flow

A member of the public — typically a new employer or government body — verifies the authenticity of an HR letter or contract using details printed on the document.

```mermaid
flowchart TD
    Start([Visitor has a Hire'in-issued letter]) --> Verify["/verify\nVerification Page"]
    Verify --> Form["Enter:\n- Reference Number\n- Auth Code"]
    Form --> |Submits| API_Verify["POST /api/verify-letter\n(rate-limited)"]
    API_Verify --> |Found & active| Result["Result panel shown:\n- Letter type\n- Issue date\n- Employee first name\n- Status: Issued"]
    API_Verify --> |Found & revoked| Revoked["Result: Revoked\nLetter is no longer valid"]
    API_Verify --> |Not found| NotFound["'Not found' message\n(no existence confirmation)"]
    API_Verify --> |Rate limit exceeded| RateLimit["429 Too Many Requests"]
```

**Confirmed steps:**
- `/verify` is a public, no-auth route. `CONFIRMED_IN_ROUTE`
- `POST /api/verify-letter` is rate-limited. `CONFIRMED_IN_CODE`
- Returns letter type, issue date, and employee first name — no full PII returned. `CONFIRMED_IN_CODE`
- Covers `hr_letter` and `contract` document types only — offer letters are not verifiable via this endpoint. `CONFIRMED_IN_CODE`
- Revoked letters return a revoked status — the endpoint does not return 404 for revoked. `CONFIRMED_IN_CODE`

---

## Flow 4: Website to Admin Portal Entry (Login and Registration)

A new admin user or returning staff member navigates from the public site to the admin portal. No self-registration is available — accounts are created by HR/admin.

```mermaid
flowchart TD
    PublicSite["Public Site\n(any page)"] --> |Navigates to admin| Login["/admin/login\nAdmin Login Page"]
    Login --> Credentials["Enter email and password"]
    Credentials --> |Valid, TOTP not enrolled| TOTP_Setup["Redirect to TOTP setup\n(mandatory in production)"]
    Credentials --> |Valid, TOTP enrolled| TOTP_Verify["Enter TOTP code\n(6-digit, 30-second window)"]
    Credentials --> |Invalid| Error["Error: 'Invalid credentials'"]
    TOTP_Verify --> |Valid code| Session["Session created\n(30-min rolling TTL)"]
    TOTP_Setup --> |Setup complete| Session
    Session --> RoleRouter{"User role?"}
    RoleRouter --> |executive| ExecCockpit["/admin/executive-cockpit"]
    RoleRouter --> |all other roles| MyDesk["/admin/my-desk\nCommand Center"]
    Login --> |Forgot password| Forgot["/admin/forgot-password"]
    Forgot --> |Email sent| Reset["/admin/reset-password\n(token expires 1 hour)"]
    Reset --> Login
```

**Confirmed steps:**
- Login submits to `POST /api/auth/login`. `CONFIRMED_IN_CODE`
- Email domain checked against `allowed_email_domains` setting (default `hire-in.com`). `CONFIRMED_IN_CODE`
- TOTP mandatory in `NODE_ENV === 'production'`. In development, TOTP is bypassed. `CONFIRMED_IN_CODE`
- TOTP algorithm: SHA1, 6-digit, 30-second period, 1-step window tolerance. `CONFIRMED_IN_CODE`
- `executive` role redirects to `/admin/executive-cockpit`; all others go to `/admin/my-desk`. `CONFIRMED_IN_CODE`
- Session TTL: 30 minutes, rolling. `CONFIRMED_IN_CODE`
- Password reset token: 32-byte random, 1-hour expiry. `CONFIRMED_IN_CODE`
- No self-registration flow exists — accounts are created by HR/admin via `POST /api/users`. `CONFIRMED_IN_CODE`

---

## Flow 5: Candidate Offer Acceptance Flow

After receiving an offer email, a candidate accepts or views the offer via a token-gated URL. This is part of the recruitment-to-hire pipeline.

```mermaid
flowchart TD
    Email["Offer email received by candidate\n(contains unique accept URL)"] --> OnboardPage["/onboard/:token\nOffer Acceptance Page"]
    OnboardPage --> |Token valid, not expired| OfferContent["Offer letter content displayed\n(role, compensation, terms)"]
    OnboardPage --> |Token expired| Expired["'Offer expired' message\n(HR can reactivate)"]
    OnboardPage --> |Token invalid| Invalid["'Link not valid' message"]
    OfferContent --> |Candidate signs| API_Accept["POST /api/offer-letters/token/:token/accept\nStatus: accepted\nPlan seeded with NULL employee_id"]
    API_Accept --> Countersign["HR countersigns in admin portal\n(/admin/new-hire Offer Letters tab)"]
    Countersign --> Onboard["HR onboards candidate\nWelcome email + credentials sent\nOptional Rayo Academy provisioning"]
```

**Confirmed steps:**
- `GET /api/offer-letters/token/:token` validates token, checks expiry. `CONFIRMED_IN_CODE`
- Acceptance records a probation or growth plan with NULL `employee_id`. `CONFIRMED_IN_CODE`
- Counter-signature stores a cryptographic document hash. `CONFIRMED_IN_CODE`
- Onboarding sends a welcome email with credentials via SendGrid. `CONFIRMED_IN_CODE`
- Offer letter viewing is tracked — `viewedAt` timestamp is set when candidate first opens the link. `CONFIRMED_IN_CODE`
