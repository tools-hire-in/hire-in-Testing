import { Layout } from "@/components/layout/Layout";
import { COMPANY, CONTACT } from "@/lib/constants";

export default function Privacy() {
  return (
    <Layout>
      <article className="py-16 px-4 lg:px-6">
        <div className="container mx-auto max-w-4xl prose prose-gray dark:prose-invert">
          <h1>Privacy Policy</h1>
          <p className="lead">
            <strong>Effective Date:</strong> January 1, 2025
          </p>
          <p>
            {COMPANY.name} ("Company," "we," "us," or "our") is committed to protecting
            your privacy. This Privacy Policy explains how we collect, use, disclose, and
            safeguard your information when you visit our website or use our services.
          </p>

          <h2>1. Information We Collect</h2>
          <h3>Personal Information</h3>
          <p>We may collect personal information that you voluntarily provide, including:</p>
          <ul>
            <li>Name, email address, phone number, and mailing address</li>
            <li>Resume, work history, and professional credentials</li>
            <li>Employment preferences and job search criteria</li>
            <li>Professional licenses and certifications</li>
            <li>References and background check information (with consent)</li>
          </ul>

          <h3>Automatically Collected Information</h3>
          <p>
            We automatically collect certain information when you visit our website,
            including IP address, browser type, device information, pages visited, and
            time spent on pages.
          </p>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Match candidates with appropriate job opportunities</li>
            <li>Verify credentials and conduct background checks (with consent)</li>
            <li>Communicate with you about job opportunities and our services</li>
            <li>Improve our website and services</li>
            <li>Comply with legal obligations</li>
            <li>Protect against fraudulent or illegal activity</li>
          </ul>

          <h2>3. Information Sharing</h2>
          <p>We may share your information with:</p>
          <ul>
            <li>
              <strong>Employers:</strong> With your consent, we share candidate
              information with potential employers
            </li>
            <li>
              <strong>Service Providers:</strong> Third parties who assist us in
              operating our business
            </li>
            <li>
              <strong>Legal Requirements:</strong> When required by law or to protect our
              rights
            </li>
          </ul>
          <p>We do not sell your personal information to third parties.</p>

          <h2>4. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect
            your personal information, including encryption, secure servers, and access
            controls. However, no method of transmission over the Internet is 100%
            secure.
          </p>

          <h2>5. Data Retention</h2>
          <p>
            We retain your personal information for as long as necessary to fulfill the
            purposes for which it was collected, comply with legal obligations, resolve
            disputes, and enforce our agreements. Candidate data is typically retained
            for up to 3 years following your last interaction with us.
          </p>

          <h2>6. Your Rights (CCPA/CPRA Compliance)</h2>
          <p>If you are a California resident, you have the right to:</p>
          <ul>
            <li>Know what personal information we collect and how it is used</li>
            <li>Request deletion of your personal information</li>
            <li>Opt out of the sale of your personal information (we do not sell)</li>
            <li>Non-discrimination for exercising your privacy rights</li>
            <li>Access and correct your personal information</li>
            <li>Limit use of sensitive personal information</li>
          </ul>
          <p>
            To exercise these rights, contact us at {CONTACT.emails.general} or call{" "}
            {CONTACT.phones.main}.
          </p>

          <h2>7. Cookies and Tracking Technologies</h2>
          <p>
            We use cookies and similar tracking technologies to enhance your experience
            on our website. You can control cookies through your browser settings.
            Disabling cookies may limit some functionality.
          </p>

          <h2>8. Third-Party Links</h2>
          <p>
            Our website may contain links to third-party websites. We are not responsible
            for the privacy practices or content of those sites. We encourage you to
            review their privacy policies.
          </p>

          <h2>9. Children's Privacy</h2>
          <p>
            Our services are not intended for individuals under 18 years of age. We do
            not knowingly collect personal information from children.
          </p>

          <h2>10. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries other than
            your own. We ensure appropriate safeguards are in place for such transfers.
          </p>

          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of
            any changes by posting the new Privacy Policy on this page and updating the
            "Effective Date."
          </p>

          <h2>12. Contact Us</h2>
          <p>If you have questions about this Privacy Policy, please contact us:</p>
          <address>
            {COMPANY.name}
            <br />
            {CONTACT.address.street}
            <br />
            {CONTACT.address.city}, {CONTACT.address.state} {CONTACT.address.zip}
            <br />
            Email: {CONTACT.emails.general}
            <br />
            Phone: {CONTACT.phones.main}
          </address>
        </div>
      </article>
    </Layout>
  );
}
