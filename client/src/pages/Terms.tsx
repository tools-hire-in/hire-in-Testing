import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { COMPANY, CONTACT } from "@/lib/constants";
import { useSEO } from "@/hooks/use-seo";

export default function Terms() {
  useSEO({
    title: "Terms of Service | Hire'in Solutions",
    description:
      "Review the Terms of Service for Hire'in Solutions. Understand your rights and obligations when using our recruitment and staffing platform.",
    canonical: "https://hire-in.com/terms",
  });

  return (
    <Layout>
      <section className="py-12 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-lg text-muted-foreground">
            Please read these terms carefully before using our services
          </p>
        </div>
      </section>

      <article className="py-16 px-4 lg:px-6">
        <div className="container mx-auto max-w-4xl prose prose-gray dark:prose-invert">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the services provided by Hire-In.com ("Company," "we," "us," or "our"), 
            including our AI-powered recruitment platform, staffing services, and related technologies 
            ("Services"), you ("Client," "you," or "your") agree to be bound by these Terms of Service 
            ("Terms"). If you do not agree to these Terms, do not use our Services.
          </p>

          <h2>2. Description of Services</h2>
          <p>
            Hire-In.com provides comprehensive AI-powered recruitment and staffing services, including 
            but not limited to:
          </p>
          <ul>
            <li>Permanent placement services</li>
            <li>Temporary and contract staffing solutions</li>
            <li>Executive search and recruitment</li>
            <li>AI-driven candidate matching and screening</li>
            <li>Human resources consulting and support</li>
            <li>Skills assessment and verification services</li>
          </ul>
          <p>
            Our Services combine advanced artificial intelligence technology with human expertise to 
            deliver superior recruitment outcomes.
          </p>

          <h2>3. Eligibility and Registration</h2>
          <p>To use our Services, you must:</p>
          <ul>
            <li>Be at least 18 years of age</li>
            <li>Have the legal authority to enter into this agreement</li>
            <li>Provide accurate, current, and complete information during registration</li>
            <li>Maintain and update your account information</li>
            <li>Be located within the United States for full service availability</li>
          </ul>

          <h2>4. Service Agreements and Scope</h2>
          
          <h3>4.1 Individual Service Orders</h3>
          <p>
            Each recruitment engagement shall be governed by a separate Service Order or Statement of 
            Work that references these Terms and specifies:
          </p>
          <ul>
            <li>Position requirements and specifications</li>
            <li>Fee structure and payment terms</li>
            <li>Timeline and deliverables</li>
            <li>Special terms or modifications</li>
          </ul>

          <h3>4.2 Candidate Ownership and Protection</h3>
          <p>
            If Client hires any candidate introduced by Hire-In.com within twelve (12) months of 
            introduction, Client agrees to pay the applicable placement fee, regardless of how the 
            hiring occurs.
          </p>

          <h3>4.3 AI Technology Usage</h3>
          <p>
            Our AI systems process candidate and client data to improve matching accuracy. By using 
            our Services, you consent to this processing in accordance with our Privacy Policy.
          </p>

          <h2>5. Fees and Payment Terms</h2>

          <h3>5.1 Fee Structure</h3>
          <ul>
            <li>Permanent Placements: Typically 15-25% of the candidate's first-year base salary</li>
            <li>Temporary Staffing: Markup on hourly rates as specified in Service Orders</li>
            <li>Executive Search: Retainer-based fees as outlined in individual agreements</li>
            <li>Additional Services: Fixed fees for consulting, assessments, and specialized services</li>
          </ul>

          <h3>5.2 Payment Terms</h3>
          <ul>
            <li>Invoices are due within thirty (30) days of invoice date</li>
            <li>Late payments incur interest at 1.5% per month or the maximum legal rate</li>
            <li>Client is responsible for all collection costs, including reasonable attorney fees</li>
          </ul>

          <h3>5.3 Guarantee Policy</h3>
          <p>
            If a placed permanent candidate voluntarily leaves or is terminated for cause within ninety 
            (90) days of start date, we will provide one replacement search at no additional fee.
          </p>

          <h2>6. SMS and Communication Compliance</h2>
          <p>
            Our SMS communications comply with the Telephone Consumer Protection Act (TCPA) and are sent 
            only to users who have provided consent. By providing your mobile number and opting in, you 
            agree to receive SMS messages from Hire-In.com regarding:
          </p>
          <ul>
            <li>Updates related to your account and service status</li>
            <li>Scheduling reminders (e.g., interviews, meetings, onboarding)</li>
            <li>Notifications regarding activity and important information after you have opted in</li>
            <li>Emergency communications strictly relating to your engagement with Hire-In.com</li>
          </ul>
          <p>
            We do not send SMS messages about job postings, marketing, or promotional content. Standard 
            messaging rates may apply per your carrier. You may opt out of SMS messages at any time by 
            replying "STOP"; opt-out requests are processed immediately and automatically.
          </p>
          <p>
            "By opting into SMS from a web form or other medium, you are agreeing to receive SMS messages 
            from {COMPANY.name}. This includes SMS messages for conversations (external). Message frequency 
            varies. Message and data rates may apply. See privacy policy at{" "}
            <Link href="/privacy" className="text-primary hover:underline">our Privacy Policy</Link>. 
            Message HELP for help. Reply STOP to any message to opt out."
          </p>

          <h2>7. Data Privacy and California Compliance</h2>

          <h3>7.1 California Consumer Privacy Act (CCPA)</h3>
          <p>As a California-based service provider, we comply with CCPA requirements:</p>
          <ul>
            <li>Right to know what personal information is collected and how it's used</li>
            <li>Right to delete personal information (subject to business necessity exceptions)</li>
            <li>Right to opt-out of the sale of personal information (we do not sell personal data)</li>
            <li>Right to non-discrimination for exercising CCPA rights</li>
          </ul>

          <h3>7.2 Employment Law Compliance</h3>
          <p>We maintain compliance with California employment laws including:</p>
          <ul>
            <li>Fair Employment and Housing Act (FEHA)</li>
            <li>California Labor Code requirements for staffing agencies</li>
            <li>Equal Employment Opportunity (EEO) regulations</li>
            <li>Workers' compensation and liability insurance requirements</li>
          </ul>

          <h2>8. AI Technology and Intellectual Property</h2>

          <h3>8.1 Proprietary Technology</h3>
          <p>
            Our AI algorithms, machine learning models, candidate databases, and proprietary software 
            constitute valuable intellectual property owned exclusively by Hire-In.com.
          </p>

          <h3>8.2 Data Usage Rights</h3>
          <p>
            You grant us a limited license to use your job descriptions, requirements, and feedback to 
            improve our AI systems and provide better matching services.
          </p>

          <h3>8.3 Candidate Data</h3>
          <p>
            Candidate profiles, resumes, and assessment data remain our property. Clients receive access 
            for evaluation purposes only and may not redistribute or use this data for purposes outside 
            the agreed recruitment engagement.
          </p>

          <h2>9. Client Obligations and Responsibilities</h2>

          <h3>9.1 Cooperation Requirements</h3>
          <p>Client agrees to:</p>
          <ul>
            <li>Provide accurate job descriptions and requirements</li>
            <li>Respond promptly to candidate submissions and requests</li>
            <li>Conduct interviews and make hiring decisions in good faith</li>
            <li>Comply with all applicable employment laws and regulations</li>
          </ul>

          <h3>9.2 Non-Solicitation</h3>
          <p>
            During the term of any active Service Order and for twelve (12) months thereafter, Client 
            may not directly solicit, recruit, or hire our employees without written consent and payment 
            of applicable fees.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY CALIFORNIA LAW:</p>
          <ul>
            <li>Our total liability shall not exceed the fees paid for the specific service giving rise to the claim</li>
            <li>We are not liable for indirect, consequential, punitive, or special damages</li>
            <li>We make no warranties regarding candidate performance, employment duration, or client satisfaction</li>
            <li>Clients are solely responsible for their hiring decisions and employment law compliance</li>
          </ul>

          <h2>11. Indemnification</h2>
          <p>Client agrees to indemnify and hold Hire-In.com harmless from claims arising from:</p>
          <ul>
            <li>Client's hiring practices or employment decisions</li>
            <li>Violations of employment laws or regulations</li>
            <li>Breach of these Terms or any Service Order</li>
            <li>Use of our Services in a manner inconsistent with our instructions</li>
          </ul>

          <h2>12. Confidentiality</h2>
          <p>
            Both parties agree to maintain the confidentiality of proprietary information shared during 
            the course of our relationship, including but not limited to candidate information, business 
            strategies, pricing, and trade secrets.
          </p>

          <h2>13. Termination</h2>

          <h3>13.1 Termination Rights</h3>
          <p>Either party may terminate these Terms or any Service Order:</p>
          <ul>
            <li>For convenience with thirty (30) days written notice</li>
            <li>Immediately for material breach that remains uncured for ten (10) days after written notice</li>
            <li>Immediately for insolvency, bankruptcy, or cessation of business operations</li>
          </ul>

          <h3>13.2 Effect of Termination</h3>
          <p>
            Upon termination, all payment obligations become immediately due, and both parties must 
            return or destroy confidential information as directed.
          </p>

          <h2>14. Dispute Resolution</h2>

          <h3>14.1 Governing Law</h3>
          <p>
            These Terms are governed by California law without regard to conflict of law principles.
          </p>

          <h3>14.2 Dispute Resolution Process</h3>
          <p>Disputes shall be resolved through:</p>
          <ul>
            <li>Good faith negotiation for thirty (30) days</li>
            <li>Binding arbitration under California Arbitration Act if negotiation fails</li>
            <li>Arbitration shall occur in Santa Clara County, California</li>
          </ul>

          <h2>15. General Provisions</h2>

          <h3>15.1 Entire Agreement</h3>
          <p>
            These Terms, together with any Service Orders and our Privacy Policy, constitute the entire 
            agreement between the parties.
          </p>

          <h3>15.2 Modifications</h3>
          <p>
            We may update these Terms at any time. Material changes will be communicated via email or 
            platform notification at least thirty (30) days before taking effect.
          </p>

          <h3>15.3 Severability</h3>
          <p>
            If any provision is deemed invalid or unenforceable, the remaining provisions shall remain 
            in full force and effect.
          </p>

          <h3>15.4 Force Majeure</h3>
          <p>
            Neither party shall be liable for delays or failures due to circumstances beyond their 
            reasonable control.
          </p>

          <h2>16. Contact Information</h2>
          <p>For questions about these Terms or our Services:</p>
          <address>
            <strong>{COMPANY.name}</strong><br /><br />
            <strong>Email:</strong>{" "}
            <a href={`mailto:${CONTACT.emails.general}`} className="text-primary hover:underline">
              {CONTACT.emails.general}
            </a><br />
            <strong>Phone:</strong> {CONTACT.phones.main}<br />
            <strong>Address:</strong> {CONTACT.address.full}
          </address>
        </div>
      </article>
    </Layout>
  );
}
