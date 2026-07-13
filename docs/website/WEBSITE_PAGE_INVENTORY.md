Status: Current-state practitioner reference
Generated from: client/src/App.tsx and Phase 1 SYSTEM_LANDSCAPE.md, PRODUCT_CAPABILITY_MAP.md
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 3

---

# Website Page Inventory

For every public-facing page: name, URL, navigation location, purpose, main content areas, primary call to action, forms captured, related service vertical, and status.

`CONFIRMED_IN_ROUTE` — all routes confirmed in `client/src/App.tsx` PublicRouter. Navigation location confirmed where a matching nav component reference exists.

---

## Core Navigation Pages

### Home

| Field | Value |
|---|---|
| URL | `/` |
| Navigation location | Site root / logo |
| Page purpose | Primary marketing landing page. Introduces Hire'in Solutions and directs visitors to Jobs, Contact, Services, and Insights. |
| Main content areas | Hero section with headline and CTA buttons; Services overview strip; Featured jobs; Stats/trust indicators; Insights preview; Footer |
| Primary call to action | "View Open Jobs" → `/jobs`; "Contact Us" → `/contact` |
| Forms present | Newsletter subscribe (email field → `POST /api/studio/subscribers`) |
| Related service vertical | General |
| Status | Active |

---

### About

| Field | Value |
|---|---|
| URL | `/about` |
| Navigation location | Main nav |
| Page purpose | Company overview — mission, values, team, and history. |
| Main content areas | Company story, mission statement, team section, service verticals overview |
| Primary call to action | "Work With Us" → `/contact` or `/jobs` |
| Forms present | None |
| Related service vertical | General |
| Status | Active |

---

### Jobs (Public Job Board)

| Field | Value |
|---|---|
| URL | `/jobs` |
| Navigation location | Main nav |
| Page purpose | Candidate-facing job listings. Enables filtering and browsing of all active positions. |
| Main content areas | Search/filter bar (by keyword, category, location); Job listing cards (title, location, type, date); Pagination |
| Primary call to action | Individual job card → `/jobs/:id` (Apply) |
| Forms present | Search/filter form (no data submitted to backend; filters client-side or via query params) |
| Related service vertical | All verticals |
| Status | Active |

---

### Job Detail

| Field | Value |
|---|---|
| URL | `/jobs/:id` |
| Navigation location | Linked from `/jobs` |
| Page purpose | Full job description with inline application form. |
| Main content areas | Job title, company, location, employment type; Full description and requirements; Application form |
| Primary call to action | "Apply Now" (opens inline form) |
| Forms present | Application form — fields: first name, last name, email, phone, LinkedIn URL (optional), cover letter (optional), resume file upload; submitted to `POST /api/applications` and pushed to Ceipal ATS |
| Related service vertical | Depends on job category |
| Status | Active |

---

### Contact

| Field | Value |
|---|---|
| URL | `/contact` |
| Navigation location | Main nav |
| Page purpose | Captures leads from candidates seeking jobs and clients seeking staffing services. |
| Main content areas | Inquiry type selector (Candidate / Employer); Contact details for each type; Inquiry form |
| Primary call to action | "Send Message" (form submit) |
| Forms present | Inquiry form — fields: name, email, phone, company (optional), message, inquiry type; submitted to `POST /api/contacts`; stored in `contacts` table |
| Related service vertical | General |
| Status | Active |

---

### Insights Blog

| Field | Value |
|---|---|
| URL | `/insights` |
| Navigation location | Main nav |
| Page purpose | Brand awareness through published articles. Source is Content Studio pipeline; only `published` articles appear. |
| Main content areas | Article grid (title, author, date, category, excerpt); Category filter; Newsletter subscribe bar |
| Primary call to action | Click article card → `/insights/:slug` |
| Forms present | Newsletter subscribe form — email field → `POST /api/studio/subscribers` |
| Related service vertical | General |
| Status | Active |

---

### Insight Article

| Field | Value |
|---|---|
| URL | `/insights/:slug` |
| Navigation location | Linked from `/insights` |
| Page purpose | Full article read view with author attribution. |
| Main content areas | Article headline, author, date, category; Full article body; Author bio and link to author profile; Related articles |
| Primary call to action | Author profile → `/insights/authors/:slug`; Newsletter subscribe |
| Forms present | Newsletter subscribe (email → `POST /api/studio/subscribers`) |
| Related service vertical | Depends on article category |
| Status | Active |

---

### Insight Authors

| Field | Value |
|---|---|
| URL | `/insights/authors` |
| Navigation location | Linked from article pages |
| Page purpose | Directory of content authors. |
| Main content areas | Author cards (name, title, photo, article count) |
| Primary call to action | Click author → `/insights/authors/:slug` |
| Forms present | None |
| Status | Active |

---

### Insight Author Profile

| Field | Value |
|---|---|
| URL | `/insights/authors/:slug` |
| Navigation location | Linked from author directory and articles |
| Page purpose | Individual author bio and article list. |
| Main content areas | Author photo, bio, title, article list |
| Primary call to action | Click article → `/insights/:slug` |
| Status | Active |

---

## Service Vertical Pages

### Healthcare Recruitment

| Field | Value |
|---|---|
| URL | `/services/healthcare-recruitment` |
| Navigation location | Main nav > Services |
| Page purpose | Marketing page for the Healthcare staffing vertical. |
| Main content areas | Vertical overview, capabilities, featured roles, CTA |
| Primary call to action | "Find Healthcare Talent" → `/contact`; "Browse Jobs" → `/jobs` |
| Forms present | None |
| Related service vertical | Healthcare |
| Status | Active |

---

### IT / Software Staffing

| Field | Value |
|---|---|
| URL | `/services/it-software` |
| Navigation location | Main nav > Services |
| Page purpose | Marketing page for the IT/Software staffing vertical. |
| Main content areas | Vertical overview, technology capabilities, CTA |
| Primary call to action | → `/contact`; → `/jobs` |
| Related service vertical | IT / Software |
| Status | Active |

---

### Engineering & Technical

| Field | Value |
|---|---|
| URL | `/services/engineering-technical` |
| Navigation location | Main nav > Services |
| Page purpose | Marketing page for the Engineering and Technical staffing vertical. |
| Related service vertical | Engineering |
| Status | Active |

---

### Non-IT Professional Services

| Field | Value |
|---|---|
| URL | `/services/non-it-professional` |
| Navigation location | Main nav > Services |
| Page purpose | Marketing page for Non-IT Professional Services staffing. |
| Related service vertical | Professional Services |
| Status | Active |

---

### Contract Staffing

| Field | Value |
|---|---|
| URL | `/services/contract-staffing` |
| Navigation location | Main nav > Services |
| Page purpose | Marketing page for contract and temporary staffing arrangements. |
| Related service vertical | General / All |
| Status | Active |

---

## Token-Gated Pages (Email-Delivered Links)

### Offer Acceptance

| Field | Value |
|---|---|
| URL | `/onboard/:token` |
| Navigation location | Email link only (sent by platform on offer dispatch) |
| Page purpose | Candidate accepts their employment offer. |
| Main content areas | Offer letter details (role, compensation, start date, terms); Acceptance signature block |
| Primary call to action | "Accept Offer" (sign and submit) |
| Forms present | Signature block — candidate name confirmation, acceptance checkbox; submitted to `POST /api/offer-letters/token/:token/accept` |
| Related service vertical | General |
| Status | Active |

---

### Addendum Acceptance

| Field | Value |
|---|---|
| URL | `/addendum/:token` |
| Navigation location | Email link only |
| Page purpose | Employee countersigns a post-hire addendum (growth plan, device allocation, salary revision). |
| Forms present | Countersign block — submitted to `POST /api/offer-letter-addendums/token/:token/accept` |
| Status | Active |

---

### Contract Signing (Client)

| Field | Value |
|---|---|
| URL | `/contracts/sign/:token` |
| Navigation location | Email link only |
| Page purpose | Client contact signs a dispatched contract. |
| Forms present | Signature capture — submitted to `POST /api/contracts/sign/:token/sign` |
| Status | Active |

---

### Contracts & Clients

| Field | Value |
|---|---|
| URL | `/contracts` |
| Navigation location | `CURRENT_BUT_INCOMPLETE` — no confirmed main nav or footer entry; canonical set to `https://hire-in.com/contracts` |
| Page purpose | Marketing page for client-facing contracts information. Groups standard contract types offered by Hire'in Solutions. |
| Main content areas | Eyebrow + heading ("Contracts"); Contract group list from `CONTRACT_GROUPS` library; CTA button |
| Primary call to action | Contact or next-step CTA |
| Forms present | None confirmed |
| Related service vertical | General / Client-facing |
| Status | Active (`CONFIRMED_IN_ROUTE` — `<Route path="/contracts" component={Contracts} />` in App.tsx) |

---

## Utility Pages (No Main Nav)

### Letter Verification

| Field | Value |
|---|---|
| URL | `/verify` |
| Navigation location | Direct link / QR code (may appear on physical letters) |
| Page purpose | Public document authenticity check. Anyone can verify an HR letter or contract using the reference number and auth code printed on the document. |
| Main content areas | Verification form; Result panel (letter type, issue date, name, revocation status) |
| Primary call to action | "Verify" (form submit) |
| Forms present | Reference number field + auth code field → `POST /api/verify-letter` |
| Related service vertical | General |
| Status | Active |

---

### Capability Deck

| Field | Value |
|---|---|
| URL | `/capability-deck` |
| Navigation location | `CURRENT_BUT_INCOMPLETE` — no confirmed main nav entry |
| Page purpose | Static company capability presentation for business development. |
| Main content areas | Slide-format company overview, service capabilities, case examples |
| Primary call to action | "Contact Us" |
| Forms present | None |
| Status | Active |

---

### IT Staffing Landing

| Field | Value |
|---|---|
| URL | `/it-staffing` |
| Navigation location | `CURRENT_BUT_INCOMPLETE` — no confirmed main nav entry |
| Page purpose | Dedicated landing page for IT staffing with interactive slide viewer, stats strip, and download options. |
| Main content areas | Hero, stats, interactive slide viewer, download CTA |
| Primary call to action | Download or contact |
| Related service vertical | IT / Software |
| Status | Active |

---

### eHealthcare Staffing

| Field | Value |
|---|---|
| URL | `/ehealthcare-staffing` |
| Navigation location | `CURRENT_BUT_INCOMPLETE` |
| Page purpose | eHealthcare staffing dedicated landing page. |
| Related service vertical | Healthcare |
| Status | Active |

---

### Why Hire'in Solutions

| Field | Value |
|---|---|
| URL | `/why-hire-in-solutions` |
| Navigation location | `CURRENT_BUT_INCOMPLETE` |
| Page purpose | Value proposition page for prospective clients. |
| Related service vertical | General |
| Status | Active |

---

### IT Staffing Guide

| Field | Value |
|---|---|
| URL | `/it-staffing-guide` |
| Navigation location | `CURRENT_BUT_INCOMPLETE` |
| Page purpose | Long-form guide content for IT staffing buyers. |
| Related service vertical | IT / Software |
| Status | Active |

---

### Healthcare Staffing Guide

| Field | Value |
|---|---|
| URL | `/healthcare-staffing-guide` |
| Navigation location | `CURRENT_BUT_INCOMPLETE` |
| Page purpose | Long-form guide content for healthcare staffing buyers. |
| Related service vertical | Healthcare |
| Status | Active |

---

### Staffing FAQ

| Field | Value |
|---|---|
| URL | `/staffing-faq` |
| Navigation location | `CURRENT_BUT_INCOMPLETE` |
| Page purpose | Frequently asked questions about staffing services. |
| Related service vertical | General |
| Status | Active |

---

### Request a Quote

| Field | Value |
|---|---|
| URL | `/request-a-quote` |
| Navigation location | `CURRENT_BUT_INCOMPLETE` |
| Page purpose | Dedicated quote request form for prospective clients. |
| Forms present | `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED` — form fields and submission endpoint cannot be confirmed without reading the component source. |
| Status | Active |

---

## Legal Pages

### Terms of Service

| Field | Value |
|---|---|
| URL | `/terms` |
| Navigation location | Footer |
| Page purpose | Platform terms of service. |
| Forms present | None |
| Status | Active |

---

### Privacy Policy

| Field | Value |
|---|---|
| URL | `/privacy` |
| Navigation location | Footer |
| Page purpose | Privacy policy. |
| Forms present | None |
| Status | Active |
