# HIS Academy — Complete Replit Build Prompt
## academy.hire-in.com | Hire'in Solutions Internal Learning Management System

---

## PROJECT OVERVIEW

Build **HIS Academy** (Hire'in Solutions Academy) — a full-featured internal Learning Management System (LMS) for a staffing company that trains Healthcare and IT Talent Acquisition Experts.

**URL:** `academy.hire-in.com` (subdomain of the main employee portal)
**Brand:** HIS Academy — its own identity, separate from the employee HR portal
**Auth:** Shared authentication with the employee portal (same database, same login — no second account needed)
**Integration:** A prominent "HIS Academy →" link in the employee portal auto-navigates to the academy. A "← Back to Portal" link in the academy returns to the employee portal.

---

## TECH STACK

- **Frontend:** Next.js 14+ (App Router) with TypeScript
- **Styling:** Tailwind CSS + shadcn/ui components
- **Database:** PostgreSQL (via Prisma ORM)
- **Auth:** NextAuth.js (shared session with employee portal)
- **File Storage:** Local uploads or S3-compatible storage for slide assets
- **Deployment:** Replit (with custom domain support for academy.hire-in.com)
- **Real-time:** Server-Sent Events or polling for leaderboard updates

---

## BRAND IDENTITY

### Colors
```
Primary Navy:    #1F4E79  (company brand, CFC track accent)
Primary Orange:  #F47C20  (energy, CTAs, highlights)
Healthcare Teal: #117A65  (CHTP track accent)
IT Purple:       #6C3483  (CITP track accent)
Success Green:   #1E8449
Warning Gold:    #D4AC0D
Light BGs:       #F8FAFC (page), #D6E4F0 (navy light), #D1F2EB (teal light), #E8DAEF (purple light)
```

### Typography
- Headings: Inter Bold or DM Sans Bold
- Body: Inter Regular
- Monospace accents: JetBrains Mono (for XP counters, badge codes)

### Logo / Branding
- "HIS Academy" wordmark with a subtle graduation cap or upward arrow integrated
- Tagline: "Where Talent Acquisition Experts Are Made"
- The Hire'in Solutions parent logo appears smaller in the footer

---

## DATABASE SCHEMA (Prisma)

```prisma
// ══════════════════════════════════════
// USER & AUTH
// ══════════════════════════════════════
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String
  role            UserRole  @default(TA_EXPERT)
  team            Team      @default(UNASSIGNED)
  avatarUrl       String?
  hireDate        DateTime?
  currentTier     Int       @default(0) // 0=uncertified, 1-4=tier level
  totalXP         Int       @default(0)
  monthlyXP       Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  enrollments     Enrollment[]
  moduleProgress  ModuleProgress[]
  assessmentAttempts AssessmentAttempt[]
  badges          UserBadge[]
  xpTransactions  XPTransaction[]
  assignments     TrainingAssignment[]  // as assignee
  assignedBy      TrainingAssignment[]  @relation("AssignedByManager")
  certificates    Certificate[]
  leaderboardEntries LeaderboardEntry[]
}

enum UserRole {
  TA_EXPERT
  TEAM_LEAD
  MANAGER
  DIRECTOR
  ADMIN
}

enum Team {
  UNASSIGNED
  HEALTHCARE
  IT
}

// ══════════════════════════════════════
// CERTIFICATION TRACKS
// ══════════════════════════════════════
model Track {
  id          String    @id @default(cuid())
  code        String    @unique  // "CFC", "CHTP", "CITP"
  name        String    // "Common Foundation Certification"
  description String
  accentColor String    // "#1F4E79", "#117A65", "#6C3483"
  lightColor  String
  icon        String?   // emoji or icon name
  sortOrder   Int
  isPrereq    Boolean   @default(false) // CFC is prereq for others
  createdAt   DateTime  @default(now())

  tiers       Tier[]
  enrollments Enrollment[]
}

model Tier {
  id              String    @id @default(cuid())
  trackId         String
  track           Track     @relation(fields: [trackId], references: [id])
  tierNumber      Int       // 1, 2, 3, 4
  name            String    // "Healthcare TA Foundations"
  description     String
  prerequisiteTierId String?  // previous tier that must be complete
  minMonths       Int       @default(0) // min months since prev tier
  xpToEarn        Int       // total XP available in this tier
  createdAt       DateTime  @default(now())

  modules         Module[]
  assessments     TierAssessment[]
}

model Module {
  id              String    @id @default(cuid())
  tierId          String
  tier            Tier      @relation(fields: [tierId], references: [id])
  code            String    @unique  // "CFC-101", "CHTP-102", etc.
  title           String
  description     String
  durationMinutes Int
  sortOrder       Int
  xpValue         Int       @default(100)
  prerequisiteModuleId String?  // module that must be complete first

  // Relations
  slides          Slide[]
  scenarios       Scenario[]
  quickFireQuiz   QuizQuestion[]
  progress        ModuleProgress[]
}

// ══════════════════════════════════════
// SLIDE-BASED TRAINING PLAYER
// ══════════════════════════════════════
model Slide {
  id          String    @id @default(cuid())
  moduleId    String
  module      Module    @relation(fields: [moduleId], references: [id])
  slideNumber Int
  slideType   SlideType
  title       String
  content     Json      // Rich content: text, images, videos, callouts
  notes       String?   // Presenter/learner notes
  createdAt   DateTime  @default(now())
}

enum SlideType {
  TITLE           // Module title slide
  CONTENT         // Standard content with text/images
  KEY_CONCEPT     // Highlighted concept with visual emphasis
  SCENARIO_INTRO  // Sets up a scenario challenge
  SCENARIO_RESPONSE // Learner writes their response
  SCENARIO_DEBRIEF  // Shows ideal response and evaluation
  QUICK_FIRE      // Timed quiz question
  VIDEO           // Embedded video content
  CHECKLIST       // Interactive checklist (e.g., screening checklist)
  LIVE_DRILL      // Instructions for live role-play exercise
  SUMMARY         // Module summary / key takeaways
  RED_FLAG_SPOTTER // Interactive red flag identification exercise
  SUBMISSION_SHOWDOWN // Head-to-head submission exercise
}

// ══════════════════════════════════════
// SCENARIOS & ASSESSMENTS
// ══════════════════════════════════════
model Scenario {
  id              String    @id @default(cuid())
  moduleId        String
  module          Module    @relation(fields: [moduleId], references: [id])
  title           String    // "The Specialty Mismatch"
  situation       String    // The scenario description
  question        String    // What the learner must decide
  idealResponse   String    // For manager reference
  xpBonus         Int       @default(200)
  rubricCriteria  Json      // Array of evaluation criteria
  // e.g., ["Requirement understanding", "Risk identification", "Communication quality", "Documentation quality", "Judgment"]
}

model QuizQuestion {
  id          String    @id @default(cuid())
  moduleId    String
  module      Module    @relation(fields: [moduleId], references: [id])
  question    String
  options     Json      // Array of {text, isCorrect}
  explanation String    // Shown after answering
  timeLimitSec Int      @default(60)
  sortOrder   Int
}

model TierAssessment {
  id              String    @id @default(cuid())
  tierId          String
  tier            Tier      @relation(fields: [tierId], references: [id])
  title           String
  passingScore    Int       @default(80) // percentage
  xpReward        Int       @default(500)
  questions       Json      // Array of assessment questions
  answerKey       Json      // Manager-only answer key

  attempts        AssessmentAttempt[]
}

model AssessmentAttempt {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  assessmentId    String
  assessment      TierAssessment @relation(fields: [assessmentId], references: [id])
  answers         Json
  score           Int       // percentage
  passed          Boolean
  managerNotes    String?
  reviewedById    String?
  attemptNumber   Int       @default(1)
  createdAt       DateTime  @default(now())
}

// ══════════════════════════════════════
// PROGRESS TRACKING
// ══════════════════════════════════════
model Enrollment {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  trackId     String
  track       Track     @relation(fields: [trackId], references: [id])
  status      EnrollmentStatus @default(IN_PROGRESS)
  enrolledAt  DateTime  @default(now())
  completedAt DateTime?

  @@unique([userId, trackId])
}

enum EnrollmentStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  EXPIRED
}

model ModuleProgress {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  moduleId        String
  module          Module    @relation(fields: [moduleId], references: [id])
  status          ModuleStatus @default(NOT_STARTED)
  currentSlide    Int       @default(0)
  totalSlides     Int       @default(0)
  scenarioScore   Int?
  quizScore       Int?
  startedAt       DateTime?
  completedAt     DateTime?
  timeSpentMin    Int       @default(0)

  @@unique([userId, moduleId])
}

enum ModuleStatus {
  LOCKED          // Prerequisite not met
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  NEEDS_REVIEW    // Waiting for manager evaluation
}

// ══════════════════════════════════════
// GAMIFICATION: XP, BADGES, LEADERBOARD
// ══════════════════════════════════════
model XPTransaction {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  amount      Int
  reason      String    // "Completed CFC-101", "Assessment 90%+", "Scenario Master"
  moduleCode  String?
  createdAt   DateTime  @default(now())
}

model Badge {
  id          String    @id @default(cuid())
  code        String    @unique  // "CFC_CERTIFIED", "SCENARIO_MASTER", "TIER1_HEALTHCARE"
  name        String
  description String
  icon        String    // emoji or SVG path
  category    BadgeCategory
  xpThreshold Int?      // auto-award at XP threshold
  trackCode   String?   // track-specific badge
  tierNumber  Int?      // tier-specific badge
  rarity      BadgeRarity @default(COMMON)

  users       UserBadge[]
}

enum BadgeCategory {
  CERTIFICATION   // Tier completion badges
  EXCELLENCE      // 90%+ assessment scores
  SCENARIO        // Scenario challenge wins
  MENTOR          // Mentoring activity
  IMPACT          // First placement post-cert
  STREAK          // Consistency badges
  SPECIAL         // Manager-awarded special recognition
}

enum BadgeRarity {
  COMMON
  UNCOMMON
  RARE
  EPIC
  LEGENDARY
}

model UserBadge {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  badgeId     String
  badge       Badge     @relation(fields: [badgeId], references: [id])
  awardedAt   DateTime  @default(now())
  awardedBy   String?   // manager who awarded it, if manual

  @@unique([userId, badgeId])
}

model Certificate {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  trackCode       String
  tierNumber      Int
  certificateCode String    @unique // "HIS-CFC-2026-001"
  title           String    // "Common Foundation Certification"
  issuedAt        DateTime  @default(now())
  verificationUrl String    // Public URL to verify certificate
  pdfUrl          String?   // Generated PDF certificate
}

model LeaderboardEntry {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  month       Int
  year        Int
  monthlyXP   Int
  rank        Int?
  createdAt   DateTime  @default(now())

  @@unique([userId, month, year])
}

// ══════════════════════════════════════
// MANAGER ASSIGNMENTS & REVIEWS
// ══════════════════════════════════════
model TrainingAssignment {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  assignedById    String
  assignedBy      User      @relation("AssignedByManager", fields: [assignedById], references: [id])
  moduleCode      String
  reason          String    // "Weak submission quality — per Q1 scorecard review"
  quarter         String    // "Q1 2026"
  deadline        DateTime
  status          AssignmentStatus @default(ASSIGNED)
  completedAt     DateTime?
  managerNotes    String?
  createdAt       DateTime  @default(now())
}

enum AssignmentStatus {
  ASSIGNED
  IN_PROGRESS
  COMPLETED
  OVERDUE
}
```

---

## APPLICATION ARCHITECTURE

### Route Structure

```
/                           → Academy Dashboard (home)
/tracks                     → All certification tracks overview
/tracks/cfc                 → CFC track page with tier/module list
/tracks/chtp                → CHTP track page
/tracks/citp                → CITP track page
/tracks/[trackCode]/[tierNum]/[moduleCode]  → Module detail / start
/learn/[moduleCode]         → Slide-based training player (fullscreen)
/learn/[moduleCode]/scenario/[scenarioId]   → Scenario challenge
/learn/[moduleCode]/quiz    → Quick-fire quiz
/assessments/[assessmentId] → Tier assessment
/badges                     → Badge shelf (all badges, earned + locked)
/certificates               → My certificates with download/share
/certificates/verify/[code] → Public certificate verification page
/leaderboard                → Team XP leaderboard
/profile                    → My profile, XP history, progress overview
/manager                    → Manager dashboard (assign, review, evaluate)
/manager/assign             → Assign training modules to team members
/manager/review/[attemptId] → Review a scenario or assessment submission
/manager/scorecard/[userId] → View employee scorecard + training data
/manager/dashboard          → Team certification health overview
/admin/courses              → Admin: manage tracks, tiers, modules, slides
/admin/badges               → Admin: manage badge definitions
/admin/users                → Admin: manage users and roles
```

### Layout Structure

```
AcademyLayout
├── TopNav
│   ├── HIS Academy Logo/Wordmark
│   ├── Navigation: Dashboard | My Tracks | Badges | Leaderboard
│   ├── XP Counter (animated, always visible)
│   ├── Notification Bell
│   └── User Avatar + Dropdown (Profile, Certificates, Back to Portal →)
├── Main Content Area
│   └── [Page Content]
└── Footer
    ├── Hire'in Solutions © 2026
    ├── Confidential — Internal Use Only
    └── ← Back to Employee Portal
```

---

## PAGE-BY-PAGE SPECIFICATIONS

### 1. ACADEMY DASHBOARD (/)

The home page should feel like opening a game — progress is visible, next actions are clear, and momentum is celebrated.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Welcome back, [Name]!                              │
│  [Current Tier Badge]  Tier [X] [Track Name]        │
│  [═══════════70%═══════════] 1,450 / 2,000 XP       │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Continue  │  │ Assigned │  │ Next Up  │           │
│  │ CFC-104  │  │ 2 modules│  │ CHTP-101 │           │
│  │ Slide 8/15│  │ Due: Mar │  │ Locked 🔒│           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                                      │
│  ┌─ Recent Badges ──────────────────────────┐        │
│  │  🏅 CFC-101  🏅 Quick Fire  🏅 Scenario │        │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  ┌─ Team Leaderboard (Top 5) ───────────────┐        │
│  │  1. Prabhnoor — 2,100 XP                 │        │
│  │  2. Ayushi — 1,890 XP                    │        │
│  │  3. YOU — 1,450 XP  ← You are here       │        │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  ┌─ Manager Assignments ────────────────────┐        │
│  │  ⚡ CHTP-201: Advanced Credentialing      │        │
│  │  Reason: Q1 scorecard — credential gaps   │        │
│  │  Due: March 31, 2026                      │        │
│  └──────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
```

**Key Components:**
- **XP Progress Bar:** Animated bar showing XP toward next tier. Color matches current track accent.
- **Continue Learning Card:** Shows the last module the user was working on, with slide progress.
- **Assigned Modules Card:** Shows manager-assigned training with deadlines. Overdue items show red.
- **Next Up Card:** Shows the next unlocked module in their track. Locked modules show the prerequisite.
- **Recent Badges:** Horizontal scroll of recently earned badges with glow animation on new ones.
- **Mini Leaderboard:** Top 5 from their team with the user's position highlighted.
- **Manager Assignments Panel:** If they have outstanding assignments, show them prominently with reason and deadline.

---

### 2. TRACK OVERVIEW PAGE (/tracks/[trackCode])

Shows the full certification track as a visual journey map — like a game level map.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  [Track Icon] CERTIFIED HEALTHCARE TA PERFORMANCE   │
│  TRACK (CHTP)                                        │
│  Prerequisite: CFC Certified ✅                      │
│                                                      │
│  ┌─ TIER 1: Healthcare TA Foundations ──────────┐    │
│  │                                               │    │
│  │  CHTP-101 ──→ CHTP-102 ──→ CHTP-103          │    │
│  │  [✅ Done]    [▶ Current]   [🔒 Locked]       │    │
│  │                    ↓                          │    │
│  │              CHTP-104 ──→ CHTP-105            │    │
│  │              [🔒 Locked]   [🔒 Locked]        │    │
│  │                    ↓                          │    │
│  │          [Tier 1 Assessment]                   │    │
│  │          [🔒 Complete all modules first]       │    │
│  └───────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ TIER 2: Healthcare TA Advanced ─────────────┐    │
│  │  [🔒 Requires: Tier 1 + 3 months + perf]     │    │
│  └───────────────────────────────────────────────┘    │
│                                                      │
│  [Similar for Tier 3 and Tier 4]                     │
└─────────────────────────────────────────────────────┘
```

**Visual Design:**
- Each module is a **node** on a visual path/map
- Completed modules: filled circle with checkmark, accent color
- Current module: pulsing/glowing circle, "Continue →" button
- Locked modules: greyed out with lock icon, tooltip showing prerequisite
- Lines/arrows connect modules showing prerequisite flow
- Tier sections are collapsible cards
- Each module node shows: code, title, duration, XP value, status

---

### 3. SLIDE-BASED TRAINING PLAYER (/learn/[moduleCode])

This is the core learning experience. Full-screen, distraction-free, beautiful.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  [← Exit]  CFC-104: Recruitment Lifecycle    [8/15] │
│  [═══════════ 53% ════════════]                      │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │                                               │   │
│  │           [SLIDE CONTENT AREA]                │   │
│  │                                               │   │
│  │   Varies by slide type:                       │   │
│  │   - Rich text with callout boxes              │   │
│  │   - Key concept with visual emphasis          │   │
│  │   - Scenario with response textarea           │   │
│  │   - Quick-fire quiz with timer                │   │
│  │   - Checklist with interactive toggles        │   │
│  │   - Red Flag Spotter with clickable items     │   │
│  │                                               │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  [◀ Previous]              [Notes 📝]   [Next ▶]    │
│                                                      │
│  ┌─ Slide Navigation Dots ──────────────────────┐    │
│  │  ● ● ● ● ● ● ● ◉ ○ ○ ○ ○ ○ ○ ○             │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Slide Types and Rendering:**

**TITLE slide:** Large module title, track badge, estimated duration, learning objectives listed.

**CONTENT slide:** Rich markdown-rendered content with:
- Callout boxes (tip, warning, important) styled with colored left borders
- Bold key terms
- Images if present
- "Key Takeaway" highlighted box at bottom

**KEY_CONCEPT slide:** Single concept displayed large and centered with an icon, short explanation below. Think flashcard style. These are the most memorable slides.

**SCENARIO_INTRO slide:** Scenario situation displayed in a styled card with a situation icon. The question is shown below. A "Submit Your Response →" button leads to the response slide.

**SCENARIO_RESPONSE slide:** Textarea for the learner to write their response. Character count shown. Timer optional. "Submit for Review" button saves the response and sends it to the manager queue.

**SCENARIO_DEBRIEF slide:** After manager review OR after self-study mode, shows the ideal response alongside the learner's response. Evaluation criteria shown as a rubric with scores.

**QUICK_FIRE slide:** A question with 4 options and a visible countdown timer (60 seconds default). Correct answer shows green with explanation. Wrong answer shows red with explanation. XP awarded for correct answers.

**CHECKLIST slide:** Interactive checklist (e.g., "Healthcare Screening Checklist") where the learner clicks to check off items. All items must be checked to proceed. Teaches the actual workflow.

**LIVE_DRILL slide:** Instructions for a live exercise (e.g., "Record yourself delivering a voicemail for this role"). Upload area for recording or text. Marked for manager review.

**RED_FLAG_SPOTTER slide:** Displays a candidate profile or scenario. Learner must click/select all red flags. Scored on accuracy and completeness. Missed red flags are highlighted after submission.

**SUBMISSION_SHOWDOWN slide:** Instructions for the paired exercise. Links to a shared workspace where two learners prepare competing submissions. Manager reviews and declares a winner.

**Player Features:**
- Progress auto-saves on every slide advance
- "Notes" sidebar for personal notes per slide
- Keyboard navigation (← → for prev/next)
- Time tracking (total time spent per module)
- Confetti animation on module completion
- XP popup animation when XP is earned (+100 XP!)

---

### 4. BADGE SHELF (/badges)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  🏆 MY BADGES                    Total: 12 / 47     │
│                                                      │
│  ┌─ Certification Badges ───────────────────────┐    │
│  │  [✅ CFC]  [✅ CHTP-T1]  [🔒 CHTP-T2]  ...  │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ Excellence Badges ──────────────────────────┐    │
│  │  [✅ 90%+ CFC]  [🔒 90%+ CHTP-T1]  ...      │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ Scenario Badges ───────────────────────────┐     │
│  │  [✅ Scenario Master x3]  [🔒 Scenario Pro]  │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ Impact Badges ─────────────────────────────┐     │
│  │  [✅ First Placement]  [🔒 5 Placements]     │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ Special Badges ────────────────────────────┐     │
│  │  [✅ Mentor]  [🔒 Top Monthly XP]            │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Badge Card Design:**
- Earned: Full color with glow effect, earned date, click to view detail
- Locked: Greyed out silhouette, tooltip shows requirement
- Rarity border: Common (grey), Uncommon (green), Rare (blue), Epic (purple), Legendary (gold with shimmer)
- Click on badge → modal with: full description, when earned, XP it gave, share button

**Share Feature:**
- "Share to LinkedIn" button generates an image card with the badge and "Certified by HIS Academy — Hire'in Solutions"
- Direct link to public verification page

---

### 5. LEADERBOARD (/leaderboard)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  🏆 TEAM LEADERBOARD — March 2026                   │
│  [Monthly ▼]  [Healthcare | IT | All Teams]          │
│                                                      │
│  ┌─────┬────────────────┬────────┬──────────────┐    │
│  │ #1  │ 🥇 Prabhnoor   │ 2,100  │ ████████████ │   │
│  │ #2  │ 🥈 Ayushi       │ 1,890  │ ██████████   │   │
│  │ #3  │ 🥉 Abhilash     │ 1,450  │ ████████     │   │
│  │ #4  │    Anjali        │ 1,200  │ ██████       │   │
│  │ #5  │    Lakshay       │   980  │ █████        │   │
│  │ #6  │    Maheep        │   750  │ ████         │   │
│  │ #7  │    Dimpal        │   600  │ ███          │   │
│  └─────┴────────────────┴────────┴──────────────┘    │
│                                                      │
│  Your position: #3 of 7  |  1,450 XP this month     │
│  650 XP to reach #2                                  │
│                                                      │
│  ┌─ Monthly Hall of Fame ───────────────────────┐    │
│  │  Jan 2026: Prabhnoor 🏆                      │    │
│  │  Feb 2026: Ayushi 🏆                         │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Filter by: Healthcare team, IT team, All
- Toggle: Monthly, Quarterly, All-Time
- Animated bars showing relative XP
- "You are here" highlight on the user's row
- "XP to next rank" motivational counter
- Hall of Fame showing past monthly winners
- Resets monthly (but all-time total is always visible)

---

### 6. CERTIFICATES PAGE (/certificates)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  📜 MY CERTIFICATES                                  │
│                                                      │
│  ┌─ Common Foundation Certification ────────────┐    │
│  │  Issued: Feb 15, 2026                         │    │
│  │  Code: HIS-CFC-2026-001                       │    │
│  │  [Download PDF]  [Share]  [Verify Link]        │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ CHTP Tier 1: Healthcare TA Foundations ─────┐    │
│  │  Issued: Mar 8, 2026                          │    │
│  │  Code: HIS-CHTP1-2026-001                     │    │
│  │  [Download PDF]  [Share]  [Verify Link]        │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Certificate PDF Design:**
- Professional certificate with Hire'in Solutions branding
- HIS Academy logo
- Employee name, certification title, tier, date issued
- Unique verification code
- QR code linking to public verification page
- Signed by "Academy Director" (configurable)

**Public Verification Page (/certificates/verify/[code]):**
- Publicly accessible (no login required)
- Shows: certificate title, holder name, issue date, verification status
- "This certificate is valid and verified by HIS Academy — Hire'in Solutions"
- This is what LinkedIn shares link to

---

### 7. MANAGER DASHBOARD (/manager)

```
┌─────────────────────────────────────────────────────┐
│  📊 MANAGER DASHBOARD                                │
│                                                      │
│  ┌─ Team Certification Health ──────────────────┐    │
│  │  Overall: 72% of team is current on certs     │    │
│  │  ┌─ Ayushi: Tier 2 ✅ (on track)             │    │
│  │  ├─ Prabhnoor: Tier 2 ✅ (on track)          │    │
│  │  ├─ Abhilash: Tier 1 ⚠️ (1 module overdue)  │    │
│  │  ├─ Anjali: CFC 🔴 (assessment pending)      │    │
│  │  └─ Lakshay: CFC ✅ (just certified)         │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ Pending Reviews ────────────────────────────┐    │
│  │  3 scenario responses awaiting evaluation     │    │
│  │  1 tier assessment awaiting review            │    │
│  │  [Review Queue →]                             │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ Quick Actions ──────────────────────────────┐    │
│  │  [Assign Training]  [Review Submissions]      │    │
│  │  [View Scorecards]  [Export Reports]           │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ Quarterly Assignment Status ────────────────┐    │
│  │  Q1 2026: 8 assigned | 5 complete | 2 in      │    │
│  │  progress | 1 overdue                          │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Manager Assignment Flow:**
1. Manager clicks "Assign Training"
2. Selects team member from dropdown
3. Selects module(s) from catalog (filtered by team member's track)
4. Writes reason (text field, required — e.g., "Q1 scorecard shows weak submission quality")
5. Sets deadline
6. Employee receives notification and sees it on their dashboard

**Manager Review Flow:**
1. Manager clicks "Review Queue"
2. Sees list of pending scenario responses and assessment attempts
3. Opens a response, sees the scenario, the learner's answer, and the rubric
4. Scores each rubric criterion (1-5 scale)
5. Adds notes
6. Marks as passed/needs improvement
7. XP is awarded automatically if passed

---

### 8. ADMIN COURSE BUILDER (/admin/courses)

A simple but functional admin interface for creating and managing training content.

**Features:**
- CRUD for Tracks, Tiers, Modules
- Slide builder: drag-and-drop slide ordering, rich text editor for content, slide type selector
- Scenario builder: situation, question, ideal response, rubric criteria
- Quiz builder: question, 4 options, correct answer, explanation
- Badge manager: create badges, set criteria, assign track/tier
- Preview mode: see the course as a learner would

---

## SEED DATA

The application must be seeded with the complete certification structure from our training documents:

### Tracks
1. **CFC** — Common Foundation Certification (accent: #1F4E79)
2. **CHTP** — Certified Healthcare TA Performance Track (accent: #117A65)
3. **CITP** — Certified IT TA Performance Track (accent: #6C3483)

### CFC Modules (Tier 1 only — CFC has no tiers, just modules)
- CFC-101: Company Identity, Culture, and TA Expert Mindset (prereq: none, 3hrs, 100XP)
- CFC-102: Candidate Care Standard and Relationship Philosophy (prereq: CFC-101, 2hrs, 100XP)
- CFC-103: Companywide Policies and Communication Standards (prereq: CFC-101, 2hrs, 100XP)
- CFC-104: Recruitment Lifecycle and Definition of Done (prereq: CFC-102 + CFC-103, 3hrs, 100XP)
- CFC-105: Communication Excellence (prereq: CFC-104, 3hrs, 100XP)
- CFC-106: Quality Standards, Documentation, and Systems Setup (prereq: CFC-104, 2hrs, 100XP)

### CHTP Modules (4 Tiers)
**Tier 1** (prereq: CFC Certified)
- CHTP-101: Healthcare Industry Fundamentals (prereq: CFC, 4hrs)
- CHTP-102: Healthcare Compliance, Licensure, and Credentialing (prereq: CHTP-101, 4hrs)
- CHTP-103: Healthcare Recruitment SOP and Definition of Done (prereq: CHTP-102, 3hrs)
- CHTP-104: Healthcare Communication, Outreach, and Screening (prereq: CHTP-103, 3hrs)
- CHTP-105: Healthcare Submission Quality and Documentation (prereq: CHTP-104, 2hrs)

**Tier 2** (prereq: Tier 1 + 3 months)
- CHTP-201: Advanced Healthcare Credentialing (prereq: Tier 1)
- CHTP-202: Healthcare Consultative Intake and Client Advisory (prereq: CHTP-201)
- CHTP-203: Healthcare Negotiation (prereq: CHTP-201)
- CHTP-204: Healthcare Post-Placement Care (prereq: CHTP-201)

**Tier 3** (prereq: Tier 2 + 6 months + top quartile)
- CHTP-301: Healthcare Market Dynamics and Specialty Depth (prereq: Tier 2)
- CHTP-302: Complex Healthcare Close Scenarios (prereq: CHTP-301)
- CHTP-303: Healthcare Client Partnership (prereq: CHTP-301)
- CHTP-304: Healthcare Mentoring and Knowledge Transfer (prereq: CHTP-301)

**Tier 4** (prereq: Tier 3 + 12 months)
- CHTP-401: Healthcare Team Leadership (prereq: Tier 3)
- CHTP-402: Strategic Healthcare Account Management (prereq: CHTP-401)
- CHTP-403: Healthcare Training Design (prereq: CHTP-401)
- CHTP-404: Healthcare Business Development (prereq: CHTP-401)

### CITP Modules (4 Tiers — same structure, IT content)
**Tier 1** (prereq: CFC Certified)
- CITP-101: IT Industry Fundamentals and Role Families
- CITP-102: Technology Stack Awareness and Technical Fluency
- CITP-103: IT Recruitment SOP, Authorization, and Definition of Done
- CITP-104: IT Communication, Outreach, and Technical Screening
- CITP-105: IT Submission Quality and Recruiter Summary Writing

**Tier 2** (prereq: Tier 1 + 3 months)
- CITP-201: Advanced IT Stack Assessment and Market Intelligence
- CITP-202: IT Consultative Intake and Client Advisory
- CITP-203: IT Negotiation: Rates, Counteroffers, Close
- CITP-204: IT Post-Placement Care and Redeployment

**Tier 3** (prereq: Tier 2 + 6 months)
- CITP-301: Emerging Technology Trends and Architecture Awareness
- CITP-302: Complex IT Close Scenarios and Competing Offers
- CITP-303: IT Client Partnership and Account Expansion
- CITP-304: IT Mentoring and Knowledge Transfer

**Tier 4** (prereq: Tier 3 + 12 months)
- CITP-401: IT Team Leadership and Performance Coaching
- CITP-402: Strategic IT Account Management
- CITP-403: IT Training Design and Delivery
- CITP-404: IT Business Development Fundamentals

### Badges to Seed
- CFC_CERTIFIED (Certification, Common, awarded on CFC completion)
- CHTP_TIER1, CHTP_TIER2, CHTP_TIER3, CHTP_TIER4 (Certification, Uncommon→Legendary)
- CITP_TIER1, CITP_TIER2, CITP_TIER3, CITP_TIER4 (Certification, Uncommon→Legendary)
- EXCELLENCE_90 (Excellence, awarded on any 90%+ assessment, Uncommon)
- EXCELLENCE_95 (Excellence, awarded on any 95%+ assessment, Rare)
- PERFECT_SCORE (Excellence, awarded on 100% assessment, Epic)
- SCENARIO_MASTER (Scenario, awarded after 3 scenario wins, Uncommon)
- SCENARIO_PRO (Scenario, awarded after 10 scenario wins, Rare)
- FIRST_PLACEMENT (Impact, manual award after first placement post-cert, Rare)
- FIVE_PLACEMENTS (Impact, manual award, Epic)
- MENTOR_BADGE (Mentor, awarded for mentoring a Tier 1 colleague, Uncommon)
- MONTHLY_TOP_XP (Special, awarded to monthly leaderboard winner, Rare)
- STREAK_7 (Streak, 7 consecutive days of learning activity, Common)
- STREAK_30 (Streak, 30 consecutive days, Uncommon)
- QUICK_FIRE_CHAMPION (Scenario, 10 quick-fire quizzes answered correctly in a row, Rare)

### Sample Users to Seed
- Simranjeet S Sidana (Admin/Director)
- Ayushi Tiwari (TA Expert, Healthcare team)
- Prabhnoor Singh (TA Expert, IT team)
- Abhilash Singh (TA Expert, Healthcare team)
- Anjali Sahu (TA Expert, IT team)
- Lakshay Patel (TA Expert, Healthcare team)
- Maheep Singh (TA Expert, IT team)
- Dimpal Kumar (TA Expert, Healthcare team)

---

## KEY BUSINESS RULES

### Prerequisite Enforcement
1. A module cannot be started until its prerequisite module(s) are completed (status = COMPLETED)
2. CHTP and CITP tracks cannot be started until CFC is fully certified
3. Tier 2+ requires the previous tier to be complete AND a minimum time to have passed
4. The UI must always show why something is locked (tooltip: "Complete CFC-102 first")

### XP System
- Module completion: +100 XP
- Assessment pass (80-89%): +150 XP
- Assessment pass (90%+): +250 XP + Excellence Badge
- Scenario challenge win: +200 XP
- Tier completion: +500 XP + Tier Badge
- Mentoring activity: +300 XP (manager-awarded)
- First placement post-cert: +500 XP + Impact Badge (manager-awarded)
- Quick-fire quiz perfect: +50 XP bonus
- Monthly XP resets for leaderboard purposes; total XP never resets

### Certificate Generation
- Automatically generated when a tier is completed and the tier assessment is passed
- Unique code format: HIS-[TRACK]-[TIER]-[YEAR]-[SEQUENCE]
- PDF generation with professional layout
- Public verification URL
- Cannot be revoked without admin action

### Manager Assignment Rules
- Only users with role TEAM_LEAD, MANAGER, or DIRECTOR can assign
- Assignments must include a reason (text field, required)
- Assignments must include a deadline
- Overdue assignments are flagged on both the employee and manager dashboards
- Manager must have completed the module they are assigning (enforced)

---

## ANIMATIONS AND MICRO-INTERACTIONS

- **XP popup:** When XP is earned, a floating "+100 XP" animates upward from the source element and flies to the XP counter in the nav bar, which briefly pulses
- **Badge earned:** Full-screen modal with the badge icon, shimmer animation, rarity glow, and "Share" button
- **Module complete:** Confetti animation (use canvas-confetti library)
- **Tier complete:** Extended celebration — badge reveal + certificate preview + "Share Your Achievement" prompt
- **Leaderboard rank change:** Subtle slide animation when your position changes
- **Streak counter:** Flame emoji that grows with streak length (7 days: 🔥, 14 days: 🔥🔥, 30 days: 🔥🔥🔥)
- **Quick-fire timer:** Circular countdown animation with color change (green → yellow → red)
- **Slide transitions:** Smooth horizontal slide between training slides
- **Progress bar:** Animated fill with easing

---

## RESPONSIVE DESIGN

- Desktop: Full experience
- Tablet: Full experience with adjusted layout
- Mobile: Simplified but fully functional — training player must work well on mobile for on-the-go learning
- The slide player should be swipeable on mobile (swipe left/right for prev/next)

---

## BUILD SEQUENCE / TASK ORDER

### Phase 1: Foundation (Build First)
1. Set up Next.js project with Tailwind + shadcn/ui
2. Set up Prisma with PostgreSQL and run migrations
3. Set up NextAuth.js authentication
4. Create the AcademyLayout (nav, footer, subdomain routing)
5. Build the Academy Dashboard (home page)
6. Seed the database with all tracks, tiers, modules, badges, and sample users

### Phase 2: Slide-Based Training Player
7. Build the slide player component (full-screen, multi-type)
8. Build slide type renderers (all 13 types listed above)
9. Implement progress tracking and auto-save
10. Build the quick-fire quiz component with timer
11. Build the scenario challenge flow (intro → response → debrief)

### Phase 3: Track and Module Pages
12. Build the track overview page with visual prerequisite map
13. Build module detail page (start/continue)
14. Implement prerequisite enforcement logic
15. Build enrollment and module unlock system

### Phase 4: Gamification
16. Build XP transaction system
17. Build badge award system (auto + manual)
18. Build the badge shelf page
19. Build the leaderboard page
20. Build XP popup and badge earned animations

### Phase 5: Certificates
21. Build certificate generation (PDF)
22. Build certificates page
23. Build public verification page
24. Build share-to-LinkedIn feature

### Phase 6: Manager Tools
25. Build manager dashboard
26. Build assignment creation flow
27. Build scenario/assessment review queue
28. Build employee scorecard view
29. Build team certification health overview

### Phase 7: Admin
30. Build admin course management (CRUD for tracks, tiers, modules)
31. Build admin slide builder
32. Build admin badge management
33. Build admin user management

---

## IMPORTANT NOTES FOR DEVELOPERS

1. **This is an internal tool.** It does not need to support public registration. All users are created by admins or synced from the employee portal.

2. **The auto-login from the employee portal** works via shared session cookies on the same domain (hire-in.com). Both apps use the same NextAuth configuration pointing to the same database.

3. **Content is king.** The slide content itself will be added by the admin after the platform is built. The seed data creates the structure (tracks, tiers, modules) but slides will be populated through the admin interface.

4. **Performance matters.** The slide player must be fast. Pre-load the next 2-3 slides. No loading spinners between slides.

5. **Accessibility.** All interactive elements must be keyboard navigable. Color is never the only indicator (always include text labels/icons alongside color coding).

6. **The look and feel should be modern, clean, and motivating.** Think Duolingo meets Coursera meets a professional training platform. Not corporate-boring, not gamer-flashy. Professional but engaging.

---

## SAMPLE ENVIRONMENT VARIABLES

```env
DATABASE_URL=postgresql://user:pass@host:5432/his_academy
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://academy.hire-in.com
NEXT_PUBLIC_PORTAL_URL=https://portal.hire-in.com
NEXT_PUBLIC_APP_NAME="HIS Academy"
NEXT_PUBLIC_COMPANY_NAME="Hire'in Solutions"
```

---

**END OF PROMPT**

This is the complete specification for building HIS Academy. Build it in the order specified in the Build Sequence. Start with Phase 1.
