// SendGrid email service
import sgMail from '@sendgrid/mail';

const FROM_EMAIL = 'noreply@hire-in.com';

async function getUncachableSendGridClient() {
  const apiKey = process.env.SENDGRID_API_KEY_NEW;
  if (!apiKey) throw new Error('SENDGRID_API_KEY_NEW is not set');
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: FROM_EMAIL
  };
}

export async function sendInvitationEmail(options: {
  to: string;
  firstName: string;
  lastName: string;
  role: string;
  temporaryPassword: string;
  loginUrl: string;
  employeeId?: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const roleLabels: Record<string, string> = {
      super_admin: "Super Admin",
      admin: "Admin",
      hr: "HR Manager",
      operations: "Operations",
      manager: "Manager",
      employee: "Employee",
    };
    const roleName = roleLabels[options.role] || options.role;
    const employeeIdRow = options.employeeId ? `
                <tr>
                  <td style="color: #64748b; padding: 4px 0;">Employee ID:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0; font-family: monospace;">${options.employeeId}</td>
                </tr>` : "";

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: "You're Invited to Hire'in Solutions Employee Portal",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">AI-Powered Recruitment Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Welcome, ${options.firstName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              You've been invited to join the Hire'in Solutions employee portal as <strong>${roleName}</strong>.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 12px;">Your Login Credentials</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 4px 0; width: 120px;">Email:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0;">${options.to}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 4px 0;">Password:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0; font-family: monospace;">${options.temporaryPassword}</td>
                </tr>${employeeIdRow}
              </table>
            </div>
            <p style="color: #dc2626; font-size: 13px; margin: 0 0 24px;">
              Please change your password after your first login for security.
            </p>

            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e40af; font-weight: 600; margin: 0 0 12px; font-size: 15px;">Post-Onboarding Checklist</p>
              <p style="color: #475569; font-size: 13px; margin: 0 0 12px;">Please complete the following at your earliest convenience:</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="color: #475569; padding: 6px 0; font-size: 13px;">&#9744; Upload KYC documents (Aadhaar Card, PAN Card)</td></tr>
                <tr><td style="color: #475569; padding: 6px 0; font-size: 13px;">&#9744; Upload educational certificates (10th, 12th, Graduation)</td></tr>
                <tr><td style="color: #475569; padding: 6px 0; font-size: 13px;">&#9744; Upload previous employment documents (Relieving Letter, Last 3 months' Salary Slips)</td></tr>
                <tr><td style="color: #475569; padding: 6px 0; font-size: 13px;">&#9744; Complete bank account details (Cancelled Cheque, Account Number, IFSC)</td></tr>
                <tr><td style="color: #475569; padding: 6px 0; font-size: 13px;">&#9744; Add emergency contact information</td></tr>
                <tr><td style="color: #475569; padding: 6px 0; font-size: 13px;">&#9744; Set up Two-Factor Authentication for account security</td></tr>
              </table>
              <p style="color: #1e40af; font-size: 12px; margin: 12px 0 0; font-weight: 500;">
                You can complete these from the "My Documents" section in the employee portal.
              </p>
            </div>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.loginUrl}" style="display: inline-block; background: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Login to Portal
              </a>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Welcome to Hire'in Solutions, ${options.firstName}!\n\nYou've been invited as ${roleName}.${options.employeeId ? `\nEmployee ID: ${options.employeeId}` : ""}\n\nYour login credentials:\nEmail: ${options.to}\nPassword: ${options.temporaryPassword}\n\nLogin at: ${options.loginUrl}\n\nPlease change your password after your first login.\n\nPost-Onboarding Checklist:\n- Upload KYC documents (Aadhaar Card, PAN Card)\n- Upload educational certificates (10th, 12th, Graduation)\n- Upload previous employment documents (Relieving Letter, Last 3 months' Salary Slips)\n- Complete bank account details (Cancelled Cheque, Account Number, IFSC)\n- Add emergency contact information\n- Set up Two-Factor Authentication`,
    };

    await client.send(msg);
    console.log(`Invitation email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send invitation email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendRayoAcademyCredentialsEmail(options: {
  to: string;
  firstName: string;
  tempPassword: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: "Your Rayo Academy Training Account",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayo Academy</h1>
            <p style="color: #ede9fe; margin: 8px 0 0; font-size: 14px;">Professional Development Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              A Rayo Academy training account has been created for you. Use the credentials below to access your training courses.
            </p>
            <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 12px;">Your Rayo Academy Credentials</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 4px 0; width: 140px;">Email:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0;">${options.to}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 4px 0;">Temporary Password:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0; font-family: monospace;">${options.tempPassword}</td>
                </tr>
              </table>
            </div>
            <p style="color: #dc2626; font-size: 13px; margin: 0 0 24px;">
              Please change your password after your first login to Rayo Academy.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://rayo.academy" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Open Rayo Academy
              </a>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nA Rayo Academy training account has been created for you.\n\nYour credentials:\nEmail: ${options.to}\nTemporary Password: ${options.tempPassword}\n\nPlease visit https://rayo.academy to log in and change your password.\n\nHire'in Solutions`,
    };
    await client.send(msg);
    console.log(`Rayo Academy credentials email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send Rayo Academy credentials email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendDocumentReminderEmail(options: {
  to: string;
  firstName: string;
  pendingDocuments: string[];
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const docLabels: Record<string, string> = {
      aadhaar: "Aadhaar Card",
      pan: "PAN Card",
      passport: "Passport",
      voter_id_dl: "Voter ID / Driving License",
      "10th_marksheet": "10th Mark Sheet / Certificate",
      "12th_marksheet": "12th Mark Sheet / Certificate",
      graduation_cert: "Graduation Certificate",
      postgrad_cert: "Post-Graduation Certificate",
      relieving_letter: "Relieving Letter / Experience Letter",
      salary_slips_prev: "Last 3 Months' Salary Slips",
      form16: "Form 16",
      cancelled_cheque: "Cancelled Cheque / Bank Passbook",
    };

    const docListHtml = options.pendingDocuments
      .map(d => `<li style="color: #475569; padding: 4px 0; font-size: 14px;">${docLabels[d] || d}</li>`)
      .join("");

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: "Reminder: Pending Onboarding Documents - Hire'in Solutions",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Document Reminder</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              This is a friendly reminder that the following mandatory documents are still pending upload:
            </p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #dc2626; font-weight: 600; margin: 0 0 12px;">Pending Documents (${options.pendingDocuments.length})</p>
              <ul style="margin: 0; padding: 0 0 0 20px;">
                ${docListHtml}
              </ul>
            </div>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Please log in to the employee portal and navigate to <strong>"My Documents"</strong> to upload the required documents.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nThis is a reminder that the following documents are still pending:\n${options.pendingDocuments.map(d => `- ${docLabels[d] || d}`).join("\n")}\n\nPlease log in to the employee portal and navigate to "My Documents" to upload them.`,
    };

    await client.send(msg);
    console.log(`Document reminder email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send document reminder email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendPasswordResetEmail(options: {
  to: string;
  firstName: string;
  resetUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: "Password Reset - Hire'in Solutions",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Password Reset Request</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              We received a request to reset your password. Click the button below to set a new password. This link will expire in 1 hour.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.resetUrl}" style="display: inline-block; background: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Reset Password
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0;">
              If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nWe received a request to reset your password. Visit the link below to set a new password (expires in 1 hour):\n\n${options.resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    };

    await client.send(msg);
    console.log(`Password reset email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send password reset email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendSalaryReport(options: {
  csvContent: string;
  summary: { year: number; month: number; monthName: string; totalEmployees: number; totalPayable: number; totalHoursWorked: number; generatedAt: string };
  recipients?: { to: string[]; cc: string[] };
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const csvBase64 = Buffer.from(options.csvContent).toString("base64");
    const fileName = `Salary_Report_${options.summary.monthName}_${options.summary.year}.csv`;

    const toAddresses = options.recipients?.to?.length ? options.recipients.to : ["accounts@hire-in.com"];
    const ccAddresses = options.recipients?.cc?.length ? options.recipients.cc : ["simranjeet@hire-in.com"];

    const msg: any = {
      to: toAddresses,
      cc: ccAddresses,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: `Monthly Salary Processing Report - ${options.summary.monthName} ${options.summary.year}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Monthly Salary Processing Report</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">
              Salary Report: ${options.summary.monthName} ${options.summary.year}
            </h2>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 8px 0;">Total Employees:</td>
                  <td style="color: #1e293b; font-weight: 600; padding: 8px 0; text-align: right;">${options.summary.totalEmployees}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 8px 0;">Total Hours Worked:</td>
                  <td style="color: #1e293b; font-weight: 600; padding: 8px 0; text-align: right;">${options.summary.totalHoursWorked.toLocaleString()}</td>
                </tr>
                <tr style="border-top: 2px solid #e2e8f0;">
                  <td style="color: #1e40af; padding: 12px 0; font-weight: 600; font-size: 16px;">Total Payable:</td>
                  <td style="color: #1e40af; font-weight: 700; padding: 12px 0; text-align: right; font-size: 16px;">$${options.summary.totalPayable.toLocaleString()}</td>
                </tr>
              </table>
            </div>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 8px;">
              The detailed salary processing report is attached as a CSV file. Please review and process accordingly.
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0;">
              Generated on: ${new Date(options.summary.generatedAt).toLocaleString()}
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Salary Report: ${options.summary.monthName} ${options.summary.year}\n\nTotal Employees: ${options.summary.totalEmployees}\nTotal Hours Worked: ${options.summary.totalHoursWorked}\nTotal Payable: $${options.summary.totalPayable}\n\nPlease see the attached CSV for details.`,
      attachments: [{
        content: csvBase64,
        filename: fileName,
        type: "text/csv",
        disposition: "attachment",
      }],
    };

    await client.send(msg);
    console.log(`Salary report email sent to accounts@hire-in.com`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send salary report email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendWelcomeEmail(options: {
  to: string;
  firstName: string;
  lastName: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: "Welcome to Hire'in Solutions!",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">AI-Powered Recruitment Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Welcome aboard, ${options.firstName} ${options.lastName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Your account on the Hire'in Solutions employee portal is now active. Here's what you can do:
            </p>
            <ul style="color: #475569; line-height: 1.8; padding-left: 20px; margin: 0 0 16px;">
              <li>View your dashboard and company updates</li>
              <li>Track your attendance and punch in/out</li>
              <li>Manage leave requests and balances</li>
              <li>View company holidays and org chart</li>
              <li>Set up two-factor authentication for extra security</li>
            </ul>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
              We recommend setting up two-factor authentication (2FA) from your profile page for added security.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Welcome aboard, ${options.firstName} ${options.lastName}!\n\nYour Hire'in Solutions employee portal account is now active.\n\nYou can:\n- View your dashboard\n- Track attendance\n- Manage leave requests\n- View holidays and org chart\n- Set up 2FA for security\n\nWe recommend enabling two-factor authentication from your profile.`,
    };

    await client.send(msg);
    console.log(`Welcome email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send welcome email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendOfferLetterEmail(options: {
  to: string;
  candidateName: string;
  designation: string;
  acceptUrl: string;
  expiresAt: Date;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const expiryStr = options.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: `Offer Letter from Hire'in Solutions — ${options.designation}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">AI-Powered Recruitment Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Congratulations, ${options.candidateName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              We are excited to extend an offer to you for the position of <strong>${options.designation}</strong> at Hire'in Solutions.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
              Please review your offer letter and accept it by clicking the button below. This offer is valid until <strong>${expiryStr}</strong>.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.acceptUrl}" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                View & Accept Your Offer
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 16px 0 0;">
              If the button doesn't work, copy and paste this link in your browser:<br/>
              <a href="${options.acceptUrl}" style="color: #3b82f6; word-break: break-all;">${options.acceptUrl}</a>
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Rayomind Solutions. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Congratulations, ${options.candidateName}!\n\nWe are excited to extend an offer for the position of ${options.designation} at Hire'in Solutions.\n\nPlease review and accept your offer by visiting:\n${options.acceptUrl}\n\nThis offer is valid until ${expiryStr}.\n\nBest regards,\nHire'in Solutions`,
    };
    await client.send(msg);
    console.log(`Offer letter email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send offer letter email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendOnboardingWelcomeEmail(options: {
  to: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  temporaryPassword: string;
  designation: string;
  loginUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: `Welcome to Hire'in Solutions — Your Onboarding Guide`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Welcome to the Team!</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Welcome aboard, ${options.firstName} ${options.lastName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
              Congratulations on joining Hire'in Solutions as <strong>${options.designation}</strong>! Your employee portal account is ready. Here are your login credentials:
            </p>

            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
              <h3 style="color: #0369a1; margin: 0 0 12px; font-size: 16px;">Your Credentials</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="color: #64748b; padding: 4px 0; width: 140px;">Employee ID:</td><td style="color: #1e293b; font-weight: 600;">${options.employeeId}</td></tr>
                <tr><td style="color: #64748b; padding: 4px 0;">Email:</td><td style="color: #1e293b; font-weight: 600;">${options.to}</td></tr>
                <tr><td style="color: #64748b; padding: 4px 0;">Temporary Password:</td><td style="color: #1e293b; font-weight: 600; font-family: monospace;">${options.temporaryPassword}</td></tr>
              </table>
            </div>

            <h3 style="color: #1e293b; margin: 0 0 12px; font-size: 18px;">📋 Your 10-Step Onboarding Checklist</h3>
            <ol style="color: #475569; line-height: 2; padding-left: 20px; margin: 0 0 24px;">
              <li><strong>Log In & Change Password</strong> — Visit <a href="${options.loginUrl}" style="color: #3b82f6;">${options.loginUrl}</a> and change your temporary password immediately</li>
              <li><strong>Set Up Two-Factor Authentication (2FA)</strong> — Go to Profile → Security and enable TOTP 2FA (required for all employees)</li>
              <li><strong>Upload KYC Documents</strong> — Upload your government-issued ID (Aadhaar/PAN/Passport) under Documents → KYC</li>
              <li><strong>Upload Education Certificates</strong> — Add your highest qualification certificates under Documents → Education</li>
              <li><strong>Upload Employment Documents</strong> — Previous experience letters, relieving letters under Documents → Employment</li>
              <li><strong>Upload Cancelled Cheque / Voided Check</strong> — Required for payroll setup under Documents → Bank</li>
              <li><strong>Enter Bank Account Details</strong> — Go to Profile → Bank Details and enter your bank account information for salary processing</li>
              <li><strong>Add Emergency Contacts</strong> — Go to Profile → Emergency Contacts and add at least one emergency contact</li>
              <li><strong>Select Your 2 Floating Holidays</strong> — Go to Holidays → Regional and choose 2 optional holidays for the year</li>
              <li><strong>Start Punching Attendance</strong> — Use the Attendance page to punch in/out daily (8-hour threshold, 8 PM - 4 AM IST shift)</li>
            </ol>

            <h3 style="color: #1e293b; margin: 0 0 12px; font-size: 18px;">🗺 Portal Navigation</h3>
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="color: #64748b; padding: 6px 0; width: 160px;">Dashboard</td><td style="color: #1e293b;">Overview of your activity & announcements</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Attendance</td><td style="color: #1e293b;">Punch in/out, view history & monthly summary</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Leave Management</td><td style="color: #1e293b;">Apply for leave, view balances & accruals</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Holidays</td><td style="color: #1e293b;">Company holidays & optional regional selections</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Documents</td><td style="color: #1e293b;">Upload & manage KYC, education, employment docs</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Profile</td><td style="color: #1e293b;">Personal info, bank details, emergency contacts, 2FA</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Tickets</td><td style="color: #1e293b;">Raise IT/HR support tickets</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Org Chart</td><td style="color: #1e293b;">View company hierarchy & team structure</td></tr>
              </table>
            </div>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Log In to Your Portal
              </a>
            </div>

            <p style="color: #475569; line-height: 1.6; margin: 16px 0 0;">
              If you have any questions, reach out to HR via the Tickets section or email your manager directly.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Rayomind Solutions. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Welcome aboard, ${options.firstName} ${options.lastName}!\n\nYour Hire'in Solutions employee portal account is ready.\n\nCredentials:\n- Employee ID: ${options.employeeId}\n- Email: ${options.to}\n- Temporary Password: ${options.temporaryPassword}\n\n10-Step Onboarding Checklist:\n1. Log in and change your password at ${options.loginUrl}\n2. Set up 2FA (required)\n3. Upload KYC documents\n4. Upload education certificates\n5. Upload employment documents\n6. Upload cancelled cheque/voided check\n7. Enter bank account details\n8. Add emergency contacts\n9. Select 2 floating holidays\n10. Start punching attendance daily\n\nQuestions? Raise a ticket in the portal or contact HR.`,
    };
    await client.send(msg);
    console.log(`Onboarding welcome email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send onboarding email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendReviewCycleOpenedEmail(options: {
  to: string;
  firstName: string;
  cycleName: string;
  endDate: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: `Performance Review Cycle Opened: ${options.cycleName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Performance Review</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              A new performance review cycle <strong>"${options.cycleName}"</strong> has been opened.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Please submit your self-review before <strong>${options.endDate}</strong>.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nA new performance review cycle "${options.cycleName}" has been opened. Please submit your self-review before ${options.endDate}.`,
    };
    await client.send(msg);
    console.log(`Review cycle opened email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send review cycle email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendSelfReviewDueReminderEmail(options: {
  to: string;
  firstName: string;
  cycleName: string;
  dueDate: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: `Reminder: Self-Review Due — ${options.cycleName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Self-Review Reminder</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Your self-review for <strong>"${options.cycleName}"</strong> is due by <strong>${options.dueDate}</strong>.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Please log in to the portal and complete your review.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nYour self-review for "${options.cycleName}" is due by ${options.dueDate}. Please log in to the portal and complete it.`,
    };
    await client.send(msg);
    console.log(`Self-review reminder sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send self-review reminder:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendCheckInReminderEmail(options: {
  to: string;
  firstName: string;
  scheduledDate: string;
  managerName: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: `Check-In Reminder: ${options.scheduledDate}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Check-In Reminder</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              You have a check-in scheduled for <strong>${options.scheduledDate}</strong> with <strong>${options.managerName}</strong>.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Please prepare your notes and discussion items before the meeting.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nYou have a check-in scheduled for ${options.scheduledDate} with ${options.managerName}. Please prepare your notes.`,
    };
    await client.send(msg);
    console.log(`Check-in reminder sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send check-in reminder:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}
