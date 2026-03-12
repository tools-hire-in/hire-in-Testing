# Rayo Academy — Product & Architecture Specification
  ### Prepared by: Rayomind Solutions — Architecture & Product
  ### Version: 1.0 | Confidential — Internal Use Only

  ---

  ## 1. Product Vision

  **Rayo Academy** is a B2B SaaS Learning Management System built specifically for the staffing and talent acquisition industry. It delivers structured, verifiable certification training for Talent Acquisition (TA) professionals — with gamification, scenario-based learning, and publicly verifiable digital certificates.

  **Tagline:** Where Talent Acquisition Experts Are Made

  **Parent company:** Rayomind Solutions  
  **URL:** rayo.academy (or academy.rayomind.com)  
  **Initial audience:** Internal Rayomind / Hire'in Solutions employees  
  **Commercial audience:** Staffing agencies, RPO firms, talent acquisition teams at enterprise companies  

  ---

  ## 2. Strategic Context

  ### Why This Product Exists

  The staffing and TA training market has no purpose-built solution:
  - Bottom 50% of staffing companies have zero structured training
  - Top 25% use generic LMS tools (TalentLMS, Cornerstone) with no industry content
  - Even enterprise firms (AMN, Aya, Robert Half) do not offer verifiable TA certification programs to the industry

  Rayo Academy's differentiation is **domain-specific content written by practitioners** — not a generic platform with generic content.

  ### Two-Phase Business Model

  | Phase | Audience | Revenue |
  |---|---|---|
  | Phase 1 (Now) | Internal Rayomind / Hire'in Solutions employees | Cost of doing business — internal proof of concept |
  | Phase 2 (6–12 months) | Other staffing companies, RPO firms, TA teams | Per-seat SaaS subscription |

  ### Why "Rayo Academy" (Not HIS Academy)

  Launching under Hire'in Solutions branding would create a commercial ceiling — no competing staffing company will adopt a product bearing a rival's name. "Rayo Academy" under Rayomind Solutions is architecturally independent: it can be sold, funded, or spun off without brand confusion.

  ---

  ## 3. Certification Track Structure

  ### Three Certification Programs

  ```
  CFC — Common Foundation Certification (prerequisite for all tracks)
  ├── 6 modules, ~15 hours total
  ├── Covers: TA Expert mindset, candidate care, communication, lifecycle SOP,
  │         quality standards, documentation & systems
  └── Required before starting any specialist track

  CHTP — Certified Healthcare TA Performance (specialist)
  ├── 4 Tiers × 4–5 modules each (~20 modules total)
  ├── Tier 1: Foundations (healthcare industry, compliance, SOP, communication)
  ├── Tier 2: Advanced (credentialing, consultative intake, negotiation)
  ├── Tier 3: Senior (market dynamics, complex close, client partnership)
  └── Tier 4: Lead (team leadership, strategic accounts, training design)

  CITP — Certified IT TA Performance (specialist)  
  ├── 4 Tiers × 4–5 modules each (~20 modules total)
  ├── Tier 1: Foundations (IT industry, tech stack awareness, SOP, screening)
  ├── Tier 2: Advanced (stack assessment, consultative intake, negotiation)
  ├── Tier 3: Senior (emerging tech, complex close, client expansion)
  └── Tier 4: Lead (team leadership, strategic accounts, business development)
  ```

  ### Prerequisite Chain
  ```
  CFC (all 6 modules) → CHTP Tier 1 → Tier 2 (3 months + performance) → Tier 3 → Tier 4
                      ↘ CITP Tier 1 → Tier 2 → Tier 3 → Tier 4
  ```

  ### MVP Scope (Phase 1)
  Build the full platform architecture but seed only CFC Tier 1 content. All 6 CFC modules with real content, scenarios, and quizzes. CHTP and CITP locked pending content authoring.

  ---

  ## 4. Feature Specification

  ### 4.1 Public Landing Page
  The marketing homepage — no login required. Designed to convert visitors into trial signups.

  **Sections:**
  1. **Hero** — "Where Talent Acquisition Experts Are Made" headline. Sub-headline: "The only certification program built specifically for healthcare and IT talent acquisition teams." CTA: "Get Started" + "See How It Works"
  2. **Track Preview Cards** — CFC (Navy), CHTP (Teal), CITP (Purple). Each shows module count, total hours, XP available, and certification badge preview
  3. **Why Rayo Academy** — 6-card feature grid:
     - Scenario-Based Learning (not theoretical quizzes — real judgment situations)
     - Verifiable Certificates (public URL on LinkedIn-ready certs)
     - XP + Leaderboard (monthly team competition, Hall of Fame)
     - Manager Dashboard (assign, track, grade, export)
     - Prerequisite Chains (structured progression, not self-paced chaos)
     - Written by Practitioners (content authored by active TA professionals)
  4. **Competitive Benchmark Strip** — 4-column table: Bottom 50% / Top 25% / Enterprise / Rayo Academy
  5. **Quote / Social Proof** — Pull quote on the TA Expert identity
  6. **CTA Footer** — "Ready to certify your team?" + "Request Demo" button

  ### 4.2 Authentication
  - **Separate from any existing HR portal** — Rayo Academy has its own login
  - Email + password (bcrypt hashed)
  - Optional: SSO integration for companies that want single-sign-on
  - Role system: learner, manager, org_admin, rayo_super_admin
  - Multi-tenant: each company is an "organization" with its own users

  ### 4.3 Academy Dashboard (post-login)
  Game-like home screen that makes progress visible and next actions obvious.

  **Layout:**
  - Welcome banner + current tier/certification badge
  - XP progress bar ("1,450 / 2,000 XP to CFC Certified")
  - 3 action cards: Continue (last in-progress module) | Assigned (manager-assigned, due soon) | Next Up (next locked module + what unlocks it)
  - Recent badges shelf (up to 5, most recent first)
  - Quick stats: Modules completed | Days active | Leaderboard rank

  ### 4.4 Track & Module Browser
  - Track listing: 3 cards (CFC, CHTP, CITP) with lock/unlock status and progress
  - Track detail: tier accordion — each tier shows its modules in sequence with status chips
  - Module card: code, title, duration estimate, XP value, prerequisites, status

  ### 4.5 Module Player
  The core learning experience. Focused layout, always accessible, no artificial gates.

  **Section Types:**
  | Type | Description |
  |---|---|
  | CONTENT | Markdown rendered with rich typography, callout boxes (tip/warning/important), comparison tables |
  | SCENARIO | Situation + question + textarea for written response. Min 100 chars, submitted for manager review. Rubric shown after submission. |
  | QUIZ | Timed (60 sec/question), 4-option multiple choice, immediate feedback with explanation, final score with XP award |
  | SUMMARY | Key takeaways list, "Complete Module → +100 XP" CTA |

  **Navigation:** Previous / Next section always visible. Reading time shown as soft indicator ("Suggested reading: ~4 min") — not a gate. Sidebar shows module sections with completion checkmarks.

  ### 4.6 XP System
  | Action | XP |
  |---|---|
  | Complete a module | +100 XP |
  | Quiz score 80–89% | +0 bonus |
  | Quiz score 90–100% | +50 XP bonus |
  | Scenario Champion (manager-awarded) | +200 XP |
  | Complete full tier (all modules) | +500 XP |

  XP tracked per user in a transaction log (reason, module code, timestamp). Monthly XP resets on the 1st — all-time total preserved separately. Monthly reset drives the leaderboard competition.

  ### 4.7 Badge System
  Keep it simple — 4 badge categories:

  | Badge | Trigger |
  |---|---|
  | COMPLETION | Auto-awarded per module completed (e.g. "CFC-101 Complete") |
  | EXCELLENCE | Auto-awarded when quiz score ≥ 90% |
  | SCENARIO_CHAMPION | Manager-awarded after grading a scenario submission |
  | CERTIFIED | Auto-awarded on completing all modules in a tier |

  Badge page: grid showing all possible badges. Earned = colored + shine effect. Locked = grayscale + lock icon + tooltip showing unlock condition.

  ### 4.8 Leaderboard
  - Monthly XP ranking for all users in the organization
  - Filter: Healthcare team | IT team | All
  - Toggle: This Month | All Time
  - Animated XP bars (relative width), 🥇🥈🥉 for top 3
  - Current user's row highlighted
  - "X XP to reach rank N" motivational counter below user row
  - Hall of Fame section: past monthly winners with month, name, XP
  - Auto-refreshes every 60 seconds

  ### 4.9 Certificates
  Generated automatically when a learner completes all modules in a tier.

  **Certificate contains:**
  - Rayo Academy branding (logo, colors)
  - Learner full name (large, prominent)
  - Certification title ("Common Foundation Certification" / "Certified Healthcare TA — Tier 1")
  - Certificate code (format: RAYO-CFC-2026-0001)
  - Issue date
  - "Verified by Rayo Academy" with QR code / public URL

  **Verification page** — public, no login required. URL format: `rayo.academy/verify/RAYO-CFC-2026-0001`. Shows: valid / invalid, learner name, certification, issue date. This is what goes on a LinkedIn profile.

  **Download:** PDF (A4 landscape, print-quality).

  ### 4.10 Manager Panel
  Three tabs accessible to users with manager, org_admin, or rayo_super_admin roles.

  **Tab 1 — Assign Training**
  - Select team member → see their current module status
  - Select module(s) to assign with due date + documented reason
  - Reason field: "Q1 scorecard: weak submission quality — CHTP-103 addresses this directly"

  **Tab 2 — Team Progress Matrix**
  - Rows: team members. Columns: modules.
  - Color-coded cells: locked (gray) / not started (white) / in progress (amber) / completed (green)
  - Click cell → section-level detail: time spent, quiz score, scenario submitted Y/N
  - CSV export

  **Tab 3 — Scenario Reviews**
  - Queue of all scenario submissions pending manager grading
  - Review modal: learner's response + rubric criteria checklist + score (0–100) + optional feedback
  - "Award Scenario Champion Badge" checkbox — triggers +200 XP + badge
  - Graded submissions update learner's module status in real time

  ---

  ## 5. Brand & Design System

  ### Colors
  ```
  Primary Navy:      #1F4E79  (CFC track, primary brand)
  Primary Orange:    #F47C20  (CTAs, highlights, XP counter)
  Healthcare Teal:   #117A65  (CHTP track accent)
  IT Purple:         #6C3483  (CITP track accent)
  Success Green:     #1E8449
  Warning Amber:     #D4AC0D
  Error Red:         #C0392B
  Page Background:   #F8FAFC
  Card Background:   #FFFFFF
  Border:            #E2E8F0
  ```

  ### Typography
  - Headings: Inter Bold or DM Sans Bold
  - Body: Inter Regular (16px base, 1.6 line height)
  - XP counters / badge codes: JetBrains Mono (monospace accent)
  - Certificate learner name: Playfair Display (serif, prestigious feel)

  ### Logo & Identity
  - Wordmark: "Rayo Academy" with a stylized lightning bolt or upward arrow integrated into the 'A'
  - Tagline: "Where Talent Acquisition Experts Are Made"
  - Parent attribution: "by Rayomind Solutions" (smaller, in footer)
  - Each track has its own color identity that flows through all UI for that track

  ### Layout Principles
  - Clean white content area, Navy topnav
  - Card-based layout with consistent 24px gutters
  - XP counter always visible in the topnav (orange chip, e.g. "⚡ 1,450 XP")
  - Mobile-first — module player must work well on tablet and phone

  ---

  ## 6. Technical Architecture

  ### Recommended Stack
  ```
  Frontend:     React 18 + TypeScript (Vite)
  Styling:      Tailwind CSS + shadcn/ui
  State:        TanStack Query (React Query)
  Routing:      Wouter or React Router
  Backend:      Node.js + Express (TypeScript)
  Database:     PostgreSQL
  ORM:          Drizzle ORM
  Auth:         Email/password (bcrypt) + session-based (express-session)
  File Storage: S3-compatible (for certificate PDF storage)
  Email:        SendGrid (for invitations, welcome emails)
  PDF:          Puppeteer or html-pdf-node (certificate generation)
  ```

  ### Multi-Tenancy Design (Critical — Must Be Right From Day 1)
  Every table that will eventually serve multiple companies needs an `org_id` column, even if it only ever holds value `1` (Rayomind Solutions) in Phase 1. Adding this later requires a painful migration.

  ```
  organizations         (id, name, domain, plan_tier, created_at)
  academy_users         (id, org_id, email, password_hash, role, ...)
  academy_tracks        (id, org_id, code, name, accent_color, ...)
  academy_tiers         (id, track_id, tier_number, name, ...)
  academy_modules       (id, tier_id, code, title, xp_value, ...)
  academy_sections      (id, module_id, title, content_markdown, section_type, sort_order)
  academy_quiz_questions(id, section_id, question, options_json, time_limit_sec)
  academy_scenarios     (id, section_id, title, situation, question, ideal_response, rubric_criteria_json)
  academy_enrollments   (id, user_id, org_id, track_id, status, enrolled_at)
  academy_module_progress(id, user_id, module_id, status, current_section_idx, completed_at)
  academy_section_progress(id, user_id, section_id, status, quiz_score, scenario_response, scenario_graded, scenario_score)
  academy_xp_transactions(id, user_id, org_id, amount, reason, module_code, created_at)
  academy_badges_earned (id, user_id, badge_code, awarded_at, awarded_by)
  academy_certificates  (id, user_id, org_id, track_code, tier_number, cert_code, issued_at, verification_hash)
  ```

  ### Route Structure
  ```
  / (public landing page)
  /login
  /dashboard
  /tracks
  /tracks/:code
  /tracks/:code/tier/:n
  /learn/:moduleCode
  /badges
  /leaderboard
  /certificates
  /verify/:code (public, no login)
  /manager
  /manager/assign
  /manager/progress
  /manager/scenarios
  /admin (org admin panel)
  ```

  ---

  ## 7. MVP Delivery Scope

  ### Must Have (Phase 1)
  - [ ] Public landing page (sellable, marketing quality)
  - [ ] Email/password auth with multi-tenant org structure
  - [ ] Academy dashboard with XP counter and action cards
  - [ ] CFC track: all 6 modules with full content, scenarios, quizzes
  - [ ] Module player (content, scenario, quiz, summary sections)
  - [ ] XP system (award on completion, quiz bonus)
  - [ ] Badge auto-award (Completion, Excellence)
  - [ ] Leaderboard (monthly, org-scoped)
  - [ ] Certificate generation (PDF + public verification URL)
  - [ ] Manager panel (assign, progress matrix, scenario review)
  - [ ] CHTP + CITP tracks visible but locked ("Content coming soon")

  ### Defer to Phase 2
  - [ ] SSO / SAML for enterprise clients
  - [ ] White-label certificate (company's own logo)
  - [ ] Slide-based player (multimedia, embedded video)
  - [ ] In-app notifications / email alerts
  - [ ] Billing / subscription management
  - [ ] Content authoring tool for org_admins
  - [ ] Mobile app

  ---

  ## 8. Content Plan

  ### CFC Tier 1 — 6 Modules (Full content ready for seeding)

  | Code | Title | Sections | Duration |
  |---|---|---|---|
  | CFC-101 | Company Identity, Culture & TA Expert Mindset | 5 (content×3, scenario×1, quiz×1) | 3 hrs |
  | CFC-102 | Candidate Care Standard & Relationship Philosophy | 5 | 2 hrs |
  | CFC-103 | Companywide Policies & Communication Standards | 5 | 2 hrs |
  | CFC-104 | Recruitment Lifecycle & Definition of Done | 6 | 3 hrs |
  | CFC-105 | Communication Excellence (Call, VM, SMS, Email, Objections) | 6 | 3 hrs |
  | CFC-106 | Quality Standards, Documentation & Systems Setup | 5 | 2 hrs |

  CFC Final Assessment: 25 questions, 80% pass threshold, +500 XP, CFC Certified badge + certificate.

  ### CHTP Tier 1 — 5 Modules (content authoring required)

  | Code | Title | Duration |
  |---|---|---|
  | CHTP-101 | Healthcare Industry Fundamentals | 4 hrs |
  | CHTP-102 | Healthcare Compliance, Licensure & Credentialing | 4 hrs |
  | CHTP-103 | Healthcare Recruitment SOP & Definition of Done | 3 hrs |
  | CHTP-104 | Healthcare Communication, Outreach & Screening | 3 hrs |
  | CHTP-105 | Healthcare Submission Quality & Documentation | 2 hrs |

  ### CITP Tier 1 — 5 Modules (content authoring required)

  | Code | Title | Duration |
  |---|---|---|
  | CITP-101 | IT Industry Fundamentals & Role Families | 4 hrs |
  | CITP-102 | Technology Stack Awareness & Technical Fluency | 4 hrs |
  | CITP-103 | IT Recruitment SOP, Authorization & Definition of Done | 3 hrs |
  | CITP-104 | IT Communication, Outreach & Technical Screening | 3 hrs |
  | CITP-105 | IT Submission Quality & Recruiter Summary Writing | 2 hrs |

  ---

  ## 9. Go-to-Market (Phase 2 Preview)

  ### Pricing Model (suggested)
  | Plan | Users | Price | Features |
  |---|---|---|---|
  | Starter | Up to 10 | $299/month | CFC track, basic leaderboard, certificates |
  | Growth | Up to 50 | $799/month | All tracks, manager panel, scenario reviews |
  | Enterprise | Unlimited | Custom | White-label, SSO, custom content, dedicated support |

  ### Sales Angle
  - "Your team can be certified in 15 hours — verifiable on LinkedIn"
  - "The only training program that actually teaches healthcare and IT recruiting"
  - Demo: show live leaderboard, print a certificate on screen during the call

  ---

  ## 10. Success Metrics (Phase 1)

  | Metric | Target |
  |---|---|
  | Internal team CFC completion rate | 100% within 60 days of launch |
  | Average module quiz score | ≥ 80% |
  | Leaderboard engagement | ≥ 70% of employees check it weekly |
  | Certificates issued | At least 1 per active employee |
  | Manager scenario reviews | ≥ 1 per week per manager |

  ---

  *Document prepared by Rayomind Solutions — Architecture & Product*  
  *For internal use and Rayo Academy development team*
  