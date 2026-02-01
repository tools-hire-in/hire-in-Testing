import { Layout } from "@/components/layout/Layout";
import { COMPANY, CONTACT } from "@/lib/constants";

export default function Terms() {
  return (
    <Layout>
      <article className="py-16 px-4 lg:px-6">
        <div className="container mx-auto max-w-4xl prose prose-gray dark:prose-invert">
          <h1>Terms of Service</h1>
          <p className="lead">
            <strong>Effective Date:</strong> January 1, 2025
          </p>
          <p>
            Welcome to {COMPANY.name} ("Company," "we," "us," or "our"). These Terms of
            Service ("Terms") govern your access to and use of our website, applications,
            and services (collectively, the "Services"). By accessing or using our
            Services, you agree to be bound by these Terms.
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using our Services, you confirm that you have read,
            understood, and agree to be bound by these Terms. If you do not agree to
            these Terms, you may not use our Services.
          </p>

          <h2>2. Description of Services</h2>
          <p>
            {COMPANY.name} provides AI-powered recruitment and staffing services,
            including but not limited to:
          </p>
          <ul>
            <li>Healthcare recruitment and credentialing services</li>
            <li>IT and software development staffing</li>
            <li>Engineering and technical placement</li>
            <li>Professional services recruitment</li>
            <li>Contract and temporary staffing solutions</li>
          </ul>

          <h2>3. Eligibility and Registration</h2>
          <p>
            To use certain features of our Services, you may be required to register for
            an account. You agree to provide accurate, current, and complete information
            during the registration process and to update such information to keep it
            accurate, current, and complete.
          </p>

          <h2>4. Service Agreements and Scope</h2>
          <p>
            Specific terms regarding placement fees, guarantees, and service levels will
            be outlined in separate service agreements between {COMPANY.name} and
            clients. These Terms of Service govern general use of our platform and
            public-facing services.
          </p>

          <h2>5. Fees and Payment Terms</h2>
          <p>
            Fees for our recruitment services are outlined in individual client
            agreements. Payment terms, including invoicing schedules and accepted payment
            methods, will be specified in those agreements.
          </p>

          <h2>6. SMS and Communication Compliance</h2>
          <p>
            If you opt in to receive SMS communications from us, you consent to receive
            text messages at the phone number you provide. Message and data rates may
            apply. You may opt out at any time by replying STOP to any message.
          </p>

          <h2>7. Confidentiality</h2>
          <p>
            Both parties agree to maintain the confidentiality of any proprietary or
            sensitive information shared during the course of providing or receiving
            Services. This includes candidate information, client requirements, and
            business processes.
          </p>

          <h2>8. Intellectual Property</h2>
          <p>
            All content, features, and functionality of our Services, including but not
            limited to text, graphics, logos, and software, are owned by {COMPANY.name}{" "}
            or its licensors and are protected by intellectual property laws.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, {COMPANY.name} shall not
            be liable for any indirect, incidental, special, consequential, or punitive
            damages, or any loss of profits or revenues, whether incurred directly or
            indirectly, or any loss of data, use, goodwill, or other intangible losses.
          </p>

          <h2>10. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless {COMPANY.name} and its
            officers, directors, employees, agents, and affiliates from and against any
            claims, liabilities, damages, losses, and expenses arising out of or in any
            way connected with your use of our Services.
          </p>

          <h2>11. Termination</h2>
          <p>
            We may terminate or suspend your access to our Services immediately, without
            prior notice or liability, for any reason whatsoever, including without
            limitation if you breach these Terms.
          </p>

          <h2>12. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of
            the State of California, without regard to its conflict of law provisions.
          </p>

          <h2>13. Dispute Resolution</h2>
          <p>
            Any disputes arising out of or relating to these Terms or our Services shall
            first be attempted to be resolved through good-faith negotiation. If
            resolution cannot be reached, disputes shall be submitted to binding
            arbitration in Santa Clara County, California.
          </p>

          <h2>14. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. If we make changes,
            we will provide notice by updating the "Effective Date" at the top of these
            Terms. Your continued use of the Services after such changes constitutes your
            acceptance of the new Terms.
          </p>

          <h2>15. Contact Information</h2>
          <p>If you have any questions about these Terms, please contact us at:</p>
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
