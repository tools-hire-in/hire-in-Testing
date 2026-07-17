import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { db } from "./db";
import { jobs, studioArticles } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getStaticSchemas, getJobPostingSchema, injectSchemas } from "./seo-schemas";

function isEmployeeSubdomain(hostname: string): boolean {
  return hostname.startsWith("employee.") || hostname.startsWith("www.employee.");
}

// All known exact public SPA routes
const KNOWN_PUBLIC_EXACT_ROUTES = new Set([
  "/",
  "/about",
  "/contracts",
  "/jobs",
  "/contact",
  "/terms",
  "/privacy",
  "/capability-deck",
  "/it-staffing",
  "/ehealthcare-staffing",
  "/why-hire-in-solutions",
  "/it-staffing-guide",
  "/healthcare-staffing-guide",
  "/staffing-faq",
  "/request-a-quote",
  "/verify",
  "/insights",
  "/services/healthcare-recruitment",
  "/services/it-software",
  "/services/engineering-technical",
  "/services/non-it-professional",
  "/services/contract-staffing",
]);

// Dynamic route patterns — arbitrary segment after a known prefix (token, id, etc.)
const DYNAMIC_ROUTE_PATTERNS: RegExp[] = [
  /^\/jobs\/[^/]+$/,            // /jobs/:id
  /^\/insights\/[^/]+$/,        // /insights/:slug
  /^\/onboard\/[^/]+$/,         // /onboard/:token
  /^\/addendum\/[^/]+$/,        // /addendum/:token
  /^\/contracts\/sign\/[^/]+$/, // /contracts/sign/:token
  /^\/admin(\/.*)?$/,           // /admin and all admin sub-routes (auth-gated; blocked by robots.txt)
];

function isKnownRoute(reqPath: string): boolean {
  const cleanPath = reqPath.split("?")[0].replace(/\/$/, "") || "/";
  if (KNOWN_PUBLIC_EXACT_ROUTES.has(cleanPath) || KNOWN_PUBLIC_EXACT_ROUTES.has(cleanPath + "/")) {
    return true;
  }
  for (const pattern of DYNAMIC_ROUTE_PATTERNS) {
    if (pattern.test(cleanPath)) return true;
  }
  return false;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface RouteMeta {
  title: string;
  description: string;
  canonical: string;
}

const BASE_URL = "https://hire-in.com";
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

const STATIC_ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "Hire'in Solutions | AI-Powered Recruitment & Staffing Agency",
    description:
      "Hire'in Solutions connects top employers with skilled candidates across Healthcare, IT, Engineering, and Professional Services. Start hiring or find your next role today.",
    canonical: `${BASE_URL}/`,
  },
  "/about": {
    title: "About Us | Hire'in Solutions",
    description:
      "Learn about Hire'in Solutions — our mission, values, and the team behind our AI-powered recruitment services for Healthcare, IT, Engineering, and Professional Services.",
    canonical: `${BASE_URL}/about`,
  },
  "/jobs": {
    title: "Browse Open Jobs | Hire'in Solutions",
    description:
      "Explore hundreds of open positions across Healthcare, IT, Engineering, and Professional Services. Apply today and take the next step in your career with Hire'in Solutions.",
    canonical: `${BASE_URL}/jobs`,
  },
  "/contact": {
    title: "Contact Us | Hire'in Solutions",
    description:
      "Get in touch with Hire'in Solutions. Whether you're looking to hire top talent or find your next opportunity, our team is ready to help.",
    canonical: `${BASE_URL}/contact`,
  },
  "/contracts": {
    title: "Contracts & Clients | Hire'in Solutions",
    description:
      "Explore Hire'in Solutions' contract vehicles and engagements — including the State of Texas DIR IT Staff Augmentation Contract (ITSAC) — and the commercial clients we proudly serve.",
    canonical: `${BASE_URL}/contracts`,
  },
  "/terms": {
    title: "Terms of Service | Hire'in Solutions",
    description:
      "Review the Terms of Service for Hire'in Solutions. Understand your rights and obligations when using our recruitment and staffing platform.",
    canonical: `${BASE_URL}/terms`,
  },
  "/privacy": {
    title: "Privacy Policy | Hire'in Solutions",
    description:
      "Read the Hire'in Solutions Privacy Policy to understand how we collect, use, and protect your personal information.",
    canonical: `${BASE_URL}/privacy`,
  },
  "/capability-deck": {
    title: "Capability Deck | Hire'in Solutions - AI-Powered Recruitment",
    description:
      "Hire'in Solutions general capability deck — AI-powered staffing across Healthcare, IT, Engineering & Professional Services. Backed by Rayomind (est. 2014). View our interactive deck and download PDF/PPT.",
    canonical: `${BASE_URL}/capability-deck`,
  },
  "/it-staffing": {
    title: "IT Staffing Solutions | Hire'in Solutions",
    description:
      "Expert IT staffing and technology talent solutions from Hire'in Solutions. We connect businesses with skilled software engineers, DevOps specialists, cybersecurity experts, and more.",
    canonical: `${BASE_URL}/it-staffing`,
  },
  "/ehealthcare-staffing": {
    title: "Healthcare Staffing Solutions | Hire'in Solutions",
    description:
      "Specialized healthcare staffing from Hire'in Solutions. Connecting healthcare organizations with qualified clinical and administrative professionals.",
    canonical: `${BASE_URL}/ehealthcare-staffing`,
  },
  "/why-hire-in-solutions": {
    title: "Why Choose Hire'in Solutions | AI-Powered Staffing Agency",
    description:
      "Discover why leading organizations choose Hire'in Solutions for their staffing needs. AI-powered matching, deep industry expertise, and a proven track record across Healthcare, IT, and Engineering.",
    canonical: `${BASE_URL}/why-hire-in-solutions`,
  },
  "/it-staffing-guide": {
    title: "IT Staffing Guide | Hire'in Solutions",
    description:
      "A comprehensive guide to IT staffing — learn how to hire top technology talent, navigate contract staffing, and build high-performing engineering teams.",
    canonical: `${BASE_URL}/it-staffing-guide`,
  },
  "/healthcare-staffing-guide": {
    title: "Healthcare Staffing Guide | Hire'in Solutions",
    description:
      "An essential guide to healthcare staffing — covering clinical roles, compliance, credentialing, and best practices for building your healthcare workforce.",
    canonical: `${BASE_URL}/healthcare-staffing-guide`,
  },
  "/staffing-faq": {
    title: "Staffing FAQ | Hire'in Solutions",
    description:
      "Answers to the most common questions about staffing, recruitment, and working with Hire'in Solutions. Everything employers and job seekers need to know.",
    canonical: `${BASE_URL}/staffing-faq`,
  },
  "/request-a-quote": {
    title: "Request a Quote | Hire'in Solutions",
    description:
      "Get a tailored staffing quote from Hire'in Solutions. Tell us about your hiring needs and we'll connect you with the right talent fast.",
    canonical: `${BASE_URL}/request-a-quote`,
  },
  "/verify": {
    title: "Verify Document | Hire'in Solutions",
    description:
      "Verify the authenticity of an HR letter or document issued by Hire'in Solutions using its reference number and authentication code.",
    canonical: `${BASE_URL}/verify`,
  },
  "/services/healthcare-recruitment": {
    title: "Healthcare Recruitment Services | Hire'in Solutions",
    description:
      "Professional healthcare recruitment services from Hire'in Solutions. We place nurses, physicians, therapists, and clinical staff with leading healthcare organizations.",
    canonical: `${BASE_URL}/services/healthcare-recruitment`,
  },
  "/services/it-software": {
    title: "IT & Software Staffing Services | Hire'in Solutions",
    description:
      "Top-tier IT and software staffing services from Hire'in Solutions. We recruit developers, architects, data scientists, and technology leaders for organizations of all sizes.",
    canonical: `${BASE_URL}/services/it-software`,
  },
  "/services/engineering-technical": {
    title: "Engineering & Technical Staffing | Hire'in Solutions",
    description:
      "Engineering and technical staffing solutions from Hire'in Solutions. We place mechanical, electrical, civil, and industrial engineers across industries.",
    canonical: `${BASE_URL}/services/engineering-technical`,
  },
  "/services/non-it-professional": {
    title: "Professional Services Staffing | Hire'in Solutions",
    description:
      "Professional services staffing from Hire'in Solutions. We recruit finance, HR, legal, marketing, and operations professionals for leading organizations.",
    canonical: `${BASE_URL}/services/non-it-professional`,
  },
  "/services/contract-staffing": {
    title: "Contract Staffing Services | Hire'in Solutions",
    description:
      "Flexible contract staffing services from Hire'in Solutions. Scale your workforce with skilled contractors across IT, Healthcare, Engineering, and Professional Services.",
    canonical: `${BASE_URL}/services/contract-staffing`,
  },
};

const STATIC_ROUTE_BODY: Record<string, string> = {
  "/": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/about">About</a><a href="/jobs">Jobs</a><a href="/contact">Contact</a><a href="/services/healthcare-recruitment">Healthcare Recruitment</a><a href="/services/it-software">IT &amp; Software</a><a href="/services/engineering-technical">Engineering</a><a href="/services/non-it-professional">Professional Services</a><a href="/services/contract-staffing">Contract Staffing</a></nav></header><main><h1>Hire&#39;in Solutions | AI-Powered Recruitment &amp; Staffing Agency</h1><p>Hire&#39;in Solutions connects top employers with skilled candidates across Healthcare, IT, Engineering, and Professional Services. Start hiring or find your next role today.</p><section><h2>AI-Powered Staffing — Built for Speed and Compliance</h2><p>We leverage artificial intelligence to match exceptional talent with leading organizations 80% faster with guaranteed compliance. Our team specializes in Healthcare, Information Technology, Engineering, and Professional Services across the United States.</p></section><section><h2>Our Staffing Specializations</h2><ul><li><a href="/services/healthcare-recruitment">Healthcare Recruitment</a> — Nurses, physicians, therapists, and clinical staff</li><li><a href="/services/it-software">IT &amp; Software Staffing</a> — Developers, architects, DevOps engineers, and data scientists</li><li><a href="/services/engineering-technical">Engineering &amp; Technical</a> — Mechanical, electrical, civil, and industrial engineers</li><li><a href="/services/non-it-professional">Professional Services</a> — Finance, HR, legal, marketing, and operations professionals</li><li><a href="/services/contract-staffing">Contract Staffing</a> — Flexible workforce solutions including staff augmentation</li></ul></section><section><h2>Government &amp; Commercial Contracts</h2><p>Hire&#39;in Solutions holds the State of Texas DIR IT Staff Augmentation Contract (ITSAC), enabling us to serve state agencies directly. <a href="/contracts">View our contract vehicles</a>.</p></section><p><a href="/jobs">Browse open positions</a> | <a href="/contact">Contact us</a> | <a href="/request-a-quote">Request a quote</a></p></main>`,

  "/about": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/about">About</a><a href="/jobs">Jobs</a><a href="/contact">Contact</a></nav></header><main><h1>About Hire&#39;in Solutions</h1><p>Hire&#39;in Solutions is an AI-powered staffing agency backed by Rayomind, established in 2014. We specialize in connecting top employers with skilled talent across Healthcare, IT, Engineering, and Professional Services throughout the United States.</p><section><h2>Our Mission</h2><p>To transform the way organizations find and retain exceptional talent by combining artificial intelligence with human expertise — delivering faster placements, better matches, and outstanding client satisfaction.</p></section><section><h2>Our Values</h2><ul><li><strong>Integrity</strong> — We operate with transparency and honesty in every interaction.</li><li><strong>Innovation</strong> — We continuously improve our AI-powered matching platform.</li><li><strong>Excellence</strong> — We are committed to delivering quality talent that drives real results.</li><li><strong>Partnership</strong> — We build long-term relationships with both clients and candidates.</li></ul></section><section><h2>Industries We Serve</h2><ul><li>Healthcare — Clinical and non-clinical staffing for hospitals and healthcare systems</li><li>Information Technology — Software engineering, DevOps, cybersecurity, and data science</li><li>Engineering &amp; Technical — Mechanical, electrical, civil, and industrial engineering</li><li>Professional Services — Finance, HR, legal, marketing, and administrative roles</li></ul></section><p><a href="/contact">Get in touch with our team</a> | <a href="/jobs">View open positions</a></p></main>`,

  "/jobs": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/jobs">Browse Jobs</a><a href="/contact">Contact</a></nav></header><main><h1>Browse Open Jobs | Hire&#39;in Solutions</h1><p>Explore hundreds of open positions across Healthcare, IT, Engineering, and Professional Services. Apply today and take the next step in your career with Hire&#39;in Solutions.</p><section><h2>Find Your Next Opportunity</h2><p>Hire&#39;in Solutions lists active positions from top employers across the United States. Whether you are a healthcare professional, software engineer, skilled engineer, or business specialist, we have roles that match your expertise.</p></section><section><h2>Job Categories</h2><ul><li>Healthcare &amp; Clinical — Registered Nurses, Physicians, Allied Health, Medical Technologists</li><li>Information Technology — Software Engineers, Cloud Architects, DevOps, Data Scientists</li><li>Engineering &amp; Technical — Mechanical, Electrical, Civil, Environmental Engineers</li><li>Professional Services — Finance Analysts, HR Business Partners, Legal Professionals</li><li>Contract &amp; Staff Augmentation — Short and long-term contract placements</li></ul></section><p><a href="/contact">Contact a recruiter</a> | <a href="/request-a-quote">Hire talent</a></p></main>`,

  "/contact": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/about">About</a><a href="/jobs">Jobs</a><a href="/contact">Contact</a></nav></header><main><h1>Contact Hire&#39;in Solutions</h1><p>Get in touch with Hire&#39;in Solutions. Whether you are looking to hire top talent or find your next opportunity, our team is ready to help.</p><section><h2>Reach Our Team</h2><p>We serve employers and job seekers across the United States, with deep expertise in Healthcare, IT, Engineering, and Professional Services staffing.</p></section><section><h2>Contact Information</h2><ul><li>Email: <a href="mailto:info@hire-in.com">info@hire-in.com</a></li><li>Website: <a href="https://hire-in.com">hire-in.com</a></li></ul></section><section><h2>Services</h2><ul><li><a href="/services/healthcare-recruitment">Healthcare Recruitment</a></li><li><a href="/services/it-software">IT &amp; Software Staffing</a></li><li><a href="/services/engineering-technical">Engineering Staffing</a></li><li><a href="/services/non-it-professional">Professional Services Staffing</a></li><li><a href="/services/contract-staffing">Contract Staffing</a></li></ul></section></main>`,

  "/contracts": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/contracts">Contracts</a><a href="/contact">Contact</a></nav></header><main><h1>Contracts &amp; Clients | Hire&#39;in Solutions</h1><p>Hire&#39;in Solutions holds established government and commercial contract vehicles, enabling us to serve public sector agencies and enterprise clients efficiently.</p><section><h2>Government Contracts</h2><ul><li><strong>State of Texas DIR IT Staff Augmentation Contract (ITSAC)</strong> — Hire&#39;in Solutions is an active vendor under the Texas Department of Information Resources IT Staff Augmentation Contract, allowing state agencies to engage our services directly without separate procurement.</li></ul></section><section><h2>Commercial Clients</h2><p>We serve a wide range of commercial clients across Healthcare, Technology, Engineering, and Professional Services industries throughout the United States.</p></section><p><a href="/contact">Contact us to learn more</a> | <a href="/request-a-quote">Request a staffing quote</a></p></main>`,

  "/terms": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></nav></header><main><h1>Terms of Service | Hire&#39;in Solutions</h1><p>These Terms of Service govern your use of the Hire&#39;in Solutions platform and services. By accessing or using our services, you agree to these terms.</p><section><h2>Use of Services</h2><p>Hire&#39;in Solutions provides AI-powered recruitment and staffing services. Our platform connects employers with qualified candidates across Healthcare, IT, Engineering, and Professional Services.</p></section><section><h2>User Responsibilities</h2><p>Users are responsible for providing accurate information, maintaining the confidentiality of their account credentials, and complying with all applicable laws and regulations.</p></section><p><a href="/privacy">Privacy Policy</a> | <a href="/contact">Contact us</a></p></main>`,

  "/privacy": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></nav></header><main><h1>Privacy Policy | Hire&#39;in Solutions</h1><p>Hire&#39;in Solutions is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data.</p><section><h2>Information We Collect</h2><p>We collect information you provide directly (such as name, email, and resume data) as well as usage data to improve our platform and services.</p></section><section><h2>How We Use Your Information</h2><p>We use your information to match candidates with job opportunities, communicate about relevant positions, and improve our AI-powered matching capabilities.</p></section><section><h2>Data Protection</h2><p>We implement industry-standard security measures to protect your personal information. We do not sell your data to third parties.</p></section><p><a href="/terms">Terms of Service</a> | <a href="/contact">Contact us</a></p></main>`,

  "/capability-deck": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/capability-deck">Capability Deck</a><a href="/contact">Contact</a></nav></header><main><h1>Capability Deck | Hire&#39;in Solutions</h1><p>Hire&#39;in Solutions is an AI-powered staffing agency backed by Rayomind (est. 2014). Our capability deck presents our full range of staffing services, industry expertise, and proven track record.</p><section><h2>Our Capabilities</h2><ul><li>AI-powered candidate matching and screening</li><li>Healthcare staffing — clinical and non-clinical roles</li><li>IT and software engineering talent acquisition</li><li>Engineering and technical professional placement</li><li>Professional services and executive search</li><li>Contract, temp-to-hire, and direct placement models</li><li>State of Texas DIR ITSAC government contracting</li></ul></section><section><h2>Why Hire&#39;in Solutions</h2><p>With over a decade of experience through Rayomind, we combine AI-driven efficiency with human expertise to deliver faster, better-matched placements that stick.</p></section><p><a href="/contact">Request a consultation</a> | <a href="/request-a-quote">Get a quote</a></p></main>`,

  "/it-staffing": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/it-staffing">IT Staffing</a><a href="/jobs">Jobs</a><a href="/contact">Contact</a></nav></header><main><h1>IT Staffing Solutions | Hire&#39;in Solutions</h1><p>Hire&#39;in Solutions provides expert IT staffing and technology talent solutions, connecting businesses with skilled software engineers, DevOps specialists, cybersecurity experts, cloud architects, and data scientists.</p><section><h2>IT Roles We Fill</h2><ul><li>Software Engineers and Full-Stack Developers</li><li>Cloud Architects and DevOps Engineers</li><li>Cybersecurity Analysts and Engineers</li><li>Data Scientists and Machine Learning Engineers</li><li>QA Engineers and Test Automation Specialists</li><li>IT Project Managers and Scrum Masters</li><li>Network and Systems Administrators</li></ul></section><section><h2>Engagement Models</h2><ul><li>Contract / Staff Augmentation</li><li>Contract-to-Hire</li><li>Direct Placement</li><li>State of Texas DIR ITSAC (government agencies)</li></ul></section><p><a href="/jobs">Browse IT jobs</a> | <a href="/contact">Contact our IT staffing team</a></p></main>`,

  "/ehealthcare-staffing": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/ehealthcare-staffing">Healthcare Staffing</a><a href="/jobs">Jobs</a><a href="/contact">Contact</a></nav></header><main><h1>Healthcare Staffing Solutions | Hire&#39;in Solutions</h1><p>Hire&#39;in Solutions specializes in healthcare staffing, connecting healthcare organizations with qualified clinical and administrative professionals who meet stringent credentialing and compliance requirements.</p><section><h2>Healthcare Roles We Fill</h2><ul><li>Registered Nurses (RN) — ICU, ER, Med/Surg, NICU, OR</li><li>Physicians and Advanced Practice Providers</li><li>Allied Health Professionals — PT, OT, SLP, Radiology</li><li>Medical Technologists and Lab Professionals</li><li>Healthcare IT and EHR Specialists</li><li>Healthcare Administrators and Revenue Cycle</li></ul></section><p><a href="/jobs">Browse healthcare jobs</a> | <a href="/contact">Contact our healthcare staffing team</a></p></main>`,

  "/why-hire-in-solutions": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/why-hire-in-solutions">Why Hire&#39;in</a><a href="/jobs">Jobs</a><a href="/contact">Contact</a></nav></header><main><h1>Why Choose Hire&#39;in Solutions</h1><p>Hire&#39;in Solutions combines AI-powered matching technology with deep industry expertise to deliver faster, more accurate talent placements across Healthcare, IT, Engineering, and Professional Services.</p><section><h2>What Sets Us Apart</h2><ul><li><strong>AI-Powered Matching</strong> — Our platform identifies the best-fit candidates 80% faster than traditional methods.</li><li><strong>Deep Industry Expertise</strong> — Our recruiters specialize in Healthcare, IT, Engineering, and Professional Services.</li><li><strong>Compliance-First</strong> — We ensure every placement meets regulatory and credentialing requirements.</li><li><strong>Flexible Engagement Models</strong> — Contract, contract-to-hire, direct placement, and staff augmentation.</li><li><strong>Government Contract Vehicle</strong> — State of Texas DIR ITSAC holder for public sector clients.</li><li><strong>Proven Track Record</strong> — Backed by Rayomind with over a decade of industry experience.</li></ul></section><p><a href="/contact">Talk to our team</a> | <a href="/request-a-quote">Request a quote</a></p></main>`,

  "/it-staffing-guide": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/it-staffing-guide">IT Staffing Guide</a><a href="/jobs">Jobs</a></nav></header><main><h1>IT Staffing Guide | Hire&#39;in Solutions</h1><p>A comprehensive guide to IT staffing — learn how to hire top technology talent, navigate contract and direct-hire staffing models, and build high-performing engineering teams.</p><section><h2>Understanding IT Staffing Models</h2><ul><li><strong>Contract / Staff Augmentation</strong> — Engage skilled IT professionals on a project or time-limited basis.</li><li><strong>Contract-to-Hire</strong> — Evaluate contractors before committing to a permanent hire.</li><li><strong>Direct Placement</strong> — Hire IT professionals directly for permanent roles.</li></ul></section><section><h2>Key IT Roles in Demand</h2><ul><li>Software Engineers (Frontend, Backend, Full-Stack)</li><li>Cloud and Infrastructure Engineers</li><li>DevOps and Site Reliability Engineers</li><li>Cybersecurity Specialists</li><li>Data Engineers and Machine Learning Engineers</li></ul></section><p><a href="/it-staffing">IT Staffing Solutions</a> | <a href="/contact">Contact our IT recruiters</a></p></main>`,

  "/healthcare-staffing-guide": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/healthcare-staffing-guide">Healthcare Staffing Guide</a><a href="/jobs">Jobs</a></nav></header><main><h1>Healthcare Staffing Guide | Hire&#39;in Solutions</h1><p>An essential guide to healthcare staffing — covering clinical roles, compliance requirements, credentialing processes, and best practices for building your healthcare workforce.</p><section><h2>Healthcare Staffing Essentials</h2><ul><li><strong>Compliance &amp; Credentialing</strong> — Ensuring all clinicians meet state licensure and JCAHO standards.</li><li><strong>Travel vs. Local Staffing</strong> — Choosing the right staffing model for your facility.</li><li><strong>Permanent vs. Per Diem</strong> — Balancing your core workforce with flexible contingent staff.</li></ul></section><section><h2>Clinical Specialties We Staff</h2><ul><li>Critical Care — ICU, CCU, CVICU</li><li>Emergency Department</li><li>Labor &amp; Delivery / Mother-Baby</li><li>Operating Room and Perioperative</li><li>Medical / Surgical</li><li>Pediatrics and NICU</li><li>Allied Health and Rehabilitation</li></ul></section><p><a href="/ehealthcare-staffing">Healthcare Staffing Solutions</a> | <a href="/contact">Contact our healthcare recruiters</a></p></main>`,

  "/staffing-faq": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/staffing-faq">FAQ</a><a href="/jobs">Jobs</a><a href="/contact">Contact</a></nav></header><main><h1>Staffing FAQ | Hire&#39;in Solutions</h1><p>Answers to the most common questions about staffing, recruitment, and working with Hire&#39;in Solutions.</p><section><h2>For Employers</h2><ul><li><strong>How quickly can you fill a position?</strong> — Our AI-powered matching typically identifies qualified candidates within 24–72 hours for most roles.</li><li><strong>What industries do you specialize in?</strong> — Healthcare, IT &amp; Software, Engineering, and Professional Services.</li><li><strong>Do you handle compliance and credentialing?</strong> — Yes. We verify all licenses, certifications, and background checks before placement.</li><li><strong>What contract vehicles do you hold?</strong> — We are an active vendor under the State of Texas DIR IT Staff Augmentation Contract (ITSAC).</li></ul></section><section><h2>For Job Seekers</h2><ul><li><strong>Is it free to work with Hire&#39;in Solutions?</strong> — Yes. Our services are completely free for job seekers.</li><li><strong>What types of positions do you place?</strong> — Contract, contract-to-hire, and direct placement roles across Healthcare, IT, Engineering, and Professional Services.</li><li><strong>How do I apply?</strong> — Browse our <a href="/jobs">job listings</a> and submit your application online.</li></ul></section><p><a href="/contact">Contact us</a> | <a href="/request-a-quote">Hire talent</a></p></main>`,

  "/request-a-quote": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/request-a-quote">Request a Quote</a><a href="/contact">Contact</a></nav></header><main><h1>Request a Staffing Quote | Hire&#39;in Solutions</h1><p>Get a tailored staffing quote from Hire&#39;in Solutions. Tell us about your hiring needs and we will connect you with the right talent fast.</p><section><h2>How It Works</h2><ol><li>Share your staffing requirements — industry, role, skills, location, and timeline.</li><li>Our team reviews your needs and matches them to our talent network.</li><li>We provide a competitive quote and introduce qualified candidates.</li></ol></section><section><h2>Industries We Serve</h2><ul><li>Healthcare — Clinical and non-clinical roles</li><li>IT &amp; Software — Development, infrastructure, security</li><li>Engineering — Mechanical, electrical, civil, and more</li><li>Professional Services — Finance, HR, legal, administrative</li></ul></section><p><a href="/contact">Contact our team directly</a></p></main>`,

  "/verify": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/verify">Verify Document</a></nav></header><main><h1>Document Verification | Hire&#39;in Solutions</h1><p>Use this page to verify the authenticity of an HR letter or official document issued by Hire&#39;in Solutions. Enter the reference number and authentication code from your document.</p><section><h2>How to Verify</h2><ol><li>Locate the reference number and authentication code printed on your document.</li><li>Enter both values in the verification form.</li><li>Our system will confirm whether the document is authentic and display its key details.</li></ol></section><p>If you have questions about a document, <a href="/contact">contact Hire&#39;in Solutions</a>.</p></main>`,

  "/services/healthcare-recruitment": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/services/healthcare-recruitment">Healthcare Recruitment</a><a href="/jobs">Jobs</a></nav></header><main><h1>Healthcare Recruitment Services | Hire&#39;in Solutions</h1><p>Hire&#39;in Solutions places qualified healthcare professionals — nurses, physicians, allied health staff — quickly and compliantly. Partner with us for your clinical staffing needs.</p><section><h2>Healthcare Roles We Fill</h2><ul><li>Registered Nurses — All specialties including ICU, ER, OR, NICU, L&amp;D</li><li>Physicians and Advanced Practice Providers (NP, PA)</li><li>Allied Health — Physical Therapists, Occupational Therapists, Speech-Language Pathologists</li><li>Medical Technologists and Lab Professionals</li><li>Healthcare Administrators and Revenue Cycle Specialists</li><li>Healthcare IT and EHR Implementation Specialists</li></ul></section><p><a href="/contact">Contact our healthcare recruiting team</a> | <a href="/jobs">Browse healthcare jobs</a></p></main>`,

  "/services/it-software": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/services/it-software">IT &amp; Software</a><a href="/jobs">Jobs</a></nav></header><main><h1>IT &amp; Software Staffing Services | Hire&#39;in Solutions</h1><p>Top-tier IT and software staffing from Hire&#39;in Solutions. We recruit developers, architects, data scientists, and technology leaders for organizations of all sizes.</p><section><h2>IT Roles We Place</h2><ul><li>Software Engineers — Frontend, Backend, Full-Stack, Mobile</li><li>Cloud Architects — AWS, Azure, GCP</li><li>DevOps and Site Reliability Engineers</li><li>Data Scientists and ML Engineers</li><li>Cybersecurity Analysts and Engineers</li><li>QA and Test Automation Engineers</li><li>IT Project Managers and Product Owners</li></ul></section><p><a href="/contact">Contact our IT recruiting team</a> | <a href="/jobs">Browse IT jobs</a></p></main>`,

  "/services/engineering-technical": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/services/engineering-technical">Engineering</a><a href="/jobs">Jobs</a></nav></header><main><h1>Engineering &amp; Technical Staffing | Hire&#39;in Solutions</h1><p>Engineering and technical staffing solutions from Hire&#39;in Solutions. We place mechanical, electrical, civil, and industrial engineers across industries nationwide.</p><section><h2>Engineering Disciplines We Staff</h2><ul><li>Mechanical Engineers — Product design, manufacturing, HVAC</li><li>Electrical Engineers — Power systems, controls, embedded systems</li><li>Civil and Structural Engineers — Infrastructure, construction, geotechnical</li><li>Industrial and Manufacturing Engineers — Process improvement, quality, production</li><li>Environmental Engineers — Compliance, remediation, sustainability</li><li>Chemical Engineers — Process engineering, materials, refining</li></ul></section><p><a href="/contact">Contact our engineering recruiting team</a> | <a href="/jobs">Browse engineering jobs</a></p></main>`,

  "/services/non-it-professional": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/services/non-it-professional">Professional Services</a><a href="/jobs">Jobs</a></nav></header><main><h1>Professional Services Staffing | Hire&#39;in Solutions</h1><p>Professional services staffing from Hire&#39;in Solutions. We recruit finance, HR, legal, marketing, and operations professionals for leading organizations.</p><section><h2>Professional Roles We Fill</h2><ul><li>Finance and Accounting — CPAs, Financial Analysts, Controllers, CFOs</li><li>Human Resources — HR Business Partners, Recruiters, Total Rewards Specialists</li><li>Legal — In-house Counsel, Paralegals, Compliance Officers</li><li>Marketing and Communications — Digital Marketers, Content Strategists, Brand Managers</li><li>Operations and Supply Chain — Project Managers, Supply Chain Analysts, Logistics Coordinators</li><li>Administrative — Executive Assistants, Office Managers, Business Analysts</li></ul></section><p><a href="/contact">Contact our recruiting team</a> | <a href="/jobs">Browse professional jobs</a></p></main>`,

  "/services/contract-staffing": `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/services/contract-staffing">Contract Staffing</a><a href="/jobs">Jobs</a></nav></header><main><h1>Contract Staffing Services | Hire&#39;in Solutions</h1><p>Flexible contract staffing services from Hire&#39;in Solutions. Scale your workforce with skilled contractors across IT, Healthcare, Engineering, and Professional Services.</p><section><h2>Contract Staffing Models</h2><ul><li><strong>Staff Augmentation</strong> — Supplement your team with specialized contractors for projects or peak periods.</li><li><strong>Contract-to-Hire</strong> — Evaluate contractors on the job before converting to permanent employees.</li><li><strong>Project-Based Staffing</strong> — Assemble a complete project team with defined deliverables and timelines.</li><li><strong>Government Contracting</strong> — State of Texas DIR ITSAC for public sector IT staff augmentation.</li></ul></section><p><a href="/contact">Contact our staffing team</a> | <a href="/request-a-quote">Request a quote</a></p></main>`,
};

function getRouteMeta(urlPath: string): RouteMeta | null {
  if (STATIC_ROUTE_META[urlPath]) {
    return STATIC_ROUTE_META[urlPath];
  }
  if (/^\/jobs\/[^/]+$/.test(urlPath)) {
    const jobId = urlPath.replace("/jobs/", "");
    return {
      title: "Job Details | Hire'in Solutions",
      description:
        "View job details and apply through Hire'in Solutions. Browse open positions across Healthcare, IT, Engineering, and Professional Services.",
      canonical: `${BASE_URL}/jobs/${jobId}`,
    };
  }
  if (/^\/insights\/[^/]+$/.test(urlPath)) {
    const slug = urlPath.replace("/insights/", "");
    return {
      title: "Hire'in Insights | Hire'in Solutions",
      description:
        "Expert staffing insights, hiring tips, and workforce trends from Hire'in Solutions — covering Healthcare, IT, Engineering, and Professional Services.",
      canonical: `${BASE_URL}/insights/${slug}`,
    };
  }
  return null;
}

async function getJobDynamicMeta(jobId: string): Promise<RouteMeta | null> {
  try {
    const [job] = await db
      .select({ title: jobs.title, description: jobs.description, city: jobs.city, state: jobs.state })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    if (!job) return null;
    const location = [job.city, job.state].filter(Boolean).join(", ");
    const rawDesc = job.description ? job.description.replace(/<[^>]+>/g, "").trim() : "";
    const excerpt = rawDesc.slice(0, 160) + (rawDesc.length > 160 ? "…" : "");
    return {
      title: `${job.title}${location ? ` — ${location}` : ""} | Hire'in Solutions`,
      description: excerpt || `Apply for ${job.title} at Hire'in Solutions. Browse open positions across Healthcare, IT, Engineering, and Professional Services.`,
      canonical: `${BASE_URL}/jobs/${jobId}`,
    };
  } catch {
    return null;
  }
}

async function getInsightDynamicMeta(slug: string): Promise<RouteMeta | null> {
  try {
    const [article] = await db
      .select({
        title: studioArticles.title,
        seoTitle: studioArticles.seoTitle,
        seoDescription: studioArticles.seoDescription,
        excerpt: studioArticles.excerpt,
      })
      .from(studioArticles)
      .where(and(eq(studioArticles.slug, slug), eq(studioArticles.status, "published")))
      .limit(1);
    if (!article) return null;
    const title = article.seoTitle || `${article.title} | Hire'in Solutions`;
    const description = article.seoDescription || article.excerpt || `Read ${article.title} on Hire'in Insights — expert staffing advice from Hire'in Solutions.`;
    return {
      title,
      description: description.slice(0, 200),
      canonical: `${BASE_URL}/insights/${slug}`,
    };
  } catch {
    return null;
  }
}

function injectRouteMeta(html: string, meta: RouteMeta): string {
  const t = esc(meta.title);
  const d = esc(meta.description);
  const c = esc(meta.canonical);
  const img = esc(DEFAULT_OG_IMAGE);

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/,         `$1${d}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/,        `$1${t}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${d}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/,          `$1${c}$2`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/,               `$1${c}$2`);
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/,       `$1${t}$2`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/,  `$1${d}$2`);
  html = html.replace(/(<meta name="twitter:image" content=")[^"]*(")/,       `$1${img}$2`);

  if (!html.includes('name="twitter:card"')) {
    const extraTags =
      `<meta name="twitter:card" content="summary_large_image" />` +
      `<meta name="twitter:title" content="${t}" />` +
      `<meta name="twitter:description" content="${d}" />` +
      `<meta name="twitter:image" content="${img}" />`;
    html = html.replace("<head>", `<head>${extraTags}`);
  }

  return html;
}

async function getJobStaticBody(jobId: string): Promise<string | null> {
  try {
    const [job] = await db
      .select({
        title: jobs.title,
        description: jobs.description,
        city: jobs.city,
        state: jobs.state,
        jobType: jobs.jobType,
        company: jobs.facility,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!job) return null;

    const location = [job.city, job.state].filter(Boolean).join(", ") || "United States";
    const companyDisplay = job.company ? esc(job.company) : "Hire&#39;in Solutions";
    const shortDesc = job.description
      ? esc(job.description.replace(/<[^>]+>/g, "").slice(0, 300)) +
        (job.description.length > 300 ? "…" : "")
      : "";

    return (
      `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/jobs">Browse Jobs</a><a href="/contact">Contact</a></nav></header>` +
      `<main><h1>${esc(job.title)} | ${companyDisplay}</h1>` +
      `<p><strong>Location:</strong> ${esc(location)}${job.jobType ? ` &mdash; <strong>Type:</strong> ${esc(job.jobType)}` : ""}</p>` +
      (shortDesc ? `<section><h2>About This Role</h2><p>${shortDesc}</p></section>` : "") +
      `<p><a href="/jobs">Browse all open positions</a> | <a href="/contact">Contact a recruiter</a></p></main>`
    );
  } catch {
    return null;
  }
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { index: false }));

  app.use("/{*path}", (req, res, next) => {
    // Guard: never serve index.html for static asset paths.
    // When express.static can't find a fingerprinted chunk (e.g. after a
    // redeployment renames Vite's output files), it calls next() and the
    // catch-all would otherwise return 200 + text/html.  The browser then
    // tries to parse HTML as a JS module, logs a MIME-type error, and the
    // React app never boots.  Returning a clean 404 here lets the browser
    // (and any error-boundary logic) handle the missing asset correctly.
    // Cache-Control: no-store on index.html (below) ensures fresh shells
    // after every redeploy, so stale cached HTML is only a transient issue —
    // but the 404 guard eliminates the blank-screen symptom entirely.
    const STATIC_ASSET_RE = /\.(?:js|mjs|cjs|css|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|map|json)$/i;
    if (STATIC_ASSET_RE.test(req.path)) {
      return res.status(404).end();
    }

    (async () => {
      const hostname =
        (req.headers["x-forwarded-host"] as string)?.split(":")[0] ||
        req.hostname ||
        req.headers.host?.split(":")[0] ||
        "";
      const isEmployee = isEmployeeSubdomain(hostname);
      const known = isEmployee || isKnownRoute(req.path);

      const indexPath = path.resolve(distPath, "index.html");
      let html = fs.readFileSync(indexPath, "utf-8");

      html = html.replace(
        "<head>",
        `<head><script>window.__IS_EMPLOYEE_SUBDOMAIN__=${isEmployee};</script>`,
      );

      if (!isEmployee) {
        const urlPath = req.path || "/";
        let meta = getRouteMeta(urlPath);
        // For job and insight pages, enrich meta with actual DB data
        if (/^\/jobs\/[^/]+$/.test(urlPath)) {
          const jobId = urlPath.replace("/jobs/", "");
          meta = (await getJobDynamicMeta(jobId)) ?? meta;
        } else if (/^\/insights\/[^/]+$/.test(urlPath)) {
          const slug = urlPath.replace("/insights/", "");
          meta = (await getInsightDynamicMeta(slug)) ?? meta;
        }
        if (meta) {
          html = injectRouteMeta(html, meta);
        }

        // Inject route-specific JSON-LD schemas into the initial HTML response
        const staticSchemas = getStaticSchemas(urlPath);
        if (staticSchemas.length) {
          html = injectSchemas(html, staticSchemas);
        } else if (/^\/jobs\/[^/]+$/.test(urlPath)) {
          const jobId = urlPath.replace("/jobs/", "");
          const jobSchema = await getJobPostingSchema(jobId);
          if (jobSchema) html = injectSchemas(html, [jobSchema]);
        }

        let staticBody: string | null = null;
        if (STATIC_ROUTE_BODY[urlPath]) {
          staticBody = STATIC_ROUTE_BODY[urlPath];
        } else if (/^\/jobs\/[^/]+$/.test(urlPath)) {
          const jobId = urlPath.replace("/jobs/", "");
          staticBody = await getJobStaticBody(jobId);
          if (!staticBody) {
            staticBody =
              `<header><nav><a href="/">Hire&#39;in Solutions</a><a href="/jobs">Browse Jobs</a></nav></header>` +
              `<main><h1>Job Details | Hire&#39;in Solutions</h1>` +
              `<p>View job details and apply online through Hire&#39;in Solutions. We specialize in Healthcare, IT, Engineering, and Professional Services staffing across the United States.</p>` +
              `<p><a href="/jobs">Browse all open positions</a></p></main>`;
          }
        }

        if (staticBody) {
          html = html.replace(
            '<div id="root"></div>',
            `<div id="root"><div style="display:none;visibility:hidden">${staticBody}</div></div>`,
          );
        }
      }

      res.status(known ? 200 : 404).set({ "Content-Type": "text/html", "Cache-Control": "no-store" }).end(html);
    })().catch(next);
  });
}
