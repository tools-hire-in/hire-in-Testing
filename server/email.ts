// SendGrid email service
import sgMail from '@sendgrid/mail';

const FROM_EMAIL = 'alina.carter@hire-in.com'; // NOTE: alina.carter@hire-in.com must be a verified sender in SendGrid (domain or single-sender verification) for emails to deliver successfully.

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
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: "You're Invited to Rayomind Solutions LLP Employee Portal",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">AI-Powered Recruitment Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Welcome, ${options.firstName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              You've been invited to join the Rayomind Solutions LLP employee portal as <strong>${roleName}</strong>.
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
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Welcome to Rayomind Solutions LLP, ${options.firstName}!\n\nYou've been invited as ${roleName}.${options.employeeId ? `\nEmployee ID: ${options.employeeId}` : ""}\n\nYour login credentials:\nEmail: ${options.to}\nPassword: ${options.temporaryPassword}\n\nLogin at: ${options.loginUrl}\n\nPlease change your password after your first login.\n\nPost-Onboarding Checklist:\n- Upload KYC documents (Aadhaar Card, PAN Card)\n- Upload educational certificates (10th, 12th, Graduation)\n- Upload previous employment documents (Relieving Letter, Last 3 months' Salary Slips)\n- Complete bank account details (Cancelled Cheque, Account Number, IFSC)\n- Add emergency contact information\n- Set up Two-Factor Authentication`,
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
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
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
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nA Rayo Academy training account has been created for you.\n\nYour credentials:\nEmail: ${options.to}\nTemporary Password: ${options.tempPassword}\n\nPlease visit https://rayo.academy to log in and change your password.\n\nRayomind Solutions LLP`,
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
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: "Reminder: Pending Onboarding Documents - Rayomind Solutions LLP",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
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
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
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
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: "Password Reset - Rayomind Solutions LLP",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
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
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
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
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: `Monthly Salary Processing Report - ${options.summary.monthName} ${options.summary.year}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
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
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
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
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: "Welcome to Rayomind Solutions LLP!",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">AI-Powered Recruitment Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Welcome aboard, ${options.firstName} ${options.lastName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Your account on the Rayomind Solutions LLP employee portal is now active. Here's what you can do:
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
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Welcome aboard, ${options.firstName} ${options.lastName}!\n\nYour Rayomind Solutions LLP employee portal account is now active.\n\nYou can:\n- View your dashboard\n- Track attendance\n- Manage leave requests\n- View holidays and org chart\n- Set up 2FA for security\n\nWe recommend enabling two-factor authentication from your profile.`,
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
  cc?: string[];
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const expiryStr = options.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const msg = {
      to: options.to,
      cc: options.cc?.length ? options.cc : undefined,
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      replyTo: { email: 'alina.carter@hire-in.com', name: 'Alina Carter' },
      subject: `Offer Letter from Rayomind Solutions LLP — ${options.designation}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">AI-Powered Recruitment Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Congratulations, ${options.candidateName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              We are excited to extend an offer to you for the position of <strong>${options.designation}</strong> at Rayomind Solutions LLP.
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
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Congratulations, ${options.candidateName}!\n\nWe are excited to extend an offer for the position of ${options.designation} at Rayomind Solutions LLP.\n\nPlease review and accept your offer by visiting:\n${options.acceptUrl}\n\nThis offer is valid until ${expiryStr}.\n\nBest regards,\nRayomind Solutions LLP`,
    };
    await client.send(msg);
    console.log(`Offer letter email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send offer letter email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendOfferLetterPendingApprovalEmail(options: {
  to: string | string[];
  managerName: string;
  candidateName: string;
  designation: string;
  salary?: string | null;
  reviewUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: `Offer Letter Pending Approval — ${options.candidateName} (${options.designation})`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Offer Letter Approval Required</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">New Offer Letter Awaiting Your Review</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              <strong>${options.managerName}</strong> has submitted an offer letter that requires your approval before it is sent to the candidate.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 12px;">Offer Details</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 4px 0; width: 140px;">Candidate:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0;">${options.candidateName}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 4px 0;">Designation:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0;">${options.designation}</td>
                </tr>
                ${options.salary ? `<tr>
                  <td style="color: #64748b; padding: 4px 0;">Salary:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0;">${options.salary}</td>
                </tr>` : ""}
                <tr>
                  <td style="color: #64748b; padding: 4px 0;">Submitted By:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0;">${options.managerName}</td>
                </tr>
              </table>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.reviewUrl}" style="display: inline-block; background: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Review &amp; Approve
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin: 16px 0 0;">
              Please log in to the HR portal, go to Offer Letters, and switch to the "Pending Approval" tab to review this offer.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `New Offer Letter Awaiting Approval\n\n${options.managerName} has submitted an offer letter for ${options.candidateName} (${options.designation})${options.salary ? ` at ${options.salary}` : ""}.\n\nPlease review and approve at:\n${options.reviewUrl}\n\nRayomind Solutions LLP`,
    };
    await client.send(msg);
    console.log(`Offer letter pending approval email sent to HR`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send offer letter pending approval email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendOfferLetterApprovalDecisionEmail(options: {
  to: string;
  managerFirstName: string;
  candidateName: string;
  designation: string;
  approved: boolean;
  rejectionReason?: string;
  reviewUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const subject = options.approved
      ? `Your Offer Letter for ${options.candidateName} Has Been Approved`
      : `Your Offer Letter for ${options.candidateName} Has Been Rejected`;
    const statusColor = options.approved ? "#16a34a" : "#dc2626";
    const statusLabel = options.approved ? "Approved" : "Rejected";
    const bodyText = options.approved
      ? `Great news — the offer letter you submitted for <strong>${options.candidateName}</strong> (${options.designation}) has been <strong style="color: #16a34a;">approved</strong>. The candidate has been emailed with the offer link.`
      : `The offer letter you submitted for <strong>${options.candidateName}</strong> (${options.designation}) has been <strong style="color: #dc2626;">rejected</strong>.`;
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Offer Letter Decision</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.managerFirstName},</h2>
            <div style="background: ${options.approved ? "#f0fdf4" : "#fef2f2"}; border: 1px solid ${options.approved ? "#bbf7d0" : "#fecaca"}; border-radius: 8px; padding: 16px; margin: 0 0 20px; text-align: center;">
              <span style="color: ${statusColor}; font-size: 18px; font-weight: 700;">${statusLabel}</span>
            </div>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              ${bodyText}
            </p>
            ${!options.approved && options.rejectionReason ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 8px;">Reason for Rejection:</p>
              <p style="color: #475569; margin: 0; line-height: 1.6;">${options.rejectionReason}</p>
            </div>` : ""}
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.reviewUrl}" style="display: inline-block; background: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                View Offer Letters
              </a>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.managerFirstName},\n\nYour offer letter for ${options.candidateName} (${options.designation}) has been ${statusLabel.toLowerCase()}.${!options.approved && options.rejectionReason ? `\n\nReason: ${options.rejectionReason}` : ""}\n\nView details at:\n${options.reviewUrl}\n\nRayomind Solutions LLP`,
    };
    await client.send(msg);
    console.log(`Offer letter approval decision email sent to manager`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send offer letter approval decision email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendHrLetterEmail(options: {
  to: string;
  employeeName: string;
  letterType: string;
  referenceNumber: string;
  authCode: string;
  verifyUrl: string;
  pdfBuffer?: Buffer;
  pdfFilename?: string;
  cc?: string[];
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const letterTypeLabel: Record<string, string> = {
      experience: "Experience Letter",
      internship_completion: "Internship Completion Letter",
      internship_certificate: "Internship Certificate",
      relieving: "Relieving Letter",
      salary_revision: "Salary Revision Letter",
      role_change: "Designation / Promotion Letter",
      combined: "Salary & Designation Amendment",
      device_allocation: "Device Allocation Letter",
    };
    const typeLabel = letterTypeLabel[options.letterType] || "HR Letter";

    const mimeType = options.pdfFilename?.toLowerCase().endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";

    const attachments = options.pdfBuffer && options.pdfFilename ? [{
      content: options.pdfBuffer.toString("base64"),
      filename: options.pdfFilename,
      type: mimeType,
      disposition: "attachment" as const,
    }] : undefined;

    const msg = {
      to: options.to,
      cc: options.cc?.length ? options.cc : undefined,
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      replyTo: { email: 'alina.carter@hire-in.com', name: 'Alina Carter' },
      subject: `Your ${typeLabel} — Rayomind Solutions LLP (Ref: ${options.referenceNumber})`,
      attachments,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #F96D3E 0%, #ff8c5a 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #fff3e0; margin: 8px 0 0; font-size: 14px;">Official Document</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Dear ${options.employeeName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Please find attached your <strong>${typeLabel}</strong> issued by Rayomind Solutions LLP.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #475569; margin: 0 0 8px; font-size: 14px;"><strong>Reference Number:</strong> ${options.referenceNumber}</p>
              <p style="color: #475569; margin: 0; font-size: 14px;"><strong>Verification Code:</strong> ${options.authCode}</p>
            </div>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
              You can verify the authenticity of this document anytime using the reference number and verification code above.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.verifyUrl}" style="display: inline-block; background-color: #F96D3E; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Verify Document
              </a>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Dear ${options.employeeName},\n\nPlease find attached your ${typeLabel} issued by Rayomind Solutions LLP.\n\nReference Number: ${options.referenceNumber}\nVerification Code: ${options.authCode}\n\nVerify at: ${options.verifyUrl}\n\nBest regards,\nRayomind Solutions LLP`,
    };
    await client.send(msg);
    console.log(`HR letter email sent to ${options.to} (${options.referenceNumber})`);
    return { success: true };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send HR letter email:", errMsg);
    return { success: false, error: errMsg };
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
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: `Welcome to Rayomind Solutions LLP — Your Onboarding Guide`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Welcome to the Team!</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Welcome aboard, ${options.firstName} ${options.lastName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
              Congratulations on joining Rayomind Solutions LLP as <strong>${options.designation}</strong>! Your employee portal account is ready. Here are your login credentials:
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
              <li><strong>Start Punching Attendance</strong> — Use the Attendance page to punch in/out daily (8-hour threshold, 7 PM - 4 AM IST shift)</li>
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
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Welcome aboard, ${options.firstName} ${options.lastName}!\n\nYour Rayomind Solutions LLP employee portal account is ready.\n\nCredentials:\n- Employee ID: ${options.employeeId}\n- Email: ${options.to}\n- Temporary Password: ${options.temporaryPassword}\n\n10-Step Onboarding Checklist:\n1. Log in and change your password at ${options.loginUrl}\n2. Set up 2FA (required)\n3. Upload KYC documents\n4. Upload education certificates\n5. Upload employment documents\n6. Upload cancelled cheque/voided check\n7. Enter bank account details\n8. Add emergency contacts\n9. Select 2 floating holidays\n10. Start punching attendance daily\n\nQuestions? Raise a ticket in the portal or contact HR.`,
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
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: `Performance Review Cycle Opened: ${options.cycleName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
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
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.</p>
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
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: `Reminder: Self-Review Due — ${options.cycleName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
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
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.</p>
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

export async function sendAddendumEmail(options: {
  to: string;
  candidateName: string;
  addendumType: string;
  acceptUrl: string;
  cc?: string[];
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const typeLabels: Record<string, string> = {
      salary_revision: "Salary Revision",
      role_change: "Role / Title Change",
      probation_extension: "Probation Extension",
      combined: "Combined Role & Salary Change",
      custom: "Custom Amendment",
    };
    const typeLabel = typeLabels[options.addendumType] || "Amendment";

    const msg = {
      to: options.to,
      cc: options.cc?.length ? options.cc : undefined,
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      replyTo: { email: 'alina.carter@hire-in.com', name: 'Alina Carter' },
      subject: `Amendment to Your Offer — ${typeLabel}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Offer Letter Amendment</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Dear ${options.candidateName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              An amendment (<strong>${typeLabel}</strong>) to your offer letter has been issued by Rayomind Solutions LLP.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
              Please review the updated terms and provide your digital signature by clicking the button below.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.acceptUrl}" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Review & Sign Addendum
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin: 16px 0 0;">
              If the button doesn't work, copy and paste this link in your browser:<br/>
              <a href="${options.acceptUrl}" style="color: #3b82f6; word-break: break-all;">${options.acceptUrl}</a>
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Dear ${options.candidateName},\n\nAn amendment (${typeLabel}) to your offer letter has been issued.\n\nPlease review and sign at:\n${options.acceptUrl}\n\nBest regards,\nRayomind Solutions LLP`,
    };
    await client.send(msg);
    console.log(`Addendum email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send addendum email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendAddendumAcceptedEmail(options: {
  to: string;
  candidateName: string;
  addendumType: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const typeLabels: Record<string, string> = {
      salary_revision: "Salary Revision",
      role_change: "Role / Title Change",
      probation_extension: "Probation Extension",
      combined: "Combined Role & Salary Change",
      custom: "Custom Amendment",
    };
    const typeLabel = typeLabels[options.addendumType] || "Amendment";

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: `Addendum Signed — ${options.candidateName} (${typeLabel})`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dcfce7; margin: 8px 0 0; font-size: 14px;">Addendum Accepted</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Addendum Signed</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              <strong>${options.candidateName}</strong> has reviewed and digitally signed the <strong>${typeLabel}</strong> addendum to their offer letter.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              You may now counter-sign the addendum from the HR Tools → Offer Letters dashboard.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `${options.candidateName} has signed the ${typeLabel} addendum. Please counter-sign from the HR Tools dashboard.`,
    };
    await client.send(msg);
    console.log(`Addendum accepted notification sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send addendum accepted email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendLeaveAppliedEmail(options: {
  to: string;
  managerName: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason: string;
  approvalUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: `Leave Request: ${options.employeeName} — ${options.leaveType}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Leave Request Notification</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.managerName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              <strong>${options.employeeName}</strong> has submitted a leave request that requires your approval.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 12px;">Leave Details</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 6px 0; width: 120px;">Employee:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.employeeName}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Leave Type:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.leaveType}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">From:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.startDate}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">To:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.endDate}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Total Days:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.totalDays}</td>
                </tr>
                ${options.reason ? `<tr>
                  <td style="color: #64748b; padding: 6px 0; vertical-align: top;">Reason:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.reason}</td>
                </tr>` : ""}
              </table>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.approvalUrl}" style="display: inline-block; background: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Review Leave Request
              </a>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.managerName},\n\n${options.employeeName} has submitted a leave request.\n\nLeave Type: ${options.leaveType}\nFrom: ${options.startDate}\nTo: ${options.endDate}\nTotal Days: ${options.totalDays}${options.reason ? `\nReason: ${options.reason}` : ""}\n\nReview at: ${options.approvalUrl}`,
    };
    await client.send(msg);
    console.log(`Leave applied email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send leave applied email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendLeaveDecisionEmail(options: {
  to: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: "approved" | "rejected";
  reviewComment?: string | null;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const isApproved = options.status === "approved";
    const headerColor = isApproved
      ? "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)"
      : "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)";
    const headerSubtitle = isApproved ? "Leave Approved" : "Leave Rejected";
    const statusText = isApproved ? "approved" : "rejected";

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: `Your Leave Request Has Been ${isApproved ? "Approved" : "Rejected"}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: ${headerColor}; padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: ${isApproved ? "#dcfce7" : "#fee2e2"}; margin: 8px 0 0; font-size: 14px;">${headerSubtitle}</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.employeeName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Your leave request has been <strong>${statusText}</strong>.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 12px;">Leave Details</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 6px 0; width: 120px;">Leave Type:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.leaveType}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">From:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.startDate}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">To:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.endDate}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Status:</td>
                  <td style="color: ${isApproved ? "#16a34a" : "#dc2626"}; font-weight: 600; padding: 6px 0; text-transform: capitalize;">${statusText}</td>
                </tr>
                ${options.reviewComment ? `<tr>
                  <td style="color: #64748b; padding: 6px 0; vertical-align: top;">Comment:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.reviewComment}</td>
                </tr>` : ""}
              </table>
            </div>
            <p style="color: #475569; line-height: 1.6; margin: 0;">
              You can view your leave history in the employee portal.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.employeeName},\n\nYour leave request has been ${statusText}.\n\nLeave Type: ${options.leaveType}\nFrom: ${options.startDate}\nTo: ${options.endDate}${options.reviewComment ? `\nComment: ${options.reviewComment}` : ""}\n\nYou can view your leave history in the employee portal.`,
    };
    await client.send(msg);
    console.log(`Leave decision email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send leave decision email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendLeaveAccrualEmail(options: {
  to: string;
  employeeName: string;
  year: number;
  month: number;
  types: Array<{ leaveTypeName: string; days: number; newBalance: number; accrualType: string }>;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const monthName = new Date(options.year, options.month - 1, 1).toLocaleString("en-IN", { month: "long" });
    const typeRows = options.types.map(t => {
      const bonus = t.accrualType === "monthly+bonus" ? " <span style='color:#7c3aed;font-size:11px;'>(Bonus Month)</span>" : "";
      return `<tr>
        <td style="color:#1e293b;padding:6px 8px;">${t.leaveTypeName}${bonus}</td>
        <td style="color:#16a34a;font-weight:600;padding:6px 8px;">+${t.days}</td>
        <td style="color:#1e293b;font-weight:600;padding:6px 8px;">${t.newBalance.toFixed(1)} days</td>
      </tr>`;
    }).join("");
    const typeText = options.types.map(t => {
      const bonus = t.accrualType === "monthly+bonus" ? " (Bonus Month)" : "";
      return `${t.leaveTypeName}${bonus}: +${t.days} → balance: ${t.newBalance.toFixed(1)} days`;
    }).join("\n");

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: `${monthName} ${options.year} Leave Credited — ${options.employeeName}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
          <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">Rayomind Solutions LLP</h1>
            <p style="color:#dbeafe;margin:8px 0 0;font-size:14px;">Monthly Leave Credit Notification</p>
          </div>
          <div style="padding:32px;">
            <p style="color:#475569;margin:0 0 4px;">Dear <strong>${options.employeeName}</strong>,</p>
            <p style="color:#475569;line-height:1.6;margin:0 0 24px;">
              Your leave balance has been updated for <strong>${monthName} ${options.year}</strong>.
            </p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:0 0 24px;">
              <p style="color:#1e293b;font-weight:600;margin:0 0 12px;">Leave Credited This Month</p>
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <th style="text-align:left;color:#64748b;padding:6px 8px;font-size:12px;">Type</th>
                    <th style="text-align:left;color:#64748b;padding:6px 8px;font-size:12px;">Credited</th>
                    <th style="text-align:left;color:#64748b;padding:6px 8px;font-size:12px;">New Balance</th>
                  </tr>
                </thead>
                <tbody>${typeRows}</tbody>
              </table>
            </div>
            <p style="color:#475569;font-size:13px;line-height:1.6;margin:0;">
              Log in to the HR portal to view your full leave balance and apply for leave.
            </p>
          </div>
          <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Dear ${options.employeeName},\n\n${monthName} ${options.year} Leave Credited:\n${typeText}\n\nLog in to the HR portal to view your balance.`,
    };
    await client.send(msg);
    console.log(`Leave accrual email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send leave accrual email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendLeaveYearEndEmail(options: {
  to: string;
  employeeName: string;
  year: number;
  events: Array<{ action: string; leaveTypeName: string; days: number }>;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const carries = options.events.filter(e => e.action === "carry_forward");
    const lapses = options.events.filter(e => e.action === "lapse");
    const coExpires = options.events.filter(e => e.action === "co_expire");

    const rows = [
      ...carries.map(e => `<tr><td style="padding:6px 8px;color:#1e293b;">${e.leaveTypeName}</td><td style="padding:6px 8px;color:#16a34a;font-weight:600;">Carried forward</td><td style="padding:6px 8px;color:#1e293b;font-weight:600;">${e.days.toFixed(1)} days</td></tr>`),
      ...lapses.map(e => `<tr><td style="padding:6px 8px;color:#1e293b;">${e.leaveTypeName}</td><td style="padding:6px 8px;color:#dc2626;font-weight:600;">Lapsed (Dec 31)</td><td style="padding:6px 8px;color:#1e293b;font-weight:600;">${e.days.toFixed(1)} days</td></tr>`),
      ...coExpires.map(e => `<tr><td style="padding:6px 8px;color:#1e293b;">${e.leaveTypeName}</td><td style="padding:6px 8px;color:#d97706;font-weight:600;">Expired (>30 days)</td><td style="padding:6px 8px;color:#1e293b;font-weight:600;">${e.days.toFixed(1)} days</td></tr>`),
    ].join("");

    const textSummary = [
      ...carries.map(e => `${e.leaveTypeName}: ${e.days.toFixed(1)} days carried forward`),
      ...lapses.map(e => `${e.leaveTypeName}: ${e.days.toFixed(1)} days lapsed on Dec 31`),
      ...coExpires.map(e => `${e.leaveTypeName}: ${e.days.toFixed(1)} days expired (>30 days old)`),
    ].join("\n");

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: `Year-End Leave Update — ${options.year}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
          <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">Rayomind Solutions LLP</h1>
            <p style="color:#dbeafe;margin:8px 0 0;font-size:14px;">Year-End Leave Statement — ${options.year}</p>
          </div>
          <div style="padding:32px;">
            <p style="color:#475569;margin:0 0 4px;">Dear <strong>${options.employeeName}</strong>,</p>
            <p style="color:#475569;line-height:1.6;margin:0 0 24px;">
              Year-end leave processing has been completed for <strong>${options.year}</strong>. Here is a summary of changes to your leave balance:
            </p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:0 0 24px;">
              <p style="color:#1e293b;font-weight:600;margin:0 0 12px;">Year-End Leave Summary</p>
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <th style="text-align:left;color:#64748b;padding:6px 8px;font-size:12px;">Leave Type</th>
                    <th style="text-align:left;color:#64748b;padding:6px 8px;font-size:12px;">Action</th>
                    <th style="text-align:left;color:#64748b;padding:6px 8px;font-size:12px;">Days</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <p style="color:#475569;line-height:1.6;margin:0;">
              Please contact HR if you have any questions about your leave balance.
            </p>
          </div>
          <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Dear ${options.employeeName},\n\nYear-end leave processing for ${options.year} is complete:\n\n${textSummary}\n\nContact HR for any questions.`,
    };
    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send year-end leave email:", error?.response?.body || error.message);
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
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: `Check-In Reminder: ${options.scheduledDate}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
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
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.</p>
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

export async function sendPolicyUpdateEmail(options: {
  to: string;
  firstName: string;
  lastName: string;
  trackTitle: string;
  versionNumber: number;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Rayomind Solutions LLP" },
      subject: `Action Required: "${options.trackTitle}" Policy Updated — Re-sign Required`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Policy Update — Action Required</h1>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 18px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              The employment policy <strong>"${options.trackTitle}"</strong> has been updated to <strong>Version ${options.versionNumber}</strong>.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              As a mandatory compliance requirement, you must review and re-sign this policy before you can continue accessing the HR portal.
            </p>
            <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="color: #991b1b; font-weight: 600; margin: 0;">⚠ Your portal access will be restricted until you re-sign this policy.</p>
            </div>
            <p style="color: #475569; line-height: 1.6;">
              Please log in to the portal and complete the policy acknowledgment at your earliest convenience.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Rayomind Solutions LLP. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nThe policy "${options.trackTitle}" has been updated to Version ${options.versionNumber}. You must re-sign it before you can access the HR portal.\n\nPlease log in to complete the acknowledgment.\n\nRayomind Solutions LLP`,
    };
    await client.send(msg);
    console.log(`Policy update email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send policy update email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}
