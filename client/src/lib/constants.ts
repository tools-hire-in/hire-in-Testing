// Company Information
export const COMPANY = {
  name: "Hire'in Solutions",
  tagline: "Where AI Meets Human Intuition",
  legalName: "Rayomind Software Solutions LLC",
  established: "2014",
  brandLine: "A RAYOMIND COMPANY | EST. 2014",
  uei: "J36BQRPL2WN3",
  cage: "206Q6",
} as const;

// Contact Information
export const CONTACT = {
  address: {
    street: "2621 Leigh Ave.",
    city: "San Jose",
    state: "CA",
    zip: "95124",
    country: "United States",
    full: "2621 Leigh Ave., San Jose, CA-95124, United States",
  },
  addressIndia: {
    street: "Suite No-101, Pocket-6, Sector-2",
    city: "Rohini, New Delhi",
    zip: "110085",
    country: "India",
    full: "Suite No-101, Pocket-6, Sector-2, Rohini, New Delhi, 110085, India",
  },
  phones: {
    main: "+1 (415) 663-5944",
    healthcare: "+1 (408) 892-9656",
    it: "+1 (408) 876-0779",
  },
  emails: {
    general: "contact@hire-in.com",
    careers: "careers@hire-in.com",
  },
  hours: {
    weekdays: "Monday - Friday: 6:00 AM - 6:00 PM PST",
    saturday: "Saturday: 8:00 AM - 2:00 PM PST",
    sunday: "Sunday: Closed",
  },
  social: {
    linkedin: "https://www.linkedin.com/company/hirein-solutions",
  },
} as const;

// Success Metrics
export const METRICS = {
  yearsInBusiness: "10+",
  clientRetention: "95%",
  aiAccuracy: "90%",
  clientSatisfaction: "98%",
  fasterPlacements: "50%",
  healthcareCompliance: "100%",
} as const;

// Hero Carousel Slides with unique messages per industry
export const HERO_SLIDES = [
  {
    url: "https://images.unsplash.com/photo-1638202993928-7267aad84c31?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080",
    alt: "Healthcare professionals collaborating in modern hospital",
    headline: "Your Success, Our Mission",
    subheadline: "AI-powered recruitment meets human expertise. Find exceptional talent 80% faster with guaranteed compliance.",
  },
  {
    url: "https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080",
    alt: "Healthcare clinic staff with telehealth technology",
    headline: "Healthcare Staffing Excellence",
    subheadline: "Trusted by clinics and hospitals nationwide. 100% compliance-ready healthcare professionals with verified credentials.",
  },
  {
    url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080",
    alt: "IT development team working in modern tech office",
    headline: "Top IT Talent, Delivered Fast",
    subheadline: "From software engineers to cybersecurity experts, we connect you with pre-vetted tech professionals ready to make an impact.",
  },
  {
    url: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080",
    alt: "Engineers and professionals in collaborative workspace",
    headline: "Engineering & Professional Services",
    subheadline: "Finance, marketing, operations, and core engineering talent. The right professionals for every critical role in your organization.",
  },
] as const;

// Keep backward compatibility
export const HERO_IMAGES = HERO_SLIDES;

// Navigation Links
export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  {
    label: "Services",
    children: [
      { href: "/services/healthcare-recruitment", label: "Healthcare Recruitment" },
      { href: "/services/it-software", label: "IT & Software Development" },
      { href: "/services/engineering-technical", label: "Engineering & Technical" },
      { href: "/services/non-it-professional", label: "Professional Services" },
      { href: "/services/contract-staffing", label: "Contract Staffing" },
    ],
  },
  { href: "/jobs", label: "Jobs" },
  { href: "/contact", label: "Contact" },
] as const;

// Services Data
export const SERVICES = [
  {
    id: "healthcare",
    slug: "healthcare-recruitment",
    title: "Healthcare",
    icon: "Heart",
    priority: true,
    description: "End-to-end talent solutions for healthcare providers, hospitals, clinics, and telehealth companies. Expertise in clinical (doctors, nurses), operational, and allied health staffing.",
    items: ["Clinical Staff (Doctors, Nurses)", "Allied Health Professionals", "Healthcare Operations", "Telehealth Specialists"],
  },
  {
    id: "it",
    slug: "it-software",
    title: "IT & Software",
    icon: "Code",
    priority: false,
    description: "Full-spectrum IT hiring — software engineers, DevOps, cloud, data, cybersecurity. From startups to enterprises, we deliver modern technical talent.",
    items: ["Software Engineers", "DevOps & Cloud Engineers", "Data Scientists & Analysts", "Cybersecurity Specialists"],
  },
  {
    id: "engineering",
    slug: "engineering-technical",
    title: "Engineering & Technical",
    icon: "Briefcase",
    priority: false,
    description: "Skilled professionals in finance, marketing, operations, industrial, and core engineering streams.",
    items: ["Finance & Accounting", "Marketing & Operations", "Industrial Engineering", "Core Engineering Streams"],
  },
] as const;

// Why Choose Us Features
export const FEATURES = [
  {
    title: "AI-Powered Matching",
    description: "Smart algorithms pre-screen candidates, saving 80% of your time",
    icon: "Brain",
    badge: "Save 80% Time",
  },
  {
    title: "Fill Once, Share Forever",
    description: "Candidates complete skills checklists once, then share with unlimited facilities via secure links",
    icon: "Share2",
    badge: "Zero Redundancy",
  },
  {
    title: "Healthcare Priority",
    description: "Specialized compliance and credentialing for medical professionals",
    icon: "Shield",
    badge: "Compliance Ready",
  },
  {
    title: "End-to-End Transparency",
    description: "Real-time updates and crystal-clear communication",
    icon: "Eye",
    badge: "Full Transparency",
  },
] as const;

// How It Works Steps
export const STEPS = [
  {
    number: "01",
    title: "Submit Requirements",
    description: "Share your job requirements, company culture, and specific needs with our team",
    highlight: "Detailed consultation to understand your exact needs",
  },
  {
    number: "02",
    title: "AI Pre-screening",
    description: "Our advanced AI algorithms analyze and match candidates based on skills, experience, and qualifications",
    highlight: "Smart filtering saves 80% of screening time",
  },
  {
    number: "03",
    title: "Human Validation",
    description: "Our recruitment experts personally interview candidates for cultural fit and emotional intelligence",
    highlight: "Personal touch ensures perfect alignment",
  },
  {
    number: "04",
    title: "Perfect Match",
    description: "Receive pre-vetted, qualified candidates ready for final interviews and onboarding",
    highlight: "Guaranteed compliance and credential verification",
  },
] as const;

// Core Values
export const VALUES = [
  {
    title: "Innovation",
    description: "We continuously push the boundaries of what's possible in recruitment, leveraging AI and technology to create better outcomes for everyone.",
    icon: "Lightbulb",
  },
  {
    title: "Integrity",
    description: "Transparency, honesty, and ethical practices are at the core of every interaction. We build trust through consistent, reliable actions.",
    icon: "Shield",
  },
  {
    title: "Human-First Approach",
    description: "Technology enhances but never replaces human judgment, empathy, and understanding in making life-changing career connections.",
    icon: "Heart",
  },
  {
    title: "Industry Excellence",
    description: "We understand the critical nature of roles across all sectors and maintain the highest standards of compliance, screening, and placement quality.",
    icon: "Award",
  },
] as const;

// Compliance Badges
export const COMPLIANCE_BADGES = [
  {
    title: "HIPAA-Ready Architecture",
    icon: "Shield",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    textColor: "text-blue-800 dark:text-blue-200",
  },
  {
    title: "Smart Encryption",
    icon: "Lock",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-200 dark:border-green-800",
    textColor: "text-green-800 dark:text-green-200",
  },
  {
    title: "TJC-HCSS Aligned",
    icon: "Award",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderColor: "border-purple-200 dark:border-purple-800",
    textColor: "text-purple-800 dark:text-purple-200",
  },
  {
    title: "Healthcare Verified",
    icon: "CheckCircle",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    borderColor: "border-amber-200 dark:border-amber-800",
    textColor: "text-amber-800 dark:text-amber-200",
  },
] as const;

// CTA Configurations
export const CTA_CONFIGS = {
  "hero-start-hiring": {
    title: "Start Hiring Today",
    description: "Tell us about your hiring needs and we'll connect you with top talent.",
    subject: "Start Hiring - Employer Inquiry from Hero",
  },
  "hero-apply-now": {
    title: "Apply for Opportunities",
    description: "Share your background and we'll match you with the right opportunities.",
    subject: "Job Application - Apply Now from Hero",
  },
  "header-start-hiring": {
    title: "Start Hiring",
    description: "Let's discuss your talent acquisition needs.",
    subject: "Start Hiring - Employer Inquiry from Header",
  },
  "header-apply-now": {
    title: "Apply Now",
    description: "Submit your information to explore career opportunities.",
    subject: "Job Application - Apply Now from Header",
  },
  "contact-general": {
    title: "General Inquiry",
    description: "Tell us about your needs and we'll get back to you within 24 hours.",
    subject: "General Inquiry from Contact Page",
  },
  "contact-careers": {
    title: "Career Opportunities",
    description: "Tell us about your background and career goals.",
    subject: "Career Inquiry from Contact Page",
  },
  "contact-employers": {
    title: "Hiring Solutions",
    description: "Let's discuss your staffing requirements.",
    subject: "Employer Inquiry from Contact Page",
  },
} as const;

export type CTAType = keyof typeof CTA_CONFIGS;
