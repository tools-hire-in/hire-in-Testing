# Staffing Firm Operating System — McKinsey-Style Market Research & India Launch Strategy

**Document Classification:** Strategic / Confidential
**Prepared for:** Escape Technology Pvt. Ltd. / Rayomind Group Leadership
**Date:** July 2026
**Status:** Final — for executive review and distribution

---

## Executive Summary

The Indian staffing industry is a ₹1.2 trillion market growing at 15–18% CAGR. It is served by an estimated 20,000+ registered staffing firms — the overwhelming majority of which operate without enterprise-grade HR infrastructure. Every incumbent software vendor in this space — Keka, DarwinBox, GreytHR, Zoho People — targets the generic enterprise employer. None of them has built a system designed for the operational reality of a staffing firm: a business that simultaneously manages its own internal workforce and produces employment documentation, compliance evidence, and candidate pipelines for external clients.

This document defines the commercial strategy for a platform built inside Hire'in Solutions — the operating system Rayomind Group built to run its own staffing business — and repackaged as a multi-tenant SaaS product for the Indian staffing industry.

**The core thesis:** A staffing firm with 30–200 employees spends ₹40,000–₹1,20,000 per month on a patchwork of tools — ATS, HRMS, payroll processor, document generator, leave tracker — none of which talk to each other and none of which were designed for a staffing context. This platform replaces that stack with a single system built specifically for staffing operators.

**The opportunity in numbers:**

| Metric | Figure |
|---|---|
| India staffing industry size | ₹1.2 trillion (2025) |
| CAGR (2025–2030) | 15–18% |
| BPO industry size | $38 billion |
| Registered staffing firms (India) | 20,000+ |
| Realistic addressable segment (30–200 employees) | 4,000–5,000 firms |
| Platform ACV range | ₹3.0L–₹14.4L per firm/year |
| Conservative segment TAM | ₹830 Cr |
| Optimistic segment TAM | ₹3,260 Cr |

**The recommendation in one sentence:** Launch with Escape Technology Pvt. Ltd. as the IP-owning entity, instrument Hire'in as Tenant Zero for 90 days, sell 10 design partners at ₹25,000–₹40,000/month in Bangalore and Hyderabad by Q4 2026, and use that proof to raise a Series A at a ₹40–60 Cr valuation in 2027.

---

## Section 1: Platform Definition — What This Product Actually Is

### 1.1 The Win/Run/Prove Framework

Most HR software helps companies do one thing: run HR. This platform does three things simultaneously, and the combination is the defensible position.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STAFFING FIRM OPERATING SYSTEM                   │
├─────────────────┬──────────────────────┬───────────────────────────┤
│      WIN        │        RUN           │         PROVE             │
│  (Grow Revenue) │  (Execute Operations)│  (Create Evidence)        │
├─────────────────┼──────────────────────┼───────────────────────────┤
│ Content Studio  │ Workforce Governance │ Governance Control Tower  │
│ Insights Blog   │ HR Execution         │ Audit Trail               │
│ BD Agent        │ Payroll & Compliance │ Document Verification     │
│ Social Cards    │ Leave & Attendance   │ SOP Compliance            │
│ Campaign Mgmt   │ Training & SOPs      │ Letter Authenticity Chain │
└─────────────────┴──────────────────────┴───────────────────────────┘
```

**WIN — Grow Revenue**

The platform includes a full Content Studio: AI-assisted article pipeline (draft → review → approve → schedule → publish), a BD Agent that generates client proposals and capability decks on demand, a campaign management layer, and automatic social card generation for every published article. The Insights blog publishes directly to the firm's public-facing website. A staffing firm using this module is running a B2B content engine without a dedicated marketing team.

*Why it matters for staffing:* Staffing firms win on relationships and reputation. The firms that publish thought leadership, respond to clients with polished proposals, and maintain a searchable knowledge base of job market insights build trust faster than those who do not. No incumbent HR vendor provides this.

**RUN — Execute Operations**

The core HR execution layer covers the full employee lifecycle for the staffing firm's own workforce:
- Attendance (time card, break tracking, manager team view, nightly absent sweep)
- Leave management (EL/SL accrual engine, manager approval, LWP gating, year-end carry-forward)
- Payroll (India statutory: PF, ESI, PT, TDS; paise-precision engine; LOP deductions; payslip PDF)
- Performance management (OKRs, probation 8-milestone cadence, growth plans, coaching log)
- Onboarding (offer letter → addendum → training track → policy signing → document collection)
- SOP library with phased compliance rollout (6-wave model, soft → measured → full enforcement)
- Recruitment pipeline (Ceipal ATS sync, public job board, CSV import, application tracking)

*Why it matters for staffing:* A staffing firm's internal workforce is often its most neglected asset. Recruiters churn. Probation processes are informal. Payroll is outsourced to a CA who emails a spreadsheet. This module replaces all of that with a governed, auditable system.

**PROVE — Create Evidence**

The differentiated capability that no competitor offers: a real-time compliance evidence layer.
- Public document verification portal (`/verify`): any HR letter can be authenticated by reference number and cryptographic hash — relevant for candidate background checks and client audits
- Governance Control Tower: tracks manager obligations (probation check-ins, growth plan updates, SOP acknowledgements) and escalates to CEO level when obligations are overdue
- Amendment letter chain: salary revision, designation change, device allocation — all generated as DOCX, countersigned, and stored with audit trail
- Policy signing with acknowledgement timestamps — defensible in a labour dispute
- Training compliance lock: system-level gate that blocks access for employees with overdue training

*Why it matters for staffing:* Staffing firms face client audits, EPFO inspections, and labour law compliance requirements. Most cannot produce evidence on demand. This module is the compliance war chest.

### 1.2 The Staffing-Specific Layer

Beyond the three-pillar framework, the platform carries capabilities that are specifically relevant to staffing firm operations and have no equivalent in generic HR software:

- **Offer letter lifecycle designed for staffing:** Manager generates → HR/admin approves → candidate e-signs on a tokenized link (no account required) → HR countersigns → onboarding triggers automatically. The entire chain is cryptographically hashed.
- **Ceipal ATS native integration:** Job sync, applicant push, JWT-authenticated token refresh. Ceipal is the dominant ATS in the India staffing segment. This integration is already live.
- **Healthcare travel calculator:** Blended pay rate and margin tool for healthcare recruiters. Pre-built for US healthcare staffing use case.
- **Multi-vertical job board:** Public job listings across Healthcare, IT, Engineering, and Professional Services — live and synced.
- **Client contract lifecycle:** MSA/SOW creation, client e-sign via tokenized link, revenue tracking.

---

## Section 2: India Market Sizing

### 2.1 India Staffing Industry — Macro Context

India's staffing industry is structurally large and growing fast. Key reference points:

| Indicator | Data | Source/Basis |
|---|---|---|
| India staffing industry market size (2025) | ₹1.2 trillion (~$14.4B) | Indian Staffing Federation (ISF) estimates; CAGR from ~₹70,000 Cr in 2020 |
| CAGR (2025–2030) | 15–18% | ISF; NASSCOM HR Summit 2024 data |
| Formal workforce covered by organised staffing | ~13 million workers | ISF Annual Report 2024 |
| IT/ITES workforce (directly relevant) | 5.4 million | NASSCOM |
| BPO/ITeS industry size | $38 billion | NASSCOM 2025 |
| BPO firm count (1,000+ employees) | 1,200+ | NASSCOM directory |
| ISF registered staffing firms (all sizes) | 20,000+ | ISF 2024 |
| NIPM chapters (India-wide) | 34 active chapters | NIPM directory |

The industry is highly fragmented. The top 10 staffing firms (TeamLease, Quess, ManpowerGroup India, Randstad, etc.) control approximately 30% of revenue by placement volume. The remaining 70% is split among thousands of small and mid-sized firms — the exact target segment for this platform.

### 2.2 Addressable Market — Bottom-Up Segmentation

The platform's realistic buyer is a staffing firm with 30–200 full-time employees (recruiters, account managers, HR, operations) that places candidates across one or more verticals. Below that threshold, the firm is too small to need a governed HRMS. Above it, they are more likely to already have an enterprise contract.

**Segmentation by vertical:**

| Segment | Est. Firm Count (India) | Target Subset (30–200 employees) | Target Subset Count | Monthly ACV (₹) | Annual ACV (₹) | Segment TAM (₹ Cr) |
|---|---|---|---|---|---|---|
| IT Staffing | 8,000+ | 15% | 1,200 | 25,000–1,20,000 | 3.0L–14.4L | 360–1,728 |
| Healthcare Staffing | 3,000+ | 12% | 360 | 25,000–80,000 | 3.0L–9.6L | 108–346 |
| BPO / Operations | 1,200+ | 20% | 240 | 30,000–1,20,000 | 3.6L–14.4L | 86–346 |
| General / Professional Services | 8,000+ | 10% | 800 | 25,000–60,000 | 3.0L–7.2L | 240–576 |
| **Total** | **20,200+** | — | **~2,600 (conservative)** | — | — | **₹830–3,260 Cr** |

**Notes on methodology:**
- Firm counts are based on ISF registration data, NASSCOM BPO census, and market participant interviews. The 20,000+ total figure is widely cited by ISF; vertical breakdown is estimated based on NASSCOM sector data and NIPM chapter composition.
- The 30–200 employee threshold is the platform's ICP gate. Applying an 8–20% conversion rate of total registered firms produces the target subset count.
- Monthly ACV of ₹25,000–₹1,20,000 reflects the pricing range from starter tier (core HR + payroll, 30-50 employees) to full-platform enterprise tier (all modules, 150-200 employees). This is consistent with Keka's SMB pricing (₹8,000–₹25,000/month for comparable headcount bands) with a 3–5× premium justified by the staffing-specific feature set.
- TAM is calculated as: (firm count) × (midpoint annual ACV).

**The serviceable addressable market (SAM) for Phase 1 (Bangalore/Hyderabad, IT staffing):**

Bangalore and Hyderabad together account for approximately 60% of India's IT staffing volume. Applying that to the IT staffing segment:

- IT staffing firms in Bangalore + Hyderabad (30–200 employees): ~720 firms
- Realistic 18-month conversion rate (Phase 1 beachhead): 1–2% = **7–14 signed customers**
- Phase 1 ARR target: ₹70L–₹2.0 Cr

This is the Phase 1 commercial goal. It is achievable with a two-person founder-led sales motion.

### 2.3 Why the Market Is Underserved Now

Three structural reasons the segment is underserved despite the size:

1. **Product-market mismatch from incumbents.** Keka, DarwinBox, GreytHR were built for manufacturing, retail, and tech product companies. Their HRMS assumes a stable internal workforce — not a firm where the workforce IS the product being placed externally. Features like offer letter lifecycle for placed candidates, Ceipal integration, and client contract management don't exist in these products.

2. **Price anchoring.** Mid-market staffing firms have historically been offered either: (a) Rs 100–500/employee/month tools that cover only one function (payroll or leave), or (b) enterprise suite contracts starting at ₹15L/year. There is no well-positioned product at ₹3L–₹14L/year that covers the full operating surface.

3. **Missing compliance urgency.** As PF digitisation, EPFO inspections, and labour code consolidation accelerate under India's Four Labour Codes (implementation now being enforced state by state), staffing firms face audit exposure they didn't have 5 years ago. The market's awareness of this risk is growing faster than available solutions.

---

## Section 3: Competitive Landscape

### 3.1 Incumbent Analysis

| Vendor | Core Offering | Price Point (SMB) | What They Do Well | Critical Gap |
|---|---|---|---|---|
| **Keka** | HRMS + Payroll + Performance | ₹8,000–₹25,000/month (50–200 employees) | Clean UX, strong payroll, good attendance tracking | No staffing-specific features. No offer letter candidate signing. No ATS integration for staffing context. No BD or content tools. No compliance evidence layer. |
| **DarwinBox** | HRMS + ATS + Performance | ₹15,000–₹60,000/month | Enterprise-grade, strong for 200+ headcount, good mobile app | Expensive, complex to implement, does not serve the 30–100 employee staffing firm. No multi-party document signing chain. No Ceipal integration. |
| **GreytHR** | Payroll + Leave + Compliance | ₹5,000–₹18,000/month | Affordable, strong India statutory payroll, widely used in SMB | No performance module. No content engine. No candidate-facing document flow. Built for stable internal workforce only. |
| **Zoho People** | HRMS + Leave + Attendance | ₹6,000–₹20,000/month (bundled Zoho) | Part of Zoho ecosystem; good for firms already on Zoho CRM | Generic product. No staffing-vertical depth. Training and SOP compliance are rudimentary. No document verification chain. |
| **HROne** | HRMS + Payroll + Expense | ₹7,000–₹22,000/month | Growing Indian vendor, good UI, strong statutory compliance | No staffing workflow. No content studio. No candidate lifecycle management. Weak performance management. No audit-grade compliance evidence. |

### 3.2 Competitive Gap Analysis

Every incumbent covers some part of the RUN layer. None of them covers WIN or PROVE. The competitive diagram:

```
                    PROVE
                      │
           Platform   │
              ★        │
              │        │
    WIN ──────┼────────────────── WIN
              │
              │   Keka / DarwinBox
              │        ▲
              │   GreytHR / Zoho
              │        ▲
              │   HROne
              │
                    RUN
```

All five incumbents cluster in the bottom-right quadrant: good at RUN, no capability in WIN or PROVE. The platform occupies a position none of them can reach without rebuilding their product from scratch.

**The most defensible differentiators:**

1. **Cryptographic document chain.** No incumbent offers a public document verification portal with hash-based authenticity checking. This feature alone is a procurement conversation-closer for firms that face client background check requirements.

2. **Ceipal-native integration.** Ceipal is the market-leading ATS in India staffing. None of the incumbents offer native Ceipal sync + applicant push. This removes a pain point that every IT staffing firm deals with weekly.

3. **Content Studio + BD Agent.** The ability to generate client-ready proposals, publish Insights articles, and create social cards from within the same system that runs HR is not available anywhere else. For the founder-led staffing firm trying to win enterprise clients, this is a business development platform as much as an HR platform.

4. **Governance Control Tower.** Manager obligation tracking with CEO-level escalation and evidence packaging for audits has no equivalent in the SMB HR software market.

**The category statement that frames all sales conversations:**

*The Governance + Execution layer does not exist at the SMB tier in India. This platform is not competing with Keka — it is selling a category that does not yet exist.*

---

## Section 4: India Launch Playbook

### 4.1 Phase Overview

```
Phase 0 (Jul–Sep 2026)    Entity setup + Tenant Zero instrumentation
Phase 1 (Oct–Dec 2026)    Beachhead: IT staffing, Bangalore + Hyderabad
Phase 2 (Jan–Mar 2027)    Design partner conversion (10 signed)
Phase 3 (Apr–Jun 2027)    Prove narrative + case study publication
Phase 4 (Jul–Dec 2027)    Series A GTM setup; expand to healthcare + BPO
```

### 4.2 Phase 0: Entity and Proof Setup (July–September 2026)

**Actions:**

1. Register Escape Technology Pvt. Ltd. as the IP-holding entity (if not already incorporated). Confirm that the commercial agreement between Escape Technology and Rayomind Group formalises Hire'in as a paying tenant.

2. Stand up a separate product brand — the product name visible to external customers cannot be "Escape Technology" (that is the legal entity) and should not be "Hire'in" (that is the tenant, not the vendor). Commission a brand naming exercise. Working name: **OperateHR** or **StaffOS** (placeholder — final name TBD). The product website domain should be registered immediately under the product brand, not hire-in.com.

3. Instrument Hire'in for Tenant Zero metrics capture (see Section 5).

4. Build the commercial motion assets:
   - One-page product brief (PDF, designed)
   - Demo environment (separate from Hire'in production — data-isolated, always-on, with realistic seed data)
   - Design partner agreement template (₹0 setup, ₹25,000–₹40,000/month, 90-day term, exit for free at day 90 with data export)

5. Enroll in NASSCOM Emerge50 / startup registry to establish legitimacy for cold outreach.

### 4.3 Phase 1: IT Staffing Beachhead (October–December 2026)

**Target customer profile:**
- IT staffing firm
- 30–200 employees (recruiters, account managers, HR, operations)
- Headquartered or with a significant office in Bangalore, Hyderabad, Pune, or NCR
- Currently using Ceipal as ATS (this is the strongest entry point — the native integration immediately removes a live pain)
- Founder-led or second-generation ownership (decision maker is accessible and can sign without a 6-month procurement process)

**The single qualifying question for every discovery call:**

> "What percentage of your managers completed their 30/60/90-day check-in obligations with employees last quarter?"

If the answer is "I don't track that" or "I'm not sure" — the prospect has the problem this platform solves. If the answer is a specific number with evidence, they are either (a) ahead of the market and still worth pursuing, or (b) already running a formal system and are less likely to switch.

**Customer acquisition channels:**

*Channel 1: LinkedIn Sales Navigator — founder-led outreach*

Search parameters:
- Title: Founder OR CEO OR MD OR Director — Staffing | Recruitment | Talent Acquisition
- Company size: 11–200 employees
- Industry: Staffing and Recruiting
- Geography: Bengaluru, Hyderabad, Pune, Delhi NCR
- Company keyword: "IT staffing" OR "technology staffing" OR "tech recruitment"

Connection note cadence (3-message sequence):
- Day 1: Connection request with personalised note referencing their firm's vertical (no pitch)
- Day 4: Value message — reference a specific operational pain visible from their LinkedIn (e.g., they posted about hiring challenges, team attendance, etc.)
- Day 10: Discovery ask — "Would you be open to a 20-minute call? I'm not selling — I want to understand how firms at your stage manage internal compliance while running a fast-moving placement operation."

First meeting is discovery only. No deck. No pricing. The only goal is to understand their current stack and the top three operational headaches.

*Channel 2: NASSCOM Directory + HR Summit*

NASSCOM maintains a searchable directory of its 3,000+ member companies. Filter by company size (11–200) and vertical. Export the list and cross-reference with LinkedIn for founder names.

NASSCOM HR Summit (annual; typically September/October) and PeopleMatters TechHR India (typically February) are the two highest-density events for HR and recruitment leaders. Booth presence is secondary to pre-event outreach: identify 20–30 target attendees in advance and request a coffee meeting before the event starts.

*Channel 3: Ceipal co-marketing*

Ceipal's sales team actively sells into the same customer base. A co-marketing arrangement (webinar, joint case study, referral agreement) gives access to their installed base. The pitch to Ceipal: "Your customers are losing placement efficiency because their internal HR chaos is consuming recruiter time. We solve the internal chaos — and we're the only HRMS with native Ceipal integration."

Initial ask: a joint webinar positioned as "Running a high-performance staffing firm: operational best practices." Ceipal provides the audience; the platform provides the operational framework content.

*Channel 4: NIPM Chapters*

The National Institute of Personnel Management (NIPM) has 34 active chapters across India. Each chapter holds monthly or quarterly meetings of HR professionals. A 20-minute speaking slot at a NIPM Bangalore, NIPM Hyderabad, or NIPM Pune chapter meeting puts the product in front of 30–100 HR decision-makers per event at essentially zero cost.

Speaking topic: "Compliance-first HR operations for staffing firms: what 2026 labour code enforcement means for your business."

*Channel 5: Ceipal user communities*

LinkedIn groups and WhatsApp communities of Ceipal users exist organically. Participation in these communities with useful content (not product pitches) builds credibility. The Ceipal integration is a natural conversation hook.

**Outreach volume targets for Phase 1:**

| Week | LinkedIn Connections | Follow-up Conversations | Discovery Calls |
|---|---|---|---|
| 1–2 | 40 | — | — |
| 3–4 | 40 | 15 | 3–5 |
| 5–8 | 80 | 30 | 8–12 |
| 9–12 | 80 | 40 | 12–18 |
| **Total** | **240** | **85** | **23–35** |

Target conversion from discovery call to design partner: 30–40%. Goal: 10 signed design partners by end of Phase 2.

### 4.4 Phase 2: Design Partner Conversion (January–March 2027)

**Design partner commercial terms:**

| Term | Detail |
|---|---|
| Setup fee | ₹0 |
| Monthly fee | ₹25,000–₹40,000/month (tiered by employee count) |
| Contract duration | 90 days minimum |
| Exit clause | Either party can exit at day 90 with full data export at no charge |
| Customer obligation | 2 hours/month of product feedback session; permission to publish anonymised metrics as a case study |
| Platform obligation | Dedicated onboarding support; direct line to product team for bug reports; commitment to incorporate top 3 feedback items per partner |

**Pricing rationale:**

₹25,000–₹40,000/month is 30–50% below the projected general availability price. It is positioned as a "founding customer" discount, not a "struggling to sell" discount. The framing matters: design partners are co-builders, not trial customers.

The monthly fee ensures the platform has real revenue while the design partner cohort is active, and it filters out firms that are not serious (a firm willing to pay ₹25,000/month in a 90-day pilot is a firm with a real problem and a real budget).

**Onboarding sequence for each design partner:**

- Week 1: Data migration (employee records, salary structures, department hierarchy)
- Week 2: Configuration (shifts, leave types, holidays, compliance settings)
- Week 3: Parallel run (existing tools stay live; platform runs alongside)
- Week 4: Cutover (existing tools switched off; platform is the system of record)
- Month 2: First payroll cycle on platform
- Month 3: First governance review; case study data collection begins

### 4.5 Phase 3: Prove Narrative (April–June 2027)

By the end of Phase 2, the platform has:
- 10 paying design partners
- 90 days of operational data from each
- Specific metrics on time-to-hire, compliance incident rates, manager obligation completion, and payroll accuracy

Phase 3 is about converting that data into the primary sales asset: the reference case study package.

The case study package for each design partner includes:
1. Before/after: tools used vs. platform; team size and headcount managed
2. Time saved per week (hours): recruiter time, HR time, manager time
3. Compliance metric: % of manager obligations completed (probation check-ins, SOP acknowledgements)
4. Cost comparison: previous tool stack total cost vs. platform cost
5. One named quote from the founding team (or one unnamed quote with firm size and vertical if confidentiality is requested)

The case study package is used in three ways:
- Published on the product website (public, text and data)
- Delivered as a PDF to every prospect in the discovery phase ("let me show you what firms similar to yours achieved in their first 90 days")
- Referenced in the Series A investor deck (primary evidence of product-market fit)

### 4.6 Phase 4: Series A GTM Setup (July–December 2027)

By Phase 4, the platform has:
- 10+ paying customers generating ₹30L–₹48L ARR
- Published case studies
- Reference-ready design partners willing to take calls from prospects

The Series A round is sized at ₹15–25 Cr, targeted at domestic Indian VCs (Elevation Capital, Accel India, Matrix Partners India, Blume Ventures) with a thesis narrative of "vertical SaaS for India's $14B staffing industry."

Phase 4 GTM expands beyond IT staffing:
- Healthcare staffing: NIPM healthcare chapter; Apollo Medskills network; National Health Systems Resource Centre (NHSRC) vendor network
- BPO/operations: NASSCOM BPO council; ASSOCHAM HR committee

A field sales hire is made in Hyderabad (covering South India) and one in NCR (covering North India and Pune). Both are former staffing industry operators, not software salespeople. They sell peer-to-peer, not vendor-to-customer.

---

## Section 5: Tenant Zero Proof Strategy

Hire'in Solutions (operated by Rayomind Group) is not a demo environment. It is a live staffing firm running this platform in production, generating real metrics every day. The strategic advantage of this position is that the primary sales objection — "does this actually work?" — is answered by a reference that is a genuine customer, not a simulation.

### 5.1 Five Specific Actions to Instrument Hire'in as Tenant Zero

**Action 1: Separate product branding from Hire'in**

The product must be marketed as a vendor product, not as "what Hire'in built for itself." The website, case study, and sales materials must lead with the product brand. Hire'in is identified as the Tenant Zero reference customer — it is named, with Rayomind's permission, and its metrics are cited — but it is presented as a customer of the platform, not the creator.

This separation is essential for credibility. Prospects must believe they are evaluating a multi-tenant product with a roadmap, not licensing a custom internal tool from a competitor.

**Action 2: Instrument and measure the Governance Control Tower for 30 days**

Before outreach begins, run a 30-day baseline measurement inside Hire'in:

| Metric | Measurement method |
|---|---|
| Manager obligation completion rate (probation check-ins) | Count check-ins completed on schedule / total check-ins due, from `check_ins` table |
| SOP acknowledgement rate | `sop_employee_progress` completion % across active SOPs |
| Offer-to-onboard cycle time | Days from `offer_letters.created_at` to `admin_users.joining_date` for the last 10 hires |
| Attendance accuracy | % of working days with a clean punch-in/out vs. absences requiring correction |
| Payroll processing time | Hours from payroll run initiation to disbursed status, from `salary_report_runs` |

These five metrics form the case study backbone. Every design partner will be measured against the same five metrics in their Tenant Zero comparison.

**Action 3: Publish 2 Insights articles per week under the Hire'in brand**

The Content Studio is live. The Insights blog is live. The distribution mechanism (newsletter subscribers, social cards, LinkedIn post schedule) is built.

Beginning immediately, the Hire'in brand publishes 2 articles per week on staffing operations, HR compliance, and talent acquisition. These articles serve three purposes:
- Build SEO authority for the product brand
- Establish Hire'in as a thought leader in the staffing community (which is the primary audience for the product)
- Provide content for LinkedIn outreach — a prospect who sees Hire'in publishing "What the Four Labour Codes mean for IT staffing firms in Bangalore" is more receptive to an outreach message from the same brand

**Action 4: Film a 90-second walkthrough video**

A single 90-second screen-recorded walkthrough of the platform — covering the Governance Control Tower, the offer letter signing chain, and the Content Studio — is the most efficient sales collateral that can be produced. It does not need professional production. It needs:
- A real environment (Hire'in production or the demo environment)
- A voiceover that uses customer language, not product feature language
- Captions and a thumbnail
- Hosted on Loom (for tracking who watches it and for how long) and on YouTube (for discoverability)

This video is linked in every LinkedIn outreach message after the discovery call. It is the asset that converts a curious prospect into a scheduled demo.

**Action 5: Build the reference case study data package**

Specific metrics to capture from Hire'in's Tenant Zero operation, to be published as the founding reference case:

| Metric | Target value to capture |
|---|---|
| Internal team size managed | Number of admin users on platform |
| Monthly payroll processing time | Hours saved vs. previous CA-managed process |
| Manager obligation completion rate (30-day baseline) | % before platform; % after 90 days |
| Offer letter cycle time | Days from generation to candidate signature |
| Document verification events | Number of `/verify` page lookups per month (demonstrates external usage) |
| Cost of previous tool stack | Total ₹/month across ATS + HRMS + payroll processor + document tools |
| Cost of platform | ₹/month on the commercial agreement |

The case study is published as a one-page PDF with real numbers (with Rayomind leadership approval) and a named quote from the CEO. It is the single most important asset for Phase 1 sales.

---

## Section 6: Entity Structure Recommendation

### 6.1 The Problem with the Current Structure

As of July 2026, the platform's IP lives inside the Hire'in codebase, which is operated as part of Rayomind Group's staffing business. This creates two problems:

1. **Investor illegibility:** A VC cannot invest in "IP embedded in a staffing firm's internal tool." The IP must sit in a clean entity with a clear cap table, no entanglement with the operating business's revenues, and a product-grade commercial agreement with its largest customer.

2. **Customer perception risk:** Prospects who learn that the platform is owned and operated by a competing staffing firm will question whether their data, job postings, and compensation information are safe. The entity separation must be complete and visible.

### 6.2 Recommended Corporate Structure

```
┌─────────────────────────────────────────────────────────────────┐
│              ESCAPE TECHNOLOGY PVT. LTD.                        │
│              (IP Owner & Product Company)                       │
│                                                                 │
│   - Owns platform IP, codebase, and product brand              │
│   - Employs or contracts product/engineering team              │
│   - Issues licenses to all tenants including Hire'in           │
│   - Receives Series A funding                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┴──────────────┐
           │                              │
           ▼                              ▼
┌─────────────────────┐        ┌──────────────────────────┐
│  RAYOMIND GROUP     │        │  HIRE'IN SOLUTIONS       │
│  (Strategic         │        │  (Tenant Zero)           │
│   Investor)         │        │                          │
│                     │        │  - Paying customer       │
│  - Advisory equity  │        │    (₹25K–₹40K/month)     │
│    stake in         │        │  - Reference case study  │
│    Escape Tech      │        │  - Design partner #0     │
│  - Commercial       │        │  - Earns advisory equity │
│    agreement        │        │    stake for first-mover │
│    provides         │        │    risk + case study     │
│    revenue          │        │    rights                │
└─────────────────────┘        └──────────────────────────┘
           │
           ▼
┌─────────────────────┐
│  RAYO ACADEMY       │
│  (Integration       │
│   Partner)          │
│                     │
│  - Integration      │
│    partner for      │
│    training module  │
│  - API-level        │
│    integration      │
│    (already live)   │
│  - Optional co-sell │
│    arrangement      │
└─────────────────────┘
```

### 6.3 Commercial Agreement Terms (Escape Technology ↔ Rayomind/Hire'in)

The commercial agreement between Escape Technology and Rayomind Group must be a real, executed contract — not an internal memo. It is a key document for any investor due diligence process.

Key terms:

| Term | Recommendation |
|---|---|
| Monthly platform fee | ₹40,000/month (top of design partner range; Hire'in is Tenant Zero, not a charity case) |
| Contract duration | 12 months, auto-renewing |
| Data ownership | Hire'in owns its data; Escape Technology has no right to use or share Hire'in's operational data with third parties |
| Reference rights | Hire'in grants Escape Technology the right to publish anonymised metrics and a named case study with Rayomind CEO approval |
| Advisory equity | Rayomind Group receives 2–5% equity in Escape Technology as compensation for: first-mover risk, case study rights, and co-development of the first version of the platform |
| IP ownership | Escape Technology owns all IP. The codebase, platform, and brand are the sole property of Escape Technology. Rayomind's equity does not create co-ownership of IP. |

### 6.4 The Brand Question

The product sold to external customers cannot be called "Hire'in Solutions." That is the tenant's brand, not the vendor's brand.

The product needs:
- A distinct product name (examples: StaffOS, OperateHR, RecruitOps — TBD; commission a naming sprint)
- A dedicated domain (e.g., staffos.in or operatehr.com)
- A product website separate from hire-in.com that communicates to the staffing firm buyer

Hire'in.com remains the marketing site for Rayomind's staffing business and continues to serve as the public face of the Tenant Zero operation.

The separation must be complete before Phase 1 outreach begins. A prospect who Googles the product name and lands on a staffing firm's job board has a fundamental trust problem that will kill the sale.

---

## Section 7: Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Design partners churn at day 90 (pilot-to-paid conversion fails) | Medium | High | Enforce real monthly fee during pilot (prevents the "free trial" mindset); measure ROI obsessively so the renewal case is data-driven |
| Competitor (Keka, DarwinBox) launches a staffing-specific module | Low (12-month horizon) | High | Move fast; lock in reference customers with multi-year contracts post-design partner; build the Ceipal integration moat deeper |
| Ceipal denies co-marketing due to competitive concerns | Medium | Medium | Proceed without Ceipal co-marketing; use NASSCOM and NIPM channels instead; the Ceipal integration is a unilateral technical advantage regardless |
| Entity separation is challenged (Hire'in data leakage concern from prospects) | Low | High | Execute the commercial agreement and data ownership terms in writing before any external sales motion; brief prospects proactively |
| Rayo Academy integration breaks the training module | Low | Low | Integration is already thin-client with graceful fallback; no single-point-of-failure |
| India labour code enforcement timeline slips (removing compliance urgency) | Medium | Medium | Platform delivers operational value independent of compliance urgency; reframe pitch around efficiency if compliance urgency is lower than expected |

---

## Section 8: 90-Day Immediate Action Plan

The following actions must be completed before the first external sales conversation.

| Action | Owner | Deadline | Done Looks Like |
|---|---|---|---|
| Register Escape Technology Pvt. Ltd. | Rayomind founding team | Aug 15, 2026 | CIN issued; MCA registration confirmed |
| Execute commercial agreement (Escape Tech ↔ Rayomind) | Both parties + legal | Aug 31, 2026 | Signed agreement in file with data ownership and reference rights clauses |
| Commission product brand naming | Founding team | Aug 31, 2026 | 3–5 candidate names shortlisted; domain availability confirmed |
| Set up demo environment | Engineering | Sep 15, 2026 | Isolated demo tenant live; populated with realistic seed data; accessible via product brand domain |
| Instrument Hire'in metrics (5 KPIs) | HR + Engineering | Sep 15, 2026 | 30-day baseline report showing all 5 metrics |
| Begin Insights publishing (2 articles/week) | Content lead | Immediately | First 4 articles published within 2 weeks |
| Film 90-second walkthrough video | Founding team | Sep 30, 2026 | Video on Loom + YouTube; view tracking enabled |
| Build LinkedIn outreach target list | Sales lead | Oct 1, 2026 | 150 qualified contacts identified via Sales Navigator |
| Prepare design partner agreement | Legal | Sep 30, 2026 | Executed template ready; no further approvals needed to sign |
| NASSCOM Emerge50 enrollment | Founding team | Sep 30, 2026 | Profile live in NASSCOM startup directory |

---

## Appendix A: India Staffing Industry — Key Reference Data

| Source | Data Point | Year |
|---|---|---|
| Indian Staffing Federation (ISF) | 20,000+ registered staffing firms; ₹1.2T market | 2024/2025 |
| NASSCOM | IT/ITES workforce: 5.4M; BPO: $38B | 2025 |
| ISF Annual Report | Formal workforce in organised staffing: 13M | 2024 |
| NIPM | 34 active chapters across India | 2024 |
| PeopleMatters TechHR India | Annual flagship HR tech conference | Recurring, Feb |
| NASSCOM HR Summit | Annual HR leadership summit | Recurring, Sep/Oct |
| Keka pricing (public) | ₹8,000–₹25,000/month for 50–200 employees | 2025 |
| DarwinBox pricing (estimated) | ₹15,000–₹60,000/month for 50–200 employees | 2025 |

## Appendix B: Platform Module Status vs. Sales Readiness

| Module | Build Status | Sales-Ready | Notes |
|---|---|---|---|
| Attendance + Leave + Payroll | Live (production) | Yes | India statutory PF/ESI/PT live; paise-precision engine confirmed |
| Offer letter lifecycle + e-sign | Live (production) | Yes | Candidate signing, cryptographic hash, countersign chain — all live |
| Performance management | Live (behind flag) | Yes (flag ON for demos) | Probation cadence, growth plans, coaching log |
| Content Studio + Insights | Live (production) | Yes | Article pipeline, BD agent, social cards, newsletter |
| Ceipal ATS integration | Live (production) | Yes | Job sync, applicant push, JWT token refresh |
| SOP compliance + Control Tower | Live (production) | Yes | Wave rollout, governance sweep, escalation |
| Public document verification | Live (production) | Yes | `/verify` endpoint; hash-based authentication |
| Training catalog + compliance lock | Live (production) | Yes | Track assignments, section progress, due-date gate |
| Client contracts + invoicing | Live (production) | Yes | MSA/SOW, client e-sign |
| Multi-tenancy | Not yet built | No | Phase 0 prerequisite; single-tenant architecture must be refactored before GA |
| Self-serve onboarding | Not yet built | No | Required for Phase 2 scale; design partner onboarding is currently manual |

**Critical engineering prerequisite:** Multi-tenancy is the single build item that must be completed before the platform can sign paying customers. The current architecture is single-tenant (Hire'in). A tenant isolation layer — separate database schemas or row-level security by tenant ID, with independent billing — must be scoped and built in Phase 0. This is the primary engineering risk for the launch timeline.

---

*This document is confidential and intended for Escape Technology Pvt. Ltd. and Rayomind Group leadership. It should not be shared externally without written approval from both parties.*

*Prepared in July 2026. Market data current as of Q2 2026. All financial projections are estimates based on publicly available industry data and comparable company analysis. They do not constitute a guarantee of future performance.*
