// SendGrid email service - Replit SendGrid integration
import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email };
}

async function getUncachableSendGridClient() {
  const { apiKey, email } = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
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
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const csvBase64 = Buffer.from(options.csvContent).toString("base64");
    const fileName = `Salary_Report_${options.summary.monthName}_${options.summary.year}.csv`;

    const msg = {
      to: "accounts@hire-in.com",
      cc: "simranjeet.sidana@hire-in.com",
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
