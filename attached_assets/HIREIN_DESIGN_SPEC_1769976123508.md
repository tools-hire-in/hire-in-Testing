# Hire'in Solutions - Complete Website Design Specification

> **Document Purpose**: This comprehensive design specification contains everything needed to recreate the Hire'in Solutions staffing agency website. Use this document with the Replit Agent prompt at the end to build an identical website.

---

## Table of Contents
1. [Company Overview](#1-company-overview)
2. [Design System](#2-design-system)
3. [Site Architecture](#3-site-architecture)
4. [Page Specifications](#4-page-specifications)
5. [Component Library](#5-component-library)
6. [Static Content & Copy](#6-static-content--copy)
7. [Metadata & SEO](#7-metadata--seo)
8. [Assets & Images](#8-assets--images)
9. [Forms & CTAs](#9-forms--ctas)
10. [Contact Information](#10-contact-information)
11. [Replit Agent Prompt](#11-replit-agent-prompt)

---

## 1. Company Overview

### Brand Identity
- **Company Name**: Hire'in Solutions
- **Tagline**: "Where AI Meets Human Intuition"
- **Established**: 2014
- **Legal Entity**: Rayomind Software Solutions LLC, doing business as Hire'in Solutions
- **Industry**: AI-Powered Recruitment & Staffing Services
- **Primary Focus**: Healthcare, IT, Engineering, and Professional Services recruitment

### Brand Positioning
Hire'in Solutions is a comprehensive recruitment firm that combines AI-powered matching with human expertise. While serving all industries, the company has specialized healthcare recruitment capabilities and medical credentialing expertise.

### Core Values
1. **Innovation** - Leveraging AI and technology for better outcomes
2. **Integrity** - Transparency, honesty, and ethical practices
3. **Human-First Approach** - Technology enhances but never replaces human judgment
4. **Industry Excellence** - Highest standards of compliance and placement quality

### Key Differentiators
- AI-powered candidate matching (saves 80% screening time)
- Fill-once-share-forever skills checklists
- Healthcare priority with compliance verification
- End-to-end transparency with real-time updates

### Success Metrics (Display on website)
- 10+ Years in Business (Since 2014)
- 95% Client Retention Rate
- 90% AI Accuracy Rate
- 98% Client Satisfaction
- 50% Faster Placements
- 100% Healthcare Compliance

---

## 2. Design System

### Color Palette

#### Primary Colors (Light Mode)
```css
:root {
  /* Core Brand Colors */
  --primary: hsl(15, 94%, 61%);              /* Orange - Main brand color */
  --primary-foreground: hsl(0, 0%, 100%);    /* White text on primary */
  
  /* Background & Surface */
  --background: hsl(210, 40%, 98%);          /* Light grayish-blue background */
  --foreground: hsl(215, 25%, 17%);          /* Dark text */
  --card: hsl(0, 0%, 100%);                  /* White cards */
  --card-foreground: hsl(215, 25%, 17%);     /* Dark text on cards */
  
  /* Secondary & Muted */
  --secondary: hsl(210, 40%, 96%);           /* Light gray-blue */
  --secondary-foreground: hsl(215, 25%, 17%);
  --muted: hsl(210, 40%, 96%);
  --muted-foreground: hsl(215, 13%, 65%);    /* Gray text */
  
  /* Accent (Same as Primary) */
  --accent: hsl(15, 94%, 61%);               /* Orange accent */
  --accent-foreground: hsl(0, 0%, 100%);
  
  /* Destructive */
  --destructive: hsl(0, 85%, 60%);           /* Red for errors */
  --destructive-foreground: hsl(0, 0%, 100%);
  
  /* Borders & Input */
  --border: hsl(214, 32%, 91%);              /* Light gray border */
  --input: hsl(214, 32%, 91%);
  --ring: hsl(15, 94%, 61%);                 /* Orange focus ring */
  
  /* Brand Variations */
  --brand-orange: hsl(15, 94%, 61%);
  --brand-orange-light: hsl(15, 100%, 97%);
  --brand-orange-hover: hsl(15, 100%, 55%);
  --progress-green: hsl(142, 71%, 45%);
}
```

#### Dark Mode Colors
```css
.dark {
  --background: hsl(0, 0%, 0%);
  --foreground: hsl(200, 6.67%, 91.18%);
  --card: hsl(228, 9.80%, 10%);
  --card-foreground: hsl(0, 0%, 85.10%);
  --popover: hsl(0, 0%, 0%);
  --popover-foreground: hsl(200, 6.67%, 91.18%);
  --primary: hsl(15, 94%, 61%);
  --primary-foreground: hsl(0, 0%, 100%);
  --secondary: hsl(195, 15.38%, 94.90%);
  --secondary-foreground: hsl(210, 25%, 7.84%);
  --muted: hsl(0, 0%, 9.41%);
  --muted-foreground: hsl(210, 3.39%, 46.27%);
  --accent: hsl(15, 94%, 61%);
  --accent-foreground: hsl(0, 0%, 100%);
  --border: hsl(210, 5.26%, 14.90%);
  --input: hsl(207.69, 27.66%, 18.43%);
}
```

#### Compliance Badge Colors
```css
/* HIPAA Badge */
.badge-hipaa { background: #EFF6FF; border: #BFDBFE; color: #1E3A8A; }

/* Encryption Badge */
.badge-encryption { background: #ECFDF5; border: #A7F3D0; color: #065F46; }

/* TJC Badge */
.badge-tjc { background: #FAF5FF; border: #E9D5FF; color: #581C87; }

/* Verified Badge */
.badge-verified { background: #FFFBEB; border: #FDE68A; color: #92400E; }
```

### Typography

#### Font Families
```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;  /* Headings */
--font-body: 'Open Sans', system-ui, -apple-system, sans-serif;  /* Body */
--font-serif: Georgia, serif;
--font-mono: Menlo, monospace;
```

#### Font Import
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Open+Sans:wght@300;400;500;600;700&display=swap');
```

#### Type Scale
| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| H1 (Hero) | Inter | 4xl-6xl | Bold (700) | 1.1 |
| H2 (Section) | Inter | 3xl-5xl | Bold (700) | 1.2 |
| H3 (Card Title) | Inter | xl-2xl | Bold (700) | 1.3 |
| H4 (Subsection) | Inter | lg-xl | Semibold (600) | 1.4 |
| Body | Open Sans | base-lg | Regular (400) | 1.6 (relaxed) |
| Small/Caption | Open Sans | sm-xs | Regular/Medium | 1.5 |

### Spacing & Layout
```css
--radius: 8px;                    /* Border radius */
--spacing: 0.25rem;               /* Base spacing unit */
--layout-padding-tight: 1rem;
--layout-gap-compact: 0.75rem;
--layout-gap-minimal: 0.5rem;
```

### Container Widths
- Max container: `max-w-7xl` (1280px)
- Content max: `max-w-4xl` or `max-w-5xl`
- Padding: `px-4 lg:px-6`

### Shadows
```css
--shadow-sm: 0px 2px 0px 0px hsl(210, 50%, 37% / 0.00), 0px 1px 2px -1px hsl(210, 50%, 37% / 0.00);
--shadow-lg: 0px 2px 0px 0px hsl(210, 50%, 37% / 0.00), 0px 4px 6px -1px hsl(210, 50%, 37% / 0.00);
--shadow-xl: 0px 2px 0px 0px hsl(210, 50%, 37% / 0.00), 0px 8px 10px -1px hsl(210, 50%, 37% / 0.00);
```

---

## 3. Site Architecture

### Navigation Structure

#### Primary Navigation (Header)
```
Logo (Hire'in Solutions - Est. 2014)
├── Home
├── About
├── Services (Dropdown)
│   ├── Healthcare Recruitment
│   ├── IT & Software Development
│   ├── Engineering & Technical
│   ├── Professional Services
│   └── Contract Staffing
├── Jobs
├── Resources (Dropdown) [Optional]
│   └── FAQ
└── Contact
```

#### Call-to-Action Buttons (Header)
- **Start Hiring** (Primary button - for employers)
- **Apply Now** (Secondary/outline button - for candidates)

#### Footer Structure
```
Footer
├── Column 1: Company Info
│   ├── Logo + Tagline
│   ├── Company description
│   └── Social Links (LinkedIn)
├── Column 2: Quick Links
│   ├── About Us
│   └── Our Services
├── Column 3: Services
│   ├── Healthcare Recruitment
│   ├── IT & Software Development
│   ├── Engineering & Technical
│   ├── Professional Services
│   ├── Executive Placement
│   └── Contract Staffing
├── Compliance Badges Row
│   ├── HIPAA-Ready Architecture
│   ├── Smart Encryption
│   ├── TJC-HCSS Aligned
│   └── Healthcare Verified
└── Bottom Bar
    ├── Copyright
    ├── Privacy Policy
    ├── Terms of Service
    └── Contact Us
```

### URL Routes
| Route | Page |
|-------|------|
| `/` | Home |
| `/about` | About Us |
| `/services/healthcare-recruitment` | Healthcare Recruitment Service |
| `/services/it-software` | IT & Software Development Service |
| `/services/engineering-technical` | Engineering & Technical Service |
| `/services/non-it-professional` | Professional Services |
| `/services/contract-staffing` | Contract Staffing Service |
| `/jobs` | Jobs Board |
| `/contact` | Contact Us |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |
| `/resources-faq` | FAQ (Optional) |

---

## 4. Page Specifications

### 4.1 Home Page (`/`)

#### Structure
1. **Header** - Sticky navigation with logo, menu, CTAs
2. **Hero Section** - Full-screen carousel with overlay content
3. **About Section** - Company introduction
4. **Services Section** - Three service cards
5. **Why Choose Us Section** - Features grid + metrics
6. **How It Works Section** - 4-step process
7. **Footer** - Company info, links, compliance badges

#### Hero Section Details
- **Layout**: Full-screen height (`h-screen`)
- **Background**: Image carousel with 4 rotating images (4-second intervals)
- **Overlay**: Dark gradient for text legibility
- **Content**: Centered text with headline, subheadline, and 2 CTAs
- **Navigation**: Left/right arrows + dot indicators at bottom

**Hero Images (use similar Unsplash images):**
1. Healthcare professionals in hospital setting
2. IT team collaborating in modern office
3. Healthcare clinic staff with telehealth
4. Engineers working with AI technology

**Hero Content:**
```
Headline: "Your Success, Our Mission"
Subheadline: "AI-powered recruitment meets human expertise. Find exceptional talent 80% faster with guaranteed compliance."

CTA 1: "Start Hiring Today" (Primary)
CTA 2: "Apply for Opportunities" (Outline)
```

#### About Section (Home Page)
```
Title: "About Hire'in Solutions"
Subtitle: "AI Meets Human Intuition"

Content: "Founded in 2014, Hire'in Solutions revolutionizes recruitment by combining cutting-edge AI technology with experienced human recruiters. We serve Healthcare, IT, and Professional sectors with unmatched efficiency and accuracy."

Stats (in grid):
- 10+ Years Experience
- 95% Client Retention
- 90% AI Accuracy
```

#### Services Section
**Title**: "Our Services"
**Subtitle**: "Specialized talent solutions across three critical sectors, delivering vetted professionals who drive your success."

**Service Cards (3 columns on desktop):**

1. **Healthcare** (Priority card with border accent)
   - Icon: Heart
   - Description: End-to-end talent solutions for healthcare providers, hospitals, clinics, and telehealth companies. Expertise in clinical (doctors, nurses), operational, and allied health staffing.
   - List: Clinical Staff, Allied Health Professionals, Healthcare Operations, Telehealth Specialists
   - CTA: "Learn More"

2. **IT**
   - Icon: Code
   - Description: Full-spectrum IT hiring — software engineers, DevOps, cloud, data, cybersecurity. From startups to enterprises, we deliver modern technical talent.
   - List: Software Engineers, DevOps & Cloud Engineers, Data Scientists & Analysts, Cybersecurity Specialists
   - CTA: "Learn More"

3. **Non-IT & Engineering**
   - Icon: Briefcase
   - Description: Skilled professionals in finance, marketing, operations, industrial, and core engineering streams.
   - List: Finance & Accounting, Marketing & Operations, Industrial Engineering, Core Engineering Streams
   - CTA: "Learn More"

#### Why Choose Us Section
**Title**: "Why Choose Hire'in Solutions?"
**Subtitle**: "Where cutting-edge AI meets human expertise to deliver perfect talent matches for your organization."

**Features Grid (4 columns):**
1. **AI-Powered Matching** - Icon: Brain, Badge: "Save 80% Time"
2. **Fill Once, Share Forever** - Icon: Share2, Badge: "Zero Redundancy"
3. **Healthcare Priority** - Icon: Shield, Badge: "Compliance Ready"
4. **End-to-End Transparency** - Icon: Eye, Badge: "Full Transparency"

**Metrics Row (3 columns):**
- 98% Client Satisfaction (Icon: Award)
- 50% Faster Placements (Icon: Clock)
- 100% Healthcare Compliance (Icon: Shield)

#### How It Works Section
**Title**: "How It Works"
**Subtitle**: "Our proven 4-step process combines AI efficiency with human expertise to deliver exceptional results"

**Steps (alternating layout):**
1. **Submit Requirements** - Share your job requirements, company culture, and specific needs
2. **AI Pre-screening** - Our advanced AI algorithms analyze and match candidates
3. **Human Validation** - Our experts personally interview for cultural fit
4. **Perfect Match** - Receive pre-vetted, qualified candidates ready for interviews

---

### 4.2 About Page (`/about`)

#### Hero Section
```
Title: "Revolutionizing Recruitment: Where AI Meets Human Intuition"
Subtitle: "Hire'in Solutions is a comprehensive recruitment firm that combines AI-powered matching with human expertise. While we excel across all industries, our healthcare recruitment capabilities and medical credentialing expertise make us the preferred partner for medical organizations."

CTAs:
- "Start Your Journey" (Primary)
- "Our Story" (Outline - scrolls to section)
```

#### Company Story Section
**Title**: "Born from Recruitment Crisis, Powered by Innovation"

**The Challenge We Saw:**
"Organizations across IT, Healthcare, Engineering, and other critical sectors were struggling with talent shortages. Skilled professionals were available, but the recruitment process was slow, inefficient, and often missed the perfect matches. Businesses were losing competitive edge, and the industry needed a revolution.

We realized that while technology could dramatically improve efficiency and accuracy, it could never replace the human touch that makes recruitment truly successful. That's when Hire'in Solutions was born."

**Mission/Vision/Purpose Box:**
- Mission: Empowering recruiters with AI while preserving human connection
- Vision: Creating the most transparent, efficient hiring universe
- Purpose: Full-service recruitment firm with healthcare excellence

#### Core Values Section
**Title**: "Values That Drive Us"
**Subtitle**: "Every decision we make is guided by these four fundamental principles"

1. **Innovation** - We continuously push the boundaries of what's possible in recruitment
2. **Integrity** - Transparency, honesty, and ethical practices are at the core
3. **Human-First Approach** - Technology enhances but never replaces human judgment
4. **Industry Excellence** - We maintain the highest standards of compliance and placement quality

#### Stats Section (Orange background)
**Title**: "Our Progress"
**Subtitle**: "Building meaningful connections between talent and opportunity since 2014."

- 10+ Years in Business
- 95% Client Retention Rate
- 90% AI Accuracy Rate

---

### 4.3 Healthcare Recruitment Page (`/services/healthcare-recruitment`)

#### Hero
```
Badge: "Healthcare Recruitment" with Heart icon
Title: "AI-Powered Healthcare Talent Solutions"
Subtitle: "Combining advanced AI screening with deep healthcare expertise to deliver Joint Commission compliant, licensed professionals who understand critical care environments and patient-centered service."

CTAs:
- "Start Hiring Healthcare Talent"
- "Schedule Consultation"
```

#### Value Proposition Cards (3 columns)
1. **Joint Commission Compliance** - Icon: Shield
2. **Rapid Placement** - Icon: Clock
3. **Quality Guarantee** - Icon: Award

#### AI Tools Section (4 items)
1. Resume Parsing & Analysis - Advanced NLP extracts medical credentials
2. Compliance Verification - Automated licensing checks
3. Skills Matching - Matches clinical specializations, EMR experience
4. Telehealth Screening - Evaluates remote care capabilities

#### Human Touch Section (4 items)
1. Cultural Fit Assessment - Understanding bedside manner and team dynamics
2. Clinical Interview Coaching - Preparing candidates for medical scenarios
3. Career Guidance - Personalized advice on specialization paths
4. Onboarding Support - Smooth transition assistance

#### Success Stories (3 cards)
1. Regional Medical Center - 52 nurses in 28 days, 98% retention
2. Telehealth Startup - 25 positions in 3 weeks, 200% capacity growth
3. Children's Hospital - 100% compliance rate, 60% faster time-to-hire

#### Roles We Fill
- Clinical Staff: RNs, LPNs, CNAs, Medical Assistants
- Physicians: Primary Care, Specialists, Hospitalists, Emergency Medicine
- Allied Health: Physical/Occupational/Respiratory Therapists, Medical Technologists
- Healthcare Operations: Administrators, Medical Records, Quality Assurance, Compliance Officers
- Telehealth: Remote Care Physicians, Telehealth Nurses, Virtual Care Specialists

---

### 4.4 Jobs Page (`/jobs`)

#### Header Section
```
Title: "Healthcare Opportunities"
Subtitle: "Find your next healthcare career opportunity with Hire'in Solutions"
```

#### Filters (Row)
- Search input (text)
- Specialty dropdown
- State dropdown
- Employment Type dropdown
- Clear Filters button

#### Job Cards Grid
Each card shows:
- Job Title
- Location (City, State)
- Employment Type badge
- Salary range
- Posted date
- Summary (truncated)
- "Apply Now" button

#### Application Modal
Fields:
- Full Name (required)
- Email (required)
- Phone (required)
- Cover Letter (textarea)
- Years of Experience
- Current Employer
- LinkedIn URL

---

### 4.5 Contact Page (`/contact`)

#### Header
```
Title: "Get in Touch"
Subtitle: "Ready to find your next opportunity or hire top talent? Our recruitment experts are here to help you succeed."
```

#### Contact Information (Left Column)
**Office Address:**
2621 Leigh Ave.
San Jose, CA-95124
United States

**Phone Numbers:**
- Main: +1 (415) 663-5944
- HealthCare: +1 (408) 892-9656
- IT and Software Development: +1 (408) 876-0779

**Email Addresses:**
- General & Employers: contact@hire-in.com
- Job Seekers: careers@hire-in.com

**Business Hours:**
- Monday - Friday: 6:00 AM - 6:00 PM PST
- Saturday: 8:00 AM - 2:00 PM PST
- Sunday: Closed

#### Contact Options (Right Column - Card)
**Title**: "Send us a Message"

Three inquiry type boxes:
1. **General Inquiries** - Questions about services, partnerships
2. **Job Seekers** - Submit resume or inquire about positions
3. **Employers** - Discuss hiring needs

Each opens a modal form.

---

### 4.6 Terms of Service Page (`/terms`)

Full legal document with sections:
1. Acceptance of Terms
2. Description of Services
3. Eligibility and Registration
4. Service Agreements and Scope
5. Fees and Payment Terms
6. SMS and Communication Compliance
7. Confidentiality
8. Intellectual Property
9. Limitation of Liability
10. Indemnification
11. Termination
12. Governing Law
13. Dispute Resolution
14. Miscellaneous

---

### 4.7 Privacy Policy Page (`/privacy`)

Full legal document with sections:
1. Enhanced Privacy Provisions (Data Retention, Sensitive Info, Vendor Oversight)
2. Information We Collect
3. How We Use Information
4. Information Sharing
5. Data Security
6. Your Rights (CCPA/CPRA Compliance)
7. Cookies and Tracking
8. Third-Party Links
9. Children's Privacy
10. Changes to Policy
11. Contact Information

---

## 5. Component Library

### Header Component
- Fixed/sticky positioning
- Logo with "Est. 2014" heritage badge
- Centered navigation menu
- Services dropdown on hover
- Right-aligned CTA buttons
- Mobile hamburger menu
- Secret admin navigation (Ctrl+Shift+H + 5 logo clicks)

### Footer Component
- 3-column layout (Company, Quick Links, Services)
- Compliance badges row
- Bottom bar with copyright and legal links
- LinkedIn social link

### Hero Carousel
- Full-screen height
- Auto-rotating images (4-second interval)
- Manual navigation arrows
- Dot indicators
- Dark overlay for text contrast
- Centered content with fade animations

### Service Card
- Rounded corners (xl)
- Icon in colored circle
- Title, description, bullet list
- Full-width CTA button
- Hover shadow effect

### Feature Card
- Icon in primary-tinted circle
- Badge above title
- Centered layout
- Border on hover

### Metric Card
- Large number display
- Icon above
- Label below
- Light background

### Step Card (How It Works)
- Step number display
- Icon in circle
- Title and description
- Highlight box with checkmark

### Consultation Modal
- Form with fields: Name, Email, Phone, Message
- Dynamic title/description based on CTA source
- Submit button with loading state
- Success/error toast notifications

### Job Card
- Title, location, type badge
- Salary and date
- Summary text
- Apply button opening modal

---

## 6. Static Content & Copy

### Company Taglines
- "Where AI Meets Human Intuition"
- "Your Success, Our Mission"
- "Transforming careers and empowering businesses"
- "A decade+ of recruitment innovation"

### Service Descriptions

**Healthcare:**
"End-to-end talent solutions for healthcare providers, hospitals, clinics, and telehealth companies. Expertise in clinical (doctors, nurses), operational, and allied health staffing. All candidates are deeply vetted for credentials and compliance."

**IT:**
"Full-spectrum IT hiring — software engineers, DevOps, cloud, data, cybersecurity. From startups to enterprises, we deliver modern technical talent, pre-vetted for both hard and soft skills."

**Non-IT & Engineering:**
"Skilled professionals in finance, marketing, operations, industrial, and core engineering streams. Rigorous screening tailored to each industry, ensuring the right fit for every critical role."

### Value Propositions
1. "Smart algorithms pre-screen candidates, saving 80% of your time"
2. "Candidates complete skills checklists once, then share with unlimited facilities via secure links"
3. "Specialized compliance and credentialing for medical professionals"
4. "Real-time updates and crystal-clear communication"

---

## 7. Metadata & SEO

### Global Meta
```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#f97316">
```

### Page-Specific Titles
| Page | Title |
|------|-------|
| Home | Hire'in Solutions - AI-Powered Recruitment & Staffing Services |
| About | About Us - Hire'in Solutions |
| Healthcare | Healthcare Recruitment - Hire'in Solutions |
| IT | IT & Software Recruitment - Hire'in Solutions |
| Engineering | Engineering & Technical Staffing - Hire'in Solutions |
| Jobs | Career Opportunities - Hire'in Solutions |
| Contact | Contact Us - Hire'in Solutions |
| Terms | Terms of Service - Hire'in Solutions |
| Privacy | Privacy Policy - Hire'in Solutions |

### Meta Descriptions
**Home:** "Hire'in Solutions combines AI-powered matching with human expertise for Healthcare, IT, and Professional recruitment. 10+ years experience, 95% client retention."

**Healthcare:** "AI-powered healthcare recruitment with Joint Commission compliance. Find qualified RNs, physicians, allied health professionals. 50% faster placements."

---

## 8. Assets & Images

### Logo
- **Primary Logo**: `HS_logo_1756860177118.png` (45x45px display)
- **Format**: PNG with transparency
- **Usage**: Header and footer
- **Text Display**: "Hire'in" (primary color, bold) + "Solutions" (muted, smaller)

### Hero Images (Source from Unsplash or Similar)
1. Healthcare team in hospital - Modern, bright, collaborative
2. IT team in office - Diverse, laptops, monitors
3. Clinic staff with technology - Telehealth, outpatient
4. Engineers with AI tech - Futuristic, data visualization

### Industry Icons (Use Lucide React)
- Healthcare: Heart, Stethoscope, Shield, Activity
- IT: Code, Brain, Globe
- Engineering: Briefcase, Target
- General: Users, Clock, Award, CheckCircle, ArrowRight

### Compliance Badge Icons
- HIPAA: Shield (blue)
- Encryption: Lock (green)
- TJC: Award (purple)
- Verified: CheckCircle (amber)

---

## 9. Forms & CTAs

### CTA Configurations
```javascript
const CTA_CONFIGS = {
  "hero-start-hiring": {
    title: "Start Hiring Today",
    description: "Tell us about your hiring needs and we'll connect you with top talent.",
    subject: "Start Hiring - Employer Inquiry from Hero"
  },
  "hero-apply-now": {
    title: "Apply for Opportunities",
    description: "Share your background and we'll match you with the right opportunities.",
    subject: "Job Application - Apply Now from Hero"
  },
  "header-start-hiring": {
    title: "Start Hiring",
    description: "Let's discuss your talent acquisition needs.",
    subject: "Start Hiring - Employer Inquiry from Header"
  },
  "header-apply-now": {
    title: "Apply Now",
    description: "Submit your information to explore career opportunities.",
    subject: "Job Application - Apply Now from Header"
  },
  "about-partner": {
    title: "Partner With Us",
    description: "Discover how we can support your organization's hiring goals.",
    subject: "Partnership Inquiry from About Page"
  },
  "contact-general": {
    title: "General Inquiry",
    description: "Tell us about your needs and we'll get back to you within 24 hours.",
    subject: "General Inquiry from Contact Page"
  },
  "contact-careers": {
    title: "Career Opportunities",
    description: "Tell us about your background and career goals.",
    subject: "Career Inquiry from Contact Page"
  },
  "contact-employers": {
    title: "Hiring Solutions",
    description: "Let's discuss your staffing requirements.",
    subject: "Employer Inquiry from Contact Page"
  }
};
```

### Consultation Form Fields
```javascript
{
  firstName: { type: "text", required: true, label: "First Name" },
  lastName: { type: "text", required: true, label: "Last Name" },
  email: { type: "email", required: true, label: "Email Address" },
  phone: { type: "tel", required: true, label: "Phone Number" },
  company: { type: "text", required: false, label: "Company Name" },
  message: { type: "textarea", required: true, label: "How can we help?" }
}
```

### Job Application Form Fields
```javascript
{
  candidateName: { type: "text", required: true, label: "Full Name" },
  email: { type: "email", required: true, label: "Email" },
  phone: { type: "tel", required: true, label: "Phone" },
  coverLetter: { type: "textarea", required: false, label: "Cover Letter" },
  yearsExperience: { type: "number", required: false, label: "Years of Experience" },
  currentEmployer: { type: "text", required: false, label: "Current Employer" },
  linkedinUrl: { type: "url", required: false, label: "LinkedIn URL" }
}
```

---

## 10. Contact Information

### Physical Address
```
Hire'in Solutions
2621 Leigh Ave.
San Jose, CA-95124
United States
```

### Phone Numbers
| Department | Number |
|------------|--------|
| Main Line | +1 (415) 663-5944 |
| Healthcare Division | +1 (408) 892-9656 |
| IT & Software | +1 (408) 876-0779 |

### Email Addresses
| Purpose | Email |
|---------|-------|
| General & Employers | contact@hire-in.com |
| Job Seekers | careers@hire-in.com |

### Business Hours
```
Monday - Friday: 6:00 AM - 6:00 PM PST
Saturday: 8:00 AM - 2:00 PM PST
Sunday: Closed
```

### Social Media
- LinkedIn: https://www.linkedin.com/company/hirein-solutions

### Website
- Production: https://hire-in.com
- Alternative: https://www.hire-in.com

---

## 11. Replit Agent Prompt

Copy and paste this prompt into a new Replit project to build the Hire'in Solutions website:

---

### PROMPT START

```
Build a professional staffing agency website for "Hire'in Solutions" - an AI-powered recruitment company specializing in Healthcare, IT, and Professional Services staffing. The company was established in 2014.

## Tech Stack
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Shadcn/ui component library (Radix UI)
- Wouter for routing
- TanStack Query for data fetching
- Lucide React for icons
- Express.js backend (for contact forms and jobs API)

## Design System

### Colors (CSS Variables)
Primary brand color: Orange (hsl(15, 94%, 61%))
Background: Light grayish-blue (hsl(210, 40%, 98%))
Foreground: Dark blue-gray (hsl(215, 25%, 17%))
Cards: Pure white
Muted text: Gray (hsl(215, 13%, 65%))

### Typography
- Headings: Inter font (300-800 weights)
- Body: Open Sans font (300-700 weights)
- Import from Google Fonts

### Border Radius
8px default radius

## Pages to Build

1. **Home Page** (/)
   - Full-screen hero with image carousel (4 images, auto-rotate every 4 seconds)
   - Hero headline: "Your Success, Our Mission"
   - Hero subheadline: "AI-powered recruitment meets human expertise. Find exceptional talent 80% faster with guaranteed compliance."
   - Two CTAs: "Start Hiring Today" (primary) and "Apply for Opportunities" (outline)
   - About section with company intro
   - Services section with 3 cards: Healthcare (priority), IT, Non-IT & Engineering
   - Why Choose Us section with 4 feature cards + 3 metrics
   - How It Works section with 4 steps

2. **About Page** (/about)
   - Hero with headline "Revolutionizing Recruitment: Where AI Meets Human Intuition"
   - Company story section
   - Mission/Vision/Purpose box
   - Core Values (Innovation, Integrity, Human-First, Excellence)
   - Stats section with orange background

3. **Healthcare Recruitment** (/services/healthcare-recruitment)
   - Service-specific hero with badge
   - Value proposition cards
   - AI Tools section (4 items)
   - Human Touch section (4 items)
   - Success Stories (3 case studies)
   - Roles We Fill list

4. **IT & Software** (/services/it-software)
   - Similar structure to healthcare with IT-specific content

5. **Engineering & Technical** (/services/engineering-technical)
   - Similar structure with engineering content

6. **Professional Services** (/services/non-it-professional)
   - Similar structure with professional services content

7. **Contract Staffing** (/services/contract-staffing)
   - Contract/temp staffing specific content

8. **Jobs Board** (/jobs)
   - Search and filter functionality
   - Job cards with title, location, type, salary
   - Application modal form
   - Backend API for jobs listing

9. **Contact** (/contact)
   - Contact information (address, phones, emails, hours)
   - Three inquiry type cards opening modal forms
   - Address: 2621 Leigh Ave., San Jose, CA-95124
   - Main phone: +1 (415) 663-5944
   - Healthcare: +1 (408) 892-9656
   - IT: +1 (408) 876-0779
   - Emails: contact@hire-in.com, careers@hire-in.com

10. **Terms of Service** (/terms) - Legal page

11. **Privacy Policy** (/privacy) - Legal page

## Components

### Header
- Logo with "Hire'in" text and "Solutions" subtitle + "Est. 2014" badge
- Centered navigation: Home, About, Services (dropdown), Jobs, Contact
- Right-aligned CTAs: Start Hiring, Apply Now
- Sticky positioning
- Mobile hamburger menu

### Footer
- 3-column layout: Company info, Quick Links, Services links
- Compliance badges row: HIPAA-Ready, Smart Encryption, TJC-HCSS Aligned, Healthcare Verified
- Bottom bar: Copyright 2025, Privacy Policy, Terms of Service, Contact Us
- LinkedIn social link

### Consultation Modal
- Reusable modal for all CTAs
- Form fields: First Name, Last Name, Email, Phone, Company (optional), Message
- Dynamic title based on CTA source
- Form submission to backend

### Job Card & Application Modal
- Job details display
- Application form with name, email, phone, cover letter, experience

## Key Features
- Responsive design (mobile-first)
- Dark mode support
- Smooth scroll animations
- Image carousel with navigation
- Form validation
- Toast notifications for form submissions
- SEO-friendly meta tags

## Company Stats to Display
- 10+ Years in Business (Since 2014)
- 95% Client Retention Rate
- 90% AI Accuracy Rate
- 98% Client Satisfaction
- 50% Faster Placements
- 100% Healthcare Compliance

## Brand Voice
Professional yet approachable. Emphasize the combination of AI technology with human expertise. Focus on healthcare compliance and quality placements.

Build this as a complete, production-ready website with all pages, components, and functionality working.
```

### PROMPT END

---

## Document Version
- **Created**: February 2025
- **Version**: 1.0
- **Author**: CredentialRx Development Team

---

*This document contains all specifications needed to recreate the Hire'in Solutions website. Use the prompt in Section 11 with Replit Agent to generate the codebase.*
