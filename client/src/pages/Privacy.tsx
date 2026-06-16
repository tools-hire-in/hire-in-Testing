import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { COMPANY, CONTACT } from "@/lib/constants";
import { useSEO } from "@/hooks/use-seo";

export default function Privacy() {
  useSEO({
    title: "Privacy Policy | Hire'in Solutions",
    description:
      "Read the Hire'in Solutions Privacy Policy to understand how we collect, use, and protect your personal information.",
    canonical: "https://hire-in.com/privacy",
  });

  return (
    <Layout>
      <section className="py-12 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-lg text-muted-foreground">
            Protecting your privacy with transparency, security, and compliance excellence
          </p>
        </div>
      </section>

      <article className="py-16 px-4 lg:px-6">
        <div className="container mx-auto max-w-4xl prose prose-gray dark:prose-invert">
          <h2>Hire'in Solutions Privacy Policies</h2>
          <p className="lead">
            <strong>Master Privacy Policy & Data Protection Framework</strong>
          </p>
          <p>
            <strong>Document Version</strong><br />
            Last Updated: April 15, 2026
          </p>

          <p>
            Rayomind Software Solutions LLC, doing business as {COMPANY.name} (the "Company," "we," "our," or "us"), 
            is committed to safeguarding the privacy, security, and integrity of personal information entrusted to us 
            in connection with our recruitment, staffing, and placement services.
          </p>

          <p>
            This Master Privacy Policy consolidates our original policy with strengthened provisions to ensure 
            compliance with federal U.S. law, California Consumer Privacy Act (CCPA/CPRA), San Francisco-specific 
            requirements, and other applicable state and industry standards. It retains all original sections while 
            adding clarifications and new commitments around data retention, vendor oversight, international transfers, 
            and security safeguards.
          </p>

          <p>
            This Privacy Policy (the "Policy") sets forth our practices regarding the collection, use, disclosure, 
            retention, and protection of personal information of candidates, clients, and business partners. This 
            Policy is intended to comply with applicable United States federal and state privacy laws, including but 
            not limited to the California Consumer Privacy Act (CCPA/CPRA), Virginia Consumer Data Protection Act 
            (VCDPA), Colorado Privacy Act (CPA), and any other relevant state-specific regulations.
          </p>

          <p>
            By submitting personal information to us, engaging our services, or interacting with our website or 
            communication tools, you acknowledge that you have read, understood, and agree to the terms of this Policy.
          </p>

          <h2>Enhanced Privacy Provisions</h2>

          <h3>A. Data Retention</h3>
          <p>
            Personal data will be retained no longer than necessary. Unless required by law or ongoing contractual 
            need, candidate data is retained for a maximum of 2 years after the last interaction. After this period, 
            records will be securely deleted or anonymized in compliance with California and San Francisco data 
            retention standards.
          </p>

          <h3>B. Sensitive Personal Information</h3>
          <p>
            Sensitive identifiers such as Social Security numbers, background checks, or medical/drug test results 
            will only be collected with explicit written consent, stored in encrypted format at rest and in transit, 
            and access restricted to verified personnel with strict audit trails.
          </p>

          <h3>C. Vendor and Third-Party Oversight</h3>
          <p>
            All third-party vendors engaged in processing or storing data must sign a Data Processing Agreement (DPA). 
            Vendors are subject to periodic reviews and security audits to ensure compliance with contractual, 
            regulatory, and San Francisco privacy standards.
          </p>

          <h3>D. International Transfers</h3>
          <p>
            Where data is transferred or accessed outside the United States, safeguards such as Standard Contractual 
            Clauses (SCCs), binding corporate rules, or equivalent mechanisms will be implemented to protect personal 
            information.
          </p>

          <h3>E. Consumer Rights Requests</h3>
          <p>
            In compliance with California and San Francisco ordinances, individuals may submit requests regarding 
            their personal data via email, toll-free phone, or a dedicated online request form. Verified requests 
            will be responded to within 45 days.
          </p>

          <h2>1. Information We Collect</h2>
          <p>
            We collect only the information necessary for lawful recruitment and business purposes. This may include:
          </p>

          <h3>Personal Identifiers:</h3>
          <p>
            Full name, mailing address, phone number, email address, date of birth, government-issued identification 
            (where required by law).
          </p>

          <h3>Professional and Employment Data:</h3>
          <p>
            Resumes/CVs, employment history, educational background, certifications, references, and professional 
            achievements.
          </p>

          <h3>Sensitive Information:</h3>
          <p>
            (only where legally permissible and strictly necessary): Background checks, Social Security numbers, 
            drug testing results, health or medical information related to role eligibility.
          </p>

          <h3>Communication Records:</h3>
          <p>Phone call recordings, emails, text messages, voicemail, and interview notes.</p>

          <h3>Technical Data:</h3>
          <p>Device identifiers, IP address, and usage information when accessing our website, portals, or communication tools.</p>

          <h3>Mobile Information:</h3>
          <p>Phone numbers provided for SMS consent, and the status of such opt-in or opt-out preferences.</p>

          <h2>2. Purpose of Data Use</h2>
          <p>Personal information is processed solely for legitimate business and recruitment purposes, including:</p>
          <ul>
            <li>Identifying and evaluating candidates for professional engagement and potential career placements (with prior consent).</li>
            <li>Sharing candidate profiles with client organizations, strictly with candidate authorization.</li>
            <li>Verifying employment history, references, and qualifications.</li>
            <li>Communicating with candidates and clients regarding job opportunities, interviews, and recruitment-related matters.</li>
            <li>Complying with legal, regulatory, and contractual requirements.</li>
            <li>Quality assurance, compliance monitoring, and training (including call recording and monitoring).</li>
          </ul>
          <p>
            If you opt in to SMS text messaging, we process your mobile number to send the types of messages you 
            consented to receive (conversational, informational, or promotional). We also log your consent and 
            preferences for compliance purposes.
          </p>

          <h2>3. Communication & Calling Privacy</h2>
          <ul>
            <li>All communications (calls, emails, messages) are conducted solely for recruitment and professional purposes.</li>
            <li>In compliance with the Telephone Consumer Protection Act (TCPA), we do not engage in unsolicited marketing communications.</li>
            <li>Calls may be recorded for quality assurance, compliance, and training purposes. Recordings are stored securely and accessed only when necessary.</li>
            <li>Candidates and clients may opt out of non-essential communications at any time.</li>
          </ul>

          <h2>4. Data Sharing & Disclosure</h2>
          <p>We do not sell or rent personal data. Information may only be disclosed in the following circumstances:</p>
          <ul>
            <li><strong>Prospective Employers:</strong> Candidate information may be shared with authorized client partners, only when consent has been explicitly provided.</li>
            <li><strong>Third-Party Service Providers:</strong> Vendors providing services such as background checks, IT hosting, or cloud storage, under binding confidentiality agreements.</li>
            <li><strong>Regulatory & Legal Authorities:</strong> Where required by applicable law, subpoena, or government request.</li>
          </ul>
          <p>
            No mobile opt-in or text message consent will be shared with third parties or affiliates. SMS-related 
            data is used exclusively for the purpose you consented to and is never sold or disclosed for marketing 
            by third parties. For full SMS policy details, see Section 5 (SMS & Mobile Communications Policy).
          </p>

          <h2 id="sms-policy">5. SMS & Mobile Communications Policy</h2>
          <p>
            No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. 
            All other categories exclude text messaging originator opt-in data and consent; this information will 
            not be shared with any third parties.
          </p>
          <p>
            If you opt in to SMS text messaging, we process your mobile number to send the types of messages you 
            consented to receive (conversational, informational, or recruitment-related). We also log your consent 
            and preferences for compliance purposes.
          </p>
          <p>
            <strong>Opt-Out:</strong> You may withdraw SMS consent at any time by replying <strong>STOP</strong> to 
            any message. Opt-out requests are processed immediately. After opting out, you will receive no further 
            SMS messages from us.
          </p>
          <p>
            <strong>Message Frequency & Rates:</strong> Message frequency varies based on your engagement with us. 
            Standard message and data rates may apply per your carrier.
          </p>
          <p>
            For complete SMS terms including opt-in, HELP, and STOP instructions, see Section 6 (SMS and 
            Communication Compliance) of our <Link href="/terms" className="text-primary hover:underline">Terms &amp; Conditions</Link>.
          </p>

          <h2>6. Digital Communication & Messaging Policy</h2>
          <p>
            {COMPANY.name} uses approved digital communication and messaging platforms exclusively for professional 
            engagement and networking purposes.
          </p>
          <ul>
            <li><strong>Content Standards:</strong> All messages are informational in nature, such as introducing services, events, or career networking opportunities. Messages do not include direct job advertisements.</li>
            <li><strong>Call-to-Action (CTA):</strong> All CTAs reflect our brand presence (e.g., "Connect with Hire'in Solutions," "Schedule a Consultation," or "Join Our Talent Network") and are not generic job postings.</li>
            <li><strong>Consent & Opt-Out:</strong> Recipients will only receive messages after providing prior consent. Opt-out is available at any time through the instructions included in each message.</li>
            <li><strong>Data Protection:</strong> Contact details collected for campaigns are processed in compliance with applicable privacy regulations (e.g., CCPA/CPRA, TCPA). Personal data is never shared, sold, or used outside of authorized recruitment or professional engagement purposes.</li>
          </ul>

          <h2>7. Data Retention</h2>
          <p>
            Personal information is retained only as long as necessary to fulfill recruitment services, comply with 
            legal requirements, or maintain business records. Candidates may request deletion of their data, subject 
            to applicable retention obligations.
          </p>

          <h2>8. Data Security</h2>
          <p>
            We employ reasonable administrative, technical, and physical safeguards to protect personal information 
            from unauthorized access, disclosure, alteration, or misuse. Safeguards include:
          </p>
          <ul>
            <li>Secure servers and encryption protocols.</li>
            <li>Role-based access restrictions.</li>
            <li>Employee training in data handling and confidentiality.</li>
            <li>Regular audits of systems and security controls.</li>
          </ul>

          <h2>9. Candidate Consent and Acknowledgment</h2>
          <p>
            By submitting your professional information (such as qualifications, career history, or contact details) 
            to the Company, you are hereby:
          </p>
          <ul>
            <li>Consent to the collection, storage, processing, and disclosure of your personal information as outlined in this Privacy Policy.</li>
            <li>Acknowledge that your information may be shared with prospective employers only with your prior knowledge and authorization.</li>
            <li>Authorize communications (including phone calls, emails, and text messages) relating to recruitment and placement activities, which may be recorded and retained for compliance and quality assurance purposes.</li>
            <li>Agree that any disputes shall be resolved exclusively in accordance with Sections 14 (Governing Law & Jurisdiction), 15 (Arbitration Agreement), 16 (Severability), and 17 (Limitation of Liability).</li>
          </ul>
          <p>
            By providing your mobile number and consenting, you acknowledge and agree to receive SMS messages as 
            outlined in Section 5 (SMS & Mobile Communications Policy). You may withdraw consent at any time by 
            following the opt-out instructions provided in each SMS.
          </p>

          <h2>10. Individual Privacy Rights</h2>
          <p>
            Depending on applicable state laws (e.g., California, Virginia, Colorado), individuals may have the right to:
          </p>
          <ul>
            <li>Access and receive a copy of the personal data we hold.</li>
            <li>Request correction of inaccurate or incomplete information.</li>
            <li>Request deletion of personal data, subject to legal requirements.</li>
            <li>Restrict or object to certain data processing activities.</li>
            <li>Opt out of data sharing or "sale" (we do not sell data).</li>
            <li>Non-discrimination for exercising privacy rights.</li>
          </ul>
          <p>Requests can be submitted by contacting us (see Section 12).</p>

          <h2>11. Children's Privacy</h2>
          <p>
            We do not knowingly collect or process personal information of individuals under the age of 18 for 
            recruitment purposes.
          </p>

          <h2>12. Contact Information</h2>
          <p>
            For inquiries, requests, or complaints regarding this Privacy Policy or our data practices, please contact:
          </p>
          <address>
            <strong>Hire'in Solutions</strong> (A Rayomind Company)<br /><br />
            <strong>Email:</strong> {CONTACT.emails.general}<br />
            <strong>Phone:</strong> {CONTACT.phones.main}<br />
            <strong>Mailing Address:</strong> {CONTACT.address.full}
          </address>

          <h2>13. Updates to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically to reflect legal, regulatory, or business practice changes. 
            Updates will be published on our website with the revised "Effective Date."
          </p>

          <h2>14. Governing Law & Jurisdiction</h2>
          <p>
            This Privacy Policy shall be governed by and construed in accordance with the laws of the State of 
            California, United States of America, without regard to conflict-of-law principles.
          </p>
          <p>
            Any dispute, claim, or controversy arising out of or relating to this Policy, our data practices, or 
            the services provided by the Company shall be subject to the exclusive jurisdiction of the state and 
            federal courts located in Santa Clara County, California, except as provided in Section 15 (Arbitration Agreement).
          </p>

          <h2>15. Arbitration Agreement</h2>
          <p>To the fullest extent permitted by applicable law, you and the Company agree that:</p>
          <ul>
            <li><strong>Binding Arbitration:</strong> Any dispute, claim, or controversy arising out of or relating to this Privacy Policy, the collection or use of personal information, or our recruitment and staffing services, shall be resolved exclusively through final and binding arbitration administered by the American Arbitration Association (AAA) in accordance with its Commercial Arbitration Rules then in effect.</li>
            <li><strong>Venue & Governing Rules:</strong> Arbitration proceedings shall take place in Santa Clara County, California, unless both parties mutually agree otherwise. The arbitration shall be conducted by a single arbitrator, selected in accordance with AAA rules.</li>
            <li><strong>Waiver of Jury Trial & Class Actions:</strong> By agreeing to arbitration, both parties waive any right to a jury trial or to participate in a class action, class arbitration, or other representative proceeding. Claims must be brought on an individual basis only.</li>
            <li><strong>Confidentiality:</strong> All arbitration proceedings, filings, and awards shall remain strictly confidential, except where disclosure is required by law.</li>
            <li><strong>Enforceability:</strong> The arbitration award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.</li>
            <li><strong>Exceptions:</strong> Either party may seek injunctive or equitable relief in court for matters relating to intellectual property rights, data security breaches, or unauthorized use of personal information.</li>
          </ul>

          <h2>16. Severability</h2>
          <p>
            If any provision of this Privacy Policy, including but not limited to Sections 14 (Governing Law & 
            Jurisdiction) or 15 (Arbitration Agreement), is found to be invalid, illegal, or unenforceable by a 
            court or arbitrator of competent jurisdiction, such provision shall be deemed severed to the minimum 
            extent necessary.
          </p>
          <p>
            The remaining provisions of this Policy shall remain in full force and effect, and the unenforceability 
            of any single provision shall not affect the validity or enforceability of the remainder.
          </p>

          <h2>17. Limitation of Liability</h2>
          <p>To the maximum extent permitted by applicable law:</p>
          <p>
            The Company, its affiliates, officers, directors, employees, and agents shall not be liable for any 
            indirect, incidental, consequential, punitive, or special damages, including but not limited to loss 
            of income, revenue, profits, data, business opportunities, or goodwill, arising out of or relating to 
            this Privacy Policy, our recruitment services, or the processing of personal information.
          </p>
        </div>
      </article>
    </Layout>
  );
}
